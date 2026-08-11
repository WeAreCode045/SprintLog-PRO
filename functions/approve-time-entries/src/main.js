import { Client, TablesDB, Teams, Query, ID, Permission, Role } from 'node-appwrite';

const DATABASE_ID = 'main';
const TABLES = {
  companies: 'companies',
  timeEntries: 'timeEntries',
  notifications: 'notifications',
};
const ADMIN_LABEL = 'admin';
const CLIENT_TEAM_ROLE = 'client';

/** Mirrors sites/project-manager/src/appwrite/permissions.ts#lockedTimeEntryPermissions. */
function lockedTimeEntryPermissions(teamId) {
  return [
    Permission.read(Role.label(ADMIN_LABEL)),
    Permission.update(Role.label(ADMIN_LABEL)),
    Permission.delete(Role.label(ADMIN_LABEL)),
    Permission.read(Role.team(teamId)),
  ];
}

function notificationPermissions(userId) {
  return [Permission.read(Role.user(userId)), Permission.update(Role.user(userId))];
}

async function assertCallerIsClientOnTeam(teams, req, teamId) {
  const callerId = req.headers['x-appwrite-user-id'];
  if (!callerId) {
    const err = new Error('Missing x-appwrite-user-id header');
    err.status = 401;
    throw err;
  }
  const result = await teams.listMemberships({
    teamId,
    queries: [Query.equal('userId', callerId)],
  });
  const memberships = result.memberships ?? [];
  const isClient = memberships.some((membership) => (membership.roles ?? []).includes(CLIENT_TEAM_ROLE));
  if (!isClient) {
    const err = new Error('Caller is not a client member of this team');
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

  const tablesDB = new TablesDB(client);
  const teams = new Teams(client);

  try {
    const body = req.bodyJson ?? {};
    const { entryIds, teamId } = body;

    if (!teamId || typeof teamId !== 'string') {
      return res.json({ success: false, message: 'teamId is required' }, 400);
    }
    if (!Array.isArray(entryIds) || entryIds.length === 0) {
      return res.json({ success: false, message: 'entryIds must be a non-empty array' }, 400);
    }
    const normalizedEntryIds = [
      ...new Set(entryIds.filter((id) => typeof id === 'string' && id.length > 0)),
    ];

    await assertCallerIsClientOnTeam(teams, req, teamId);

    const companies = await tablesDB.listRows({
      databaseId: DATABASE_ID,
      tableId: TABLES.companies,
      queries: [Query.equal('teamId', teamId), Query.limit(1)],
    });
    const company = companies.rows[0];
    if (!company) {
      return res.json({ success: false, message: 'No company found for teamId' }, 400);
    }

    const entries = await Promise.all(
      normalizedEntryIds.map((entryId) =>
        tablesDB.getRow({ databaseId: DATABASE_ID, tableId: TABLES.timeEntries, rowId: entryId }),
      ),
    );

    for (const entry of entries) {
      if (entry.companyId !== company.$id) {
        return res.json(
          { success: false, message: `Entry ${entry.$id} does not belong to this company` },
          400,
        );
      }
      if (entry.approved) {
        return res.json(
          { success: false, message: `Entry ${entry.$id} is already approved` },
          400,
        );
      }
    }

    for (const entry of entries) {
      await tablesDB.updateRow({
        databaseId: DATABASE_ID,
        tableId: TABLES.timeEntries,
        rowId: entry.$id,
        data: { approved: true },
        permissions: lockedTimeEntryPermissions(teamId),
      });
    }

    const hoursByOwner = new Map();
    for (const entry of entries) {
      const prev = hoursByOwner.get(entry.userId) ?? { hours: 0, count: 0 };
      hoursByOwner.set(entry.userId, {
        hours: prev.hours + (entry.hours ?? 0),
        count: prev.count + 1,
      });
    }
    for (const [ownerId, summary] of hoursByOwner.entries()) {
      await createNotification(
        tablesDB,
        {
          userId: ownerId,
          companyId: company.$id,
          type: 'hours_approved',
          title: 'Hours approved',
          body: `${company.name} approved ${summary.hours} hour(s) across ${summary.count} entr${summary.count === 1 ? 'y' : 'ies'}`,
        },
        log,
      );
    }

    log(`Approved ${entries.length} time entr${entries.length === 1 ? 'y' : 'ies'} for company ${company.$id}`);
    return res.json({ success: true, approvedCount: entries.length });
  } catch (err) {
    const status = err.status ?? 500;
    error(`approve-time-entries failed: ${err.message}`);
    return res.json({ success: false, message: err.message }, status);
  }
};
