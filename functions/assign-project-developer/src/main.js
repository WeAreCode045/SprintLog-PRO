import { Client, Users, TablesDB, Query, ID, Permission, Role } from 'node-appwrite';

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
  timeEntries: 'timeEntries',
};
const ADMIN_LABEL = 'admin';
const DEVELOPER_LABEL = 'developer';

function projectPermissions(teamId, assigneeUserIds = []) {
  return [
    Permission.read(Role.label(ADMIN_LABEL)),
    Permission.read(Role.team(teamId)),
    Permission.update(Role.label(ADMIN_LABEL)),
    Permission.delete(Role.label(ADMIN_LABEL)),
    ...assigneeUserIds.map((id) => Permission.read(Role.user(id))),
    ...assigneeUserIds.map((id) => Permission.update(Role.user(id))),
  ];
}

function openTaskPermissions(teamId, createdBy, assigneeUserIds = []) {
  const uniqueAssignees = [...new Set([createdBy, ...assigneeUserIds].filter(Boolean))];
  return [
    Permission.read(Role.label(ADMIN_LABEL)),
    Permission.read(Role.label(DEVELOPER_LABEL)),
    Permission.read(Role.team(teamId)),
    Permission.update(Role.label(ADMIN_LABEL)),
    Permission.update(Role.label(DEVELOPER_LABEL)),
    Permission.update(Role.team(teamId)),
    Permission.delete(Role.label(ADMIN_LABEL)),
    ...uniqueAssignees.flatMap((userId) => [
      Permission.read(Role.user(userId)),
      Permission.update(Role.user(userId)),
      Permission.delete(Role.user(userId)),
    ]),
  ];
}

function finishedTaskPermissions(teamId, assigneeUserIds = []) {
  return [
    Permission.read(Role.label(ADMIN_LABEL)),
    Permission.read(Role.team(teamId)),
    Permission.update(Role.label(ADMIN_LABEL)),
    Permission.delete(Role.label(ADMIN_LABEL)),
    ...assigneeUserIds.flatMap((userId) => [
      Permission.read(Role.user(userId)),
      Permission.update(Role.user(userId)),
    ]),
  ];
}

function assignmentPermissions(userId, teamId) {
  return [
    Permission.read(Role.label(ADMIN_LABEL)),
    Permission.read(Role.user(userId)),
    Permission.read(Role.team(teamId)),
    Permission.update(Role.label(ADMIN_LABEL)),
    Permission.delete(Role.label(ADMIN_LABEL)),
  ];
}

function buildTaskPermissions(teamId, task, projectAssigneeIds) {
  const taskAssigneeIds = Array.isArray(task.assigneeIds) ? task.assigneeIds : [];
  const base =
    task.status === 'finished'
      ? finishedTaskPermissions(teamId, taskAssigneeIds)
      : openTaskPermissions(teamId, task.createdBy, taskAssigneeIds);

  const existing = new Set(base);
  const projectReads = projectAssigneeIds
    .filter(Boolean)
    .map((userId) => Permission.read(Role.user(userId)))
    .filter((permission) => !existing.has(permission));

  return [...base, ...projectReads];
}

async function assertCallerIsAdmin(users, req) {
  const callerId = req.headers['x-appwrite-user-id'];
  if (!callerId) {
    const err = new Error('Missing x-appwrite-user-id header');
    err.status = 401;
    throw err;
  }
  const caller = await users.get({ userId: callerId });
  const labels = caller.labels ?? [];
  if (!labels.includes(ADMIN_LABEL)) {
    const err = new Error('Caller is not an admin');
    err.status = 403;
    throw err;
  }
  return callerId;
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
  const rows = await listAllRows(tablesDB, TABLES.projectAssignments, [
    Query.equal('projectId', projectId),
  ]);
  return [...new Set(rows.map((row) => row.userId).filter(Boolean))];
}

async function findAssignment(tablesDB, projectId, userId) {
  const result = await tablesDB.listRows({
    databaseId: DATABASE_ID,
    tableId: TABLES.projectAssignments,
    queries: [
      Query.equal('projectId', projectId),
      Query.equal('userId', userId),
      Query.limit(1),
    ],
  });
  return result.rows[0] ?? null;
}

function discussionRowPermissions(teamId, createdBy) {
  return [
    Permission.read(Role.label(ADMIN_LABEL)),
    Permission.read(Role.label(DEVELOPER_LABEL)),
    Permission.read(Role.team(teamId)),
    Permission.read(Role.user(createdBy)),
    Permission.update(Role.label(ADMIN_LABEL)),
    Permission.update(Role.label(DEVELOPER_LABEL)),
    Permission.update(Role.team(teamId)),
    Permission.update(Role.user(createdBy)),
    Permission.delete(Role.label(ADMIN_LABEL)),
    Permission.delete(Role.user(createdBy)),
  ];
}

function timeEntryRowPermissions(teamId, ownerUserId) {
  return [
    Permission.read(Role.label(ADMIN_LABEL)),
    Permission.read(Role.label(DEVELOPER_LABEL)),
    Permission.read(Role.team(teamId)),
    Permission.read(Role.user(ownerUserId)),
    Permission.update(Role.label(ADMIN_LABEL)),
    Permission.update(Role.user(ownerUserId)),
    Permission.delete(Role.label(ADMIN_LABEL)),
    Permission.delete(Role.user(ownerUserId)),
  ];
}

/** Approved (billable) time entry: mirrors permissions.ts#lockedTimeEntryPermissions.
 * Must be used instead of timeEntryRowPermissions whenever entry.approved is true, or a
 * sync triggered by an unrelated task/assignment change would silently unlock approved hours. */
function lockedTimeEntryPermissions(teamId) {
  return [
    Permission.read(Role.label(ADMIN_LABEL)),
    Permission.update(Role.label(ADMIN_LABEL)),
    Permission.delete(Role.label(ADMIN_LABEL)),
    Permission.read(Role.team(teamId)),
  ];
}

async function syncDiscussionPermissions(tablesDB, { companyId, projectId, teamId, log }) {
  const discussionQueries = [Query.equal('companyId', companyId)];
  if (projectId) {
    discussionQueries.push(Query.equal('projectId', projectId));
  }
  const discussions = await listAllRows(tablesDB, TABLES.discussions, discussionQueries);
  for (const discussion of discussions) {
    await tablesDB.updateRow({
      databaseId: DATABASE_ID,
      tableId: TABLES.discussions,
      rowId: discussion.$id,
      data: {},
      permissions: discussionRowPermissions(teamId, discussion.createdBy),
    });
  }

  const replyQueries = [Query.equal('companyId', companyId)];
  if (projectId) {
    replyQueries.push(Query.equal('projectId', projectId));
  }
  const replies = await listAllRows(tablesDB, TABLES.discussionReplies, replyQueries);
  for (const reply of replies) {
    await tablesDB.updateRow({
      databaseId: DATABASE_ID,
      tableId: TABLES.discussionReplies,
      rowId: reply.$id,
      data: {},
      permissions: discussionRowPermissions(teamId, reply.createdBy),
    });
  }
  log(
    `Synced permissions on ${discussions.length} discussion(s) and ${replies.length} reply(ies) for company ${companyId}`,
  );
}

async function syncTimeEntryPermissions(tablesDB, { companyId, projectId, teamId, log }) {
  const queries = [Query.equal('companyId', companyId)];
  if (projectId) {
    queries.push(Query.equal('projectId', projectId));
  }
  const entries = await listAllRows(tablesDB, TABLES.timeEntries, queries);
  for (const entry of entries) {
    await tablesDB.updateRow({
      databaseId: DATABASE_ID,
      tableId: TABLES.timeEntries,
      rowId: entry.$id,
      data: {},
      permissions: entry.approved
        ? lockedTimeEntryPermissions(teamId)
        : timeEntryRowPermissions(teamId, entry.userId),
    });
  }
  log(
    `Synced permissions on ${entries.length} time entr${entries.length === 1 ? 'y' : 'ies'} for company ${companyId}`,
  );
}

async function syncProjectAndTaskPermissions(tablesDB, { projectId, teamId, log }) {
  const assigneeIds = await listProjectAssigneeIds(tablesDB, projectId);

  await tablesDB.updateRow({
    databaseId: DATABASE_ID,
    tableId: TABLES.projects,
    rowId: projectId,
    data: {},
    permissions: projectPermissions(teamId, assigneeIds),
  });
  log(`Updated project ${projectId} permissions for ${assigneeIds.length} assignee(s)`);

  const tasks = await listAllRows(tablesDB, TABLES.tasks, [Query.equal('projectId', projectId)]);
  for (const task of tasks) {
    const taskAssigneeIds = Array.isArray(task.assigneeIds) ? task.assigneeIds : [];
    // Tasks without their own assignees inherit the project's assigned developers.
    const nextAssigneeIds = taskAssigneeIds.length > 0 ? taskAssigneeIds : assigneeIds;
    const updatedTask = { ...task, assigneeIds: nextAssigneeIds };
    await tablesDB.updateRow({
      databaseId: DATABASE_ID,
      tableId: TABLES.tasks,
      rowId: task.$id,
      data: taskAssigneeIds.length > 0 ? {} : { assigneeIds: nextAssigneeIds },
      permissions: buildTaskPermissions(teamId, updatedTask, assigneeIds),
    });
  }
  log(`Synced permissions on ${tasks.length} task(s) for project ${projectId}`);
}

export default async ({ req, res, log, error }) => {
  const client = new Client()
    .setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT)
    .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
    .setKey(req.headers['x-appwrite-key'] ?? '');

  const users = new Users(client);
  const tablesDB = new TablesDB(client);

  try {
    const callerId = await assertCallerIsAdmin(users, req);
    const body = req.bodyJson ?? {};
    const { action, companyId, projectId, userId, teamId } = body;

    if (
      action !== 'assign' &&
      action !== 'unassign' &&
      action !== 'syncPermissions' &&
      action !== 'syncDiscussionPermissions' &&
      action !== 'syncTimeEntryPermissions'
    ) {
      return res.json(
        {
          success: false,
          message:
            "action must be 'assign', 'unassign', 'syncPermissions', 'syncDiscussionPermissions', or 'syncTimeEntryPermissions'",
        },
        400,
      );
    }
    if (!companyId || !teamId) {
      return res.json({ success: false, message: 'companyId and teamId are required' }, 400);
    }
    if (
      action !== 'syncDiscussionPermissions' &&
      action !== 'syncTimeEntryPermissions' &&
      !projectId
    ) {
      return res.json({ success: false, message: 'projectId is required' }, 400);
    }
    if ((action === 'assign' || action === 'unassign') && !userId) {
      return res.json({ success: false, message: 'userId is required for assign/unassign' }, 400);
    }

    if (action === 'syncDiscussionPermissions') {
      await syncDiscussionPermissions(tablesDB, {
        companyId,
        projectId: projectId || null,
        teamId,
        log,
      });
      return res.json({ success: true });
    }

    if (action === 'syncTimeEntryPermissions') {
      await syncTimeEntryPermissions(tablesDB, {
        companyId,
        projectId: projectId || null,
        teamId,
        log,
      });
      return res.json({ success: true });
    }

    if (action === 'assign') {
      const existing = await findAssignment(tablesDB, projectId, userId);
      if (!existing) {
        await tablesDB.createRow({
          databaseId: DATABASE_ID,
          tableId: TABLES.projectAssignments,
          rowId: ID.unique(),
          data: {
            companyId,
            projectId,
            userId,
            assignedBy: callerId,
          },
          permissions: assignmentPermissions(userId, teamId),
        });
        log(`Created projectAssignments for user ${userId} on project ${projectId}`);
      } else {
        log(`Assignment already exists for user ${userId} on project ${projectId}`);
      }
    } else if (action === 'unassign') {
      const existing = await findAssignment(tablesDB, projectId, userId);
      if (existing) {
        await tablesDB.deleteRow({
          databaseId: DATABASE_ID,
          tableId: TABLES.projectAssignments,
          rowId: existing.$id,
        });
        log(`Deleted assignment ${existing.$id}`);
      } else {
        log(`No assignment found for user ${userId} on project ${projectId}`);
      }
    } else {
      log(`Syncing permissions for project ${projectId}`);
    }

    await syncProjectAndTaskPermissions(tablesDB, { projectId, teamId, log });
    await syncDiscussionPermissions(tablesDB, { companyId, projectId, teamId, log });
    await syncTimeEntryPermissions(tablesDB, { companyId, projectId, teamId, log });

    return res.json({ success: true });
  } catch (err) {
    const status = err.status ?? 500;
    error(`assign-project-developer failed: ${err.message}`);
    return res.json({ success: false, message: err.message }, status);
  }
};
