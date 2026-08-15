import { Query, ID, Permission, Role } from 'node-appwrite';
import { DATABASE_ID, TABLES, listAllRows } from '../lib/appwrite.js';
import { ADMIN_LABEL, DEVELOPER_LABEL } from '../lib/auth.js';

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

export async function handleAssignDeveloper({ body, callerId, tablesDB, log }) {
  const { action, companyId, projectId, userId, teamId } = body;

  if (
    action !== 'assign' &&
    action !== 'unassign' &&
    action !== 'syncPermissions' &&
    action !== 'syncDiscussionPermissions' &&
    action !== 'syncTimeEntryPermissions'
  ) {
    const err = new Error(
      "action must be 'assign', 'unassign', 'syncPermissions', 'syncDiscussionPermissions', or 'syncTimeEntryPermissions'",
    );
    err.status = 400;
    throw err;
  }
  if (!companyId || !teamId) {
    const err = new Error('companyId and teamId are required');
    err.status = 400;
    throw err;
  }
  if (
    action !== 'syncDiscussionPermissions' &&
    action !== 'syncTimeEntryPermissions' &&
    !projectId
  ) {
    const err = new Error('projectId is required');
    err.status = 400;
    throw err;
  }
  if ((action === 'assign' || action === 'unassign') && !userId) {
    const err = new Error('userId is required for assign/unassign');
    err.status = 400;
    throw err;
  }

  if (action === 'syncDiscussionPermissions') {
    await syncDiscussionPermissions(tablesDB, {
      companyId,
      projectId: projectId || null,
      teamId,
      log,
    });
    return { success: true };
  }

  if (action === 'syncTimeEntryPermissions') {
    await syncTimeEntryPermissions(tablesDB, {
      companyId,
      projectId: projectId || null,
      teamId,
      log,
    });
    return { success: true };
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

  return { success: true };
}
