import { Client, TablesDB, Teams, Query, ID, Permission, Role } from 'node-appwrite';

const DATABASE_ID = 'main';
const TABLES = {
  companies: 'companies',
  projects: 'projects',
  taskGroups: 'taskGroups',
  tasks: 'tasks',
  userProfiles: 'userProfiles',
  projectAssignments: 'projectAssignments',
  discussions: 'discussions',
  discussionReplies: 'discussionReplies',
  projectFiles: 'projectFiles',
  notifications: 'notifications',
};
const ADMIN_LABEL = 'admin';
const DEVELOPER_LABEL = 'developer';

function notificationPermissions(userId) {
  return [
    Permission.read(Role.user(userId)),
    Permission.update(Role.user(userId)),
  ];
}

async function listAllRows(tablesDB, tableId, queries) {
  const rows = [];
  let cursor = null;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const pageQueries = [...queries, Query.limit(100)];
    if (cursor) {
      pageQueries.push(Query.cursorAfter(cursor));
    }
    const result = await tablesDB.listRows({
      databaseId: DATABASE_ID,
      tableId,
      queries: pageQueries,
    });
    if (result.rows.length === 0) break;
    rows.push(...result.rows);
    if (result.rows.length < 100) break;
    cursor = result.rows[result.rows.length - 1].$id;
  }
  return rows;
}

async function listProjectAssigneeIds(tablesDB, projectId) {
  if (!projectId) return [];
  const rows = await listAllRows(tablesDB, TABLES.projectAssignments, [
    Query.equal('projectId', projectId),
  ]);
  return [...new Set(rows.map((row) => row.userId).filter(Boolean))];
}

async function listTeamMemberIds(teams, teamId, log) {
  if (!teamId) return [];
  const userIds = [];
  let cursor = null;
  try {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const queries = [Query.limit(100)];
      if (cursor) {
        queries.push(Query.cursorAfter(cursor));
      }
      const result = await teams.listMemberships({ teamId, queries });
      const memberships = result.memberships ?? result.rows ?? [];
      if (memberships.length === 0) break;
      for (const membership of memberships) {
        if (membership.userId) {
          userIds.push(membership.userId);
        }
      }
      if (memberships.length < 100) break;
      cursor = memberships[memberships.length - 1].$id;
    }
  } catch (err) {
    log(`Unable to list team memberships for ${teamId}: ${err.message}`);
    return [];
  }
  return [...new Set(userIds)];
}

async function getCompanyTeamId(tablesDB, companyId) {
  if (!companyId) return null;
  try {
    const company = await tablesDB.getRow({
      databaseId: DATABASE_ID,
      tableId: TABLES.companies,
      rowId: companyId,
    });
    return company.teamId ?? null;
  } catch {
    return null;
  }
}

async function createNotification(tablesDB, payload, log) {
  const { userId, companyId, projectId, type, title, body, href, sourceId } = payload;
  if (!userId || !companyId || !type || !title) {
    return;
  }

  await tablesDB.createRow({
    databaseId: DATABASE_ID,
    tableId: TABLES.notifications,
    rowId: ID.unique(),
    data: {
      userId,
      companyId,
      projectId: projectId ?? null,
      type,
      title,
      body: body ?? null,
      href: href ?? null,
      readAt: null,
      sourceId: sourceId ?? null,
    },
    permissions: notificationPermissions(userId),
  });
  log(`Created ${type} notification for user ${userId}`);
}

async function notifyUsers(tablesDB, userIds, actorId, basePayload, log) {
  const uniqueUserIds = [...new Set(userIds.filter(Boolean))];
  for (const userId of uniqueUserIds) {
    if (actorId && userId === actorId) continue;
    try {
      await createNotification(tablesDB, { ...basePayload, userId }, log);
    } catch (err) {
      log(`Failed to notify ${userId}: ${err.message}`);
    }
  }
}

function parseEvent(eventHeader) {
  const event = eventHeader || '';
  const isTasks = event.includes('.tables.tasks.rows.');
  const isDiscussionReplies = event.includes('.tables.discussionReplies.rows.');
  const isProjectFiles = event.includes('.tables.projectFiles.rows.');
  const isCreate = event.endsWith('.create');
  const isUpdate = event.endsWith('.update');
  return { event, isTasks, isDiscussionReplies, isProjectFiles, isCreate, isUpdate };
}

export default async ({ req, res, log, error }) => {
  const client = new Client()
    .setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT)
    .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
    .setKey(req.headers['x-appwrite-key'] ?? '');

  const tablesDB = new TablesDB(client);
  const teams = new Teams(client);

  try {
    const eventHeader = req.headers['x-appwrite-event'] || '';
    const payload = req.bodyJson;
    if (!payload || !payload.$id) {
      log('notify-on-events: no row payload; returning success');
      return res.json({ success: true });
    }

    const { isTasks, isDiscussionReplies, isProjectFiles, isCreate, isUpdate } =
      parseEvent(eventHeader);
    const actorId =
      req.headers['x-appwrite-user-id'] ||
      payload.createdBy ||
      payload.uploadedBy ||
      null;

    if (isTasks && isCreate) {
      if (payload.audience === 'client' && payload.requiresFileUpload) {
        const projectAssigneeIds = await listProjectAssigneeIds(tablesDB, payload.projectId);
        const teamId = await getCompanyTeamId(tablesDB, payload.companyId);
        const teamMemberIds = await listTeamMemberIds(teams, teamId, log);
        await notifyUsers(
          tablesDB,
          [...projectAssigneeIds, ...teamMemberIds],
          actorId,
          {
            companyId: payload.companyId,
            projectId: payload.projectId,
            type: 'file_requested',
            title: 'File upload requested',
            body: `Please upload a file for task: ${payload.title || 'Untitled task'}`,
            href: `/projects/${payload.projectId}`,
            sourceId: payload.$id,
          },
          log,
        );
      }
      return res.json({ success: true });
    }

    if (isTasks && isUpdate) {
      if (payload.status === 'finished') {
        const projectAssigneeIds = await listProjectAssigneeIds(tablesDB, payload.projectId);
        const teamId = await getCompanyTeamId(tablesDB, payload.companyId);
        const teamMemberIds = await listTeamMemberIds(teams, teamId, log);
        await notifyUsers(
          tablesDB,
          [...projectAssigneeIds, ...teamMemberIds],
          actorId,
          {
            companyId: payload.companyId,
            projectId: payload.projectId,
            type: 'task_completed',
            title: 'Task completed',
            body: `${payload.title || 'A task'} was marked finished`,
            href: `/projects/${payload.projectId}`,
            sourceId: payload.$id,
          },
          log,
        );
      }
      return res.json({ success: true });
    }

    if (isDiscussionReplies && isCreate) {
      const projectAssigneeIds = await listProjectAssigneeIds(tablesDB, payload.projectId);
      await notifyUsers(
        tablesDB,
        projectAssigneeIds,
        actorId,
        {
          companyId: payload.companyId,
          projectId: payload.projectId,
          type: 'discussion_active',
          title: 'New discussion reply',
          body: 'A discussion received a new reply',
          href: `/projects/${payload.projectId}`,
          sourceId: payload.$id,
        },
        log,
      );
      return res.json({ success: true });
    }

    if (isProjectFiles && isCreate) {
      const projectAssigneeIds = await listProjectAssigneeIds(tablesDB, payload.projectId);
      let recipientIds = [...projectAssigneeIds];

      if (payload.taskId) {
        try {
          const task = await tablesDB.getRow({
            databaseId: DATABASE_ID,
            tableId: TABLES.tasks,
            rowId: payload.taskId,
          });
          if (task.audience === 'client') {
            const taskAssignees = Array.isArray(task.assigneeIds) ? task.assigneeIds : [];
            recipientIds = [...recipientIds, ...taskAssignees];
          }
        } catch (err) {
          log(`Could not load task ${payload.taskId} for file notification: ${err.message}`);
        }
      }

      await notifyUsers(
        tablesDB,
        recipientIds,
        actorId,
        {
          companyId: payload.companyId,
          projectId: payload.projectId,
          type: 'file_uploaded',
          title: 'File uploaded',
          body: `${payload.name || 'A file'} was uploaded`,
          href: `/projects/${payload.projectId}`,
          sourceId: payload.$id,
        },
        log,
      );
      return res.json({ success: true });
    }

    log(`No notification handler for event: ${eventHeader}`);
    return res.json({ success: true });
  } catch (err) {
    error(`notify-on-events failed: ${err.message}`);
    return res.json({ success: true, message: err.message });
  }
};
