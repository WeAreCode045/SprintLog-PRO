import { Query, ID, Permission, Role } from 'node-appwrite';
import { DATABASE_ID, TABLES } from '../lib/appwrite.js';
import { ADMIN_LABEL, TEAM_CLIENT_ROLE } from '../lib/auth.js';

function userProfilePermissions(userId) {
  return [
    Permission.read(Role.user(userId)),
    Permission.update(Role.user(userId)),
    Permission.read(Role.label(ADMIN_LABEL)),
    Permission.update(Role.label(ADMIN_LABEL)),
    Permission.delete(Role.label(ADMIN_LABEL)),
  ];
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

const MIN_PASSWORD_LENGTH = 8;

export async function handleAddTeamClient({ body, users, teams, tablesDB, log }) {
  const teamId = typeof body.teamId === 'string' ? body.teamId.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const displayName =
    typeof body.displayName === 'string' && body.displayName.trim()
      ? body.displayName.trim()
      : '';
  const password = typeof body.password === 'string' ? body.password : '';

  if (!teamId) {
    const err = new Error('teamId is required');
    err.status = 400;
    throw err;
  }
  if (!email || !email.includes('@')) {
    const err = new Error('Valid email is required');
    err.status = 400;
    throw err;
  }

  await teams.get({ teamId });

  let user = await findUserByEmail(users, email);
  let createdUser = false;

  if (!user) {
    if (password.length < MIN_PASSWORD_LENGTH) {
      const err = new Error(
        `password is required (min ${MIN_PASSWORD_LENGTH} chars) for new users`,
      );
      err.status = 400;
      throw err;
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

  return {
    success: true,
    userId: user.$id,
    membershipId: membership.$id,
    createdUser,
    membershipUserId: membership.userId,
  };
}
