import { Client, Users, Teams, TablesDB, Query, ID, Permission, Role } from 'node-appwrite';

const DATABASE_ID = 'main';
const TABLES = {
  userProfiles: 'userProfiles',
};
const ADMIN_LABEL = 'admin';
const TEAM_CLIENT_ROLE = 'client';
const MIN_PASSWORD_LENGTH = 8;

function userProfilePermissions(userId) {
  return [
    Permission.read(Role.user(userId)),
    Permission.update(Role.user(userId)),
    Permission.read(Role.label(ADMIN_LABEL)),
    Permission.update(Role.label(ADMIN_LABEL)),
    Permission.delete(Role.label(ADMIN_LABEL)),
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

async function findUserByEmail(users, email) {
  const result = await users.list({
    queries: [Query.equal('email', email), Query.limit(1)],
  });
  return result.users[0] ?? null;
}

async function upsertUserProfile(tablesDB, { userId, displayName, email }) {
  const existing = await tablesDB.listRows({
    databaseId: DATABASE_ID,
    tableId: TABLES.userProfiles,
    queries: [Query.equal('userId', userId), Query.limit(1)],
  });

  const data = {
    userId,
    displayName,
    email,
    globalRole: TEAM_CLIENT_ROLE,
  };
  const permissions = userProfilePermissions(userId);

  if (existing.rows.length > 0) {
    const row = existing.rows[0];
    await tablesDB.updateRow({
      databaseId: DATABASE_ID,
      tableId: TABLES.userProfiles,
      rowId: row.$id,
      data,
      permissions,
    });
    return row.$id;
  }

  const created = await tablesDB.createRow({
    databaseId: DATABASE_ID,
    tableId: TABLES.userProfiles,
    rowId: ID.unique(),
    data,
    permissions,
  });
  return created.$id;
}

async function listAllMemberships(teams, teamId) {
  const memberships = [];
  let offset = 0;
  const limit = 100;
  while (true) {
    const result = await teams.listMemberships({
      teamId,
      queries: [Query.limit(limit), Query.offset(offset)],
    });
    const batch = result.memberships ?? [];
    memberships.push(...batch);
    if (batch.length < limit) break;
    offset += limit;
  }
  return memberships;
}

async function ensureTeamMembership(teams, { teamId, userId, email, log }) {
  const normalizedEmail = email.toLowerCase();
  const all = await listAllMemberships(teams, teamId);

  for (const membership of all) {
    const membershipEmail = (membership.userEmail || '').toLowerCase();
    const isOrphan = !membership.userId;
    const emailMatches = membershipEmail === normalizedEmail;
    if (isOrphan && emailMatches) {
      await teams.deleteMembership({
        teamId,
        membershipId: membership.$id,
      });
      log(`Deleted orphan membership ${membership.$id} for ${email}`);
    }
  }

  const existing = all.find((membership) => membership.userId === userId);
  if (existing && existing.userId) {
    const roles = existing.roles ?? [];
    if (!roles.includes(TEAM_CLIENT_ROLE)) {
      await teams.updateMembership({
        teamId,
        membershipId: existing.$id,
        roles: [TEAM_CLIENT_ROLE],
      });
      log(`Updated membership roles for ${userId} on team ${teamId}`);
    } else {
      log(`User ${userId} already on team ${teamId}`);
    }
    return existing;
  }

  const membership = await teams.createMembership({
    teamId,
    roles: [TEAM_CLIENT_ROLE],
    userId,
  });

  if (!membership.userId) {
    const err = new Error(
      'Team membership was created without a userId; login access would fail. Check Appwrite team settings.',
    );
    err.status = 500;
    throw err;
  }

  log(`Created membership for ${userId} on team ${teamId}`);
  return membership;
}

export default async ({ req, res, log, error }) => {
  const client = new Client()
    .setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT)
    .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
    .setKey(req.headers['x-appwrite-key'] ?? '');

  const users = new Users(client);
  const teams = new Teams(client);
  const tablesDB = new TablesDB(client);

  try {
    await assertCallerIsAdmin(users, req);

    const body = req.bodyJson ?? {};
    const teamId = typeof body.teamId === 'string' ? body.teamId.trim() : '';
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const displayName =
      typeof body.displayName === 'string' && body.displayName.trim()
        ? body.displayName.trim()
        : '';
    const password = typeof body.password === 'string' ? body.password : '';

    if (!teamId) {
      return res.json({ success: false, message: 'teamId is required' }, 400);
    }
    if (!email || !email.includes('@')) {
      return res.json({ success: false, message: 'Valid email is required' }, 400);
    }

    await teams.get({ teamId });

    let user = await findUserByEmail(users, email);
    let createdUser = false;

    if (!user) {
      if (password.length < MIN_PASSWORD_LENGTH) {
        return res.json(
          {
            success: false,
            message: `password is required (min ${MIN_PASSWORD_LENGTH} chars) for new users`,
          },
          400,
        );
      }
      user = await users.create({
        userId: ID.unique(),
        email,
        password,
        name: displayName || email,
      });
      createdUser = true;
      log(`Created user ${user.$id} for ${email}`);
    } else if (displayName && displayName !== user.name) {
      user = await users.updateName({ userId: user.$id, name: displayName });
    }

    // Client portal access is label-gated: clear admin/developer so resolveAccess uses client path.
    await users.updateLabels({ userId: user.$id, labels: [] });

    const resolvedDisplayName = displayName || user.name || email;
    await upsertUserProfile(tablesDB, {
      userId: user.$id,
      displayName: resolvedDisplayName,
      email: user.email || email,
    });

    const membership = await ensureTeamMembership(teams, {
      teamId,
      userId: user.$id,
      email,
      log,
    });

    return res.json({
      success: true,
      userId: user.$id,
      membershipId: membership.$id,
      createdUser,
      membershipUserId: membership.userId,
    });
  } catch (err) {
    const status = err.status ?? err.code ?? 500;
    error(`add-team-client failed: ${err.message}`);
    return res.json({ success: false, message: err.message }, status);
  }
};
