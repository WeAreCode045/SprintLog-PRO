import { Client, Users, TablesDB, Permission, Role } from 'node-appwrite';

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

function openTaskPermissions(teamId, createdBy, assigneeUserIds = []) {
  const uniqueAssignees = [...new Set([createdBy, ...assigneeUserIds].filter(Boolean))];
  return [
    Permission.read(Role.label(ADMIN_LABEL)),
    Permission.read(Role.team(teamId)),
    Permission.update(Role.label(ADMIN_LABEL)),
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

export default async ({ req, res, log, error }) => {
  const client = new Client()
    .setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT)
    .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
    .setKey(req.headers['x-appwrite-key'] ?? '');

  const users = new Users(client);
  const tablesDB = new TablesDB(client);

  try {
    await assertCallerIsAdmin(users, req);

    const body = req.bodyJson ?? {};
    const { taskId, teamId, assigneeIds, createdBy } = body;

    if (!taskId || typeof taskId !== 'string') {
      return res.json({ success: false, message: 'taskId is required' }, 400);
    }
    if (!teamId || typeof teamId !== 'string') {
      return res.json({ success: false, message: 'teamId is required' }, 400);
    }
    if (!Array.isArray(assigneeIds)) {
      return res.json({ success: false, message: 'assigneeIds must be an array' }, 400);
    }

    const normalizedAssigneeIds = [
      ...new Set(assigneeIds.filter((id) => typeof id === 'string' && id.length > 0)),
    ];

    const task = await tablesDB.getRow({
      databaseId: DATABASE_ID,
      tableId: TABLES.tasks,
      rowId: taskId,
    });

    const resolvedCreatedBy =
      (typeof createdBy === 'string' && createdBy) || task.createdBy || null;

    const permissions =
      task.status === 'finished'
        ? finishedTaskPermissions(teamId, normalizedAssigneeIds)
        : openTaskPermissions(teamId, resolvedCreatedBy, normalizedAssigneeIds);

    await tablesDB.updateRow({
      databaseId: DATABASE_ID,
      tableId: TABLES.tasks,
      rowId: taskId,
      data: {
        assigneeIds: normalizedAssigneeIds,
      },
      permissions,
    });

    log(
      `Updated task ${taskId} assignees (${normalizedAssigneeIds.length}) with ${task.status} permissions`,
    );

    return res.json({ success: true });
  } catch (err) {
    const status = err.status ?? 500;
    error(`assign-task-assignees failed: ${err.message}`);
    return res.json({ success: false, message: err.message }, status);
  }
};
