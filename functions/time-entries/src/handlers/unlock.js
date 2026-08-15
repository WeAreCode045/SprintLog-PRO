import { Client, Users, TablesDB, ID, Permission, Role } from 'node-appwrite';

const DATABASE_ID = 'main';
const TABLES = {
  timeEntries: 'timeEntries',
  notifications: 'notifications',
};
const ADMIN_LABEL = 'admin';
const DEVELOPER_LABEL = 'developer';

/** Mirrors sites/project-manager/src/appwrite/permissions.ts#timeEntryPermissions
 * (canGrantStaffRoles branch — restores the normal owner-editable ACL). */
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

function notificationPermissions(userId) {
  return [Permission.read(Role.user(userId)), Permission.update(Role.user(userId))];
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

async function createNotification(tablesDB, payload, log) {
  const { userId, companyId, type, title, body } = payload;
  if (!userId || !companyId || !type || !title) return;
  await tablesDB.createRow({
    databaseId: DATABASE_ID,
    tableId: TABLES.notifications,
    rowId: ID.unique(),
    data: {
      userId,
      companyId,
      projectId: null,
      type,
      title,
      body: body ?? null,
      href: null,
      readAt: null,
      sourceId: null,
    },
    permissions: notificationPermissions(userId),
  });
  log(`Created ${type} notification for user ${userId}`);
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
    const { entryIds, teamId, reason } = body;

    if (!teamId || typeof teamId !== 'string') {
      return res.json({ success: false, message: 'teamId is required' }, 400);
    }
    if (!Array.isArray(entryIds) || entryIds.length === 0) {
      return res.json({ success: false, message: 'entryIds must be a non-empty array' }, 400);
    }
    const trimmedReason = typeof reason === 'string' ? reason.trim() : '';
    if (!trimmedReason || trimmedReason.length > 500) {
      return res.json(
        { success: false, message: 'reason is required (1-500 characters)' },
        400,
      );
    }
    const normalizedEntryIds = [
      ...new Set(entryIds.filter((id) => typeof id === 'string' && id.length > 0)),
    ];

    const entries = await Promise.all(
      normalizedEntryIds.map((entryId) =>
        tablesDB.getRow({ databaseId: DATABASE_ID, tableId: TABLES.timeEntries, rowId: entryId }),
      ),
    );

    for (const entry of entries) {
      if (!entry.approved) {
        return res.json({ success: false, message: `Entry ${entry.$id} is not approved` }, 400);
      }
      if (entry.invoiced) {
        return res.json(
          { success: false, message: `Entry ${entry.$id} is already invoiced and cannot be unlocked` },
          400,
        );
      }
    }

    for (const entry of entries) {
      await tablesDB.updateRow({
        databaseId: DATABASE_ID,
        tableId: TABLES.timeEntries,
        rowId: entry.$id,
        data: { approved: false },
        permissions: timeEntryRowPermissions(teamId, entry.userId),
      });
    }

    const ownerIds = [...new Set(entries.map((entry) => entry.userId).filter(Boolean))];
    for (const ownerId of ownerIds) {
      await createNotification(
        tablesDB,
        {
          userId: ownerId,
          companyId: entries[0].companyId,
          type: 'hours_unlocked',
          title: 'Approved hours unlocked',
          body: trimmedReason,
        },
        log,
      );
    }

    log(
      `ADMIN UNLOCK entryIds=${normalizedEntryIds.join(',')} teamId=${teamId} admin=${callerId} reason="${trimmedReason}"`,
    );

    return res.json({ success: true, unlockedCount: entries.length });
  } catch (err) {
    const status = err.status ?? 500;
    error(`unlock-time-entries failed: ${err.message}`);
    return res.json({ success: false, message: err.message }, status);
  }
};
