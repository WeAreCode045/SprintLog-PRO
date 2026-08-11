import { Client, Users, Teams, TablesDB, Query, ID, Permission, Role } from 'node-appwrite';

const DATABASE_ID = 'main';
const TABLES = {
  companies: 'companies',
  userProfiles: 'userProfiles',
};
const ADMIN_LABEL = 'admin';
const DEVELOPER_LABEL = 'developer';
const TEAM_CLIENT_ROLE = 'client';

const VALID_ROLES = new Set(['admin', 'developer', 'client']);
const VALID_ACTIONS = new Set([
  'setRole',
  'list',
  'get',
  'update',
  'delete',
  'listTeamMembers',
  'revokeTeamMember',
  'inviteTeamMember',
  'syncProfilePermissions',
]);

function labelsForRole(role) {
  switch (role) {
    case 'admin':
      return [ADMIN_LABEL];
    case 'developer':
      return [DEVELOPER_LABEL];
    case 'client':
      return [];
    default: {
      const _exhaustive = role;
      throw new Error(`Unsupported role: ${_exhaustive}`);
    }
  }
}

function roleFromLabels(labels = []) {
  if (labels.includes(ADMIN_LABEL)) return 'admin';
  if (labels.includes(DEVELOPER_LABEL)) return 'developer';
  return 'client';
}

function userProfilePermissions(userId, globalRole = 'client') {
  const permissions = [
    Permission.read(Role.user(userId)),
    Permission.update(Role.user(userId)),
    Permission.read(Role.label(ADMIN_LABEL)),
    Permission.update(Role.label(ADMIN_LABEL)),
    Permission.delete(Role.label(ADMIN_LABEL)),
  ];
  // Staff display names must be readable by clients (assignees, timesheets, project info).
  if (globalRole === 'admin' || globalRole === 'developer') {
    permissions.push(Permission.read(Role.users()));
  }
  return permissions;
}

async function assertCallerIsAdmin(users, req) {
  const callerId = req.headers['x-appwrite-user-id'];
  if (!callerId) {
    // Server/API-key executions (CLI deploy sync) have no user header.
    if (req.headers['x-appwrite-key']) {
      return null;
    }
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

const PAGE_SIZE = 100;
const MAX_PAGES = 50;

async function paginate(fetchPage) {
  const items = [];
  let cursor = undefined;
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const batch = await fetchPage(cursor);
    items.push(...batch);
    if (batch.length < PAGE_SIZE) break;
    cursor = batch[batch.length - 1].$id;
  }
  return items;
}

async function listAllCompanies(tablesDB) {
  return paginate(async (cursor) => {
    const queries = [Query.limit(PAGE_SIZE)];
    if (cursor) queries.push(Query.cursorAfter(cursor));
    const result = await tablesDB.listRows({
      databaseId: DATABASE_ID,
      tableId: TABLES.companies,
      queries,
    });
    return result.rows ?? [];
  });
}

async function listAllAppwriteUsers(users) {
  return paginate(async (cursor) => {
    const queries = [Query.limit(PAGE_SIZE)];
    if (cursor) queries.push(Query.cursorAfter(cursor));
    const result = await users.list({ queries });
    return result.users ?? [];
  });
}

async function listAllProfiles(tablesDB) {
  return paginate(async (cursor) => {
    const queries = [Query.limit(PAGE_SIZE)];
    if (cursor) queries.push(Query.cursorAfter(cursor));
    const result = await tablesDB.listRows({
      databaseId: DATABASE_ID,
      tableId: TABLES.userProfiles,
      queries,
    });
    return result.rows ?? [];
  });
}

async function listTeamMemberships(teams, teamId) {
  return paginate(async (cursor) => {
    const queries = [Query.limit(PAGE_SIZE)];
    if (cursor) queries.push(Query.cursorAfter(cursor));
    const result = await teams.listMemberships({ teamId, queries });
    return result.memberships ?? [];
  });
}

async function handleListTeamMembers(teams, body) {
  const teamId = typeof body.teamId === 'string' ? body.teamId.trim() : '';
  if (!teamId) {
    const err = new Error('teamId is required');
    err.status = 400;
    throw err;
  }
  await teams.get({ teamId });
  const memberships = await listTeamMemberships(teams, teamId);
  return { success: true, memberships };
}

async function handleRevokeTeamMember(teams, body, log) {
  const teamId = typeof body.teamId === 'string' ? body.teamId.trim() : '';
  const membershipId = typeof body.membershipId === 'string' ? body.membershipId.trim() : '';
  if (!teamId || !membershipId) {
    const err = new Error('teamId and membershipId are required');
    err.status = 400;
    throw err;
  }
  await teams.deleteMembership({ teamId, membershipId });
  log(`Revoked membership ${membershipId} from team ${teamId}`);
  return { success: true };
}

async function handleInviteTeamMember(teams, body, log) {
  const teamId = typeof body.teamId === 'string' ? body.teamId.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const url = typeof body.url === 'string' ? body.url.trim() : '';
  if (!teamId || !email || !url) {
    const err = new Error('teamId, email and url are required');
    err.status = 400;
    throw err;
  }
  const membership = await teams.createMembership({
    teamId,
    roles: [TEAM_CLIENT_ROLE],
    email,
    url,
  });
  log(`Invited ${email} to team ${teamId}`);
  return { success: true, membership };
}

async function upsertUserProfile(tablesDB, { userId, displayName, email, globalRole }) {
  const existing = await tablesDB.listRows({
    databaseId: DATABASE_ID,
    tableId: TABLES.userProfiles,
    queries: [Query.equal('userId', userId), Query.limit(1)],
  });

  const data = {
    userId,
    displayName,
    email,
    globalRole,
  };
  const permissions = userProfilePermissions(userId, globalRole);

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

async function deleteUserProfile(tablesDB, userId) {
  const existing = await tablesDB.listRows({
    databaseId: DATABASE_ID,
    tableId: TABLES.userProfiles,
    queries: [Query.equal('userId', userId), Query.limit(10)],
  });
  for (const row of existing.rows) {
    await tablesDB.deleteRow({
      databaseId: DATABASE_ID,
      tableId: TABLES.userProfiles,
      rowId: row.$id,
    });
  }
}

async function syncClientCompanies(teams, users, { userId, companyTeamIds, allCompanyTeamIds, log }) {
  const desired = new Set(companyTeamIds);
  const companyTeamIdSet = new Set(allCompanyTeamIds);
  const membershipsResult = await users.listMemberships({
    userId,
    queries: [Query.limit(100)],
  });
  const current = membershipsResult.memberships ?? [];

  for (const membership of current) {
    if (!membership.teamId || !companyTeamIdSet.has(membership.teamId)) continue;
    if (desired.has(membership.teamId)) {
      desired.delete(membership.teamId);
      continue;
    }
    await teams.deleteMembership({
      teamId: membership.teamId,
      membershipId: membership.$id,
    });
    log(`Removed ${userId} from team ${membership.teamId}`);
  }

  for (const teamId of desired) {
    await teams.createMembership({
      teamId,
      roles: [TEAM_CLIENT_ROLE],
      userId,
    });
    log(`Added ${userId} to team ${teamId}`);
  }
}

function toAdminUser(user, profile, companies = []) {
  const role =
    profile?.globalRole && VALID_ROLES.has(profile.globalRole)
      ? profile.globalRole
      : roleFromLabels(user.labels ?? []);
  return {
    userId: user.$id,
    email: user.email || profile?.email || '',
    displayName: profile?.displayName || user.name || user.email || user.$id,
    role,
    companies,
    profileId: profile?.$id ?? null,
  };
}

async function handleList(users, tablesDB, log) {
  const startedAt = Date.now();
  // Single page, no Query helpers — avoids hangs seen with paginated users.list.
  const usersResult = await users.list();
  const appwriteUsers = usersResult.users ?? [];
  log(`users.list returned ${appwriteUsers.length}/${usersResult.total ?? '?'} in ${Date.now() - startedAt}ms`);

  const [profiles, companies] = await Promise.all([listAllProfiles(tablesDB), listAllCompanies(tablesDB)]);
  const profileByUserId = new Map(profiles.map((profile) => [profile.userId, profile]));
  const companyByTeamId = new Map(companies.map((company) => [company.teamId, company]));

  const adminUsers = await Promise.all(
    appwriteUsers.map(async (user) => {
      let profile = profileByUserId.get(user.$id);
      const role = profile?.globalRole && VALID_ROLES.has(profile.globalRole)
        ? profile.globalRole
        : roleFromLabels(user.labels ?? []);
      const displayName = profile?.displayName || user.name || user.email || user.$id;
      const email = user.email || profile?.email || '';

      if (!profile) {
        const profileId = await upsertUserProfile(tablesDB, {
          userId: user.$id,
          displayName,
          email,
          globalRole: role,
        });
        profile = {
          $id: profileId,
          userId: user.$id,
          displayName,
          email,
          globalRole: role,
        };
      }

      let linkedCompanies = [];
      if (role === 'client') {
        const membershipsResult = await users.listMemberships({
          userId: user.$id,
          queries: [Query.limit(100)],
        });
        for (const membership of membershipsResult.memberships ?? []) {
          if (!membership.teamId || membership.confirm === false) continue;
          const company = companyByTeamId.get(membership.teamId);
          if (company) {
            linkedCompanies.push({ companyId: company.$id, teamId: company.teamId, name: company.name });
          }
        }
      }

      return toAdminUser(user, profile, linkedCompanies);
    }),
  );

  adminUsers.sort((left, right) =>
    left.displayName.localeCompare(right.displayName, undefined, { sensitivity: 'base' }),
  );

  log(`Listed ${adminUsers.length} users in ${Date.now() - startedAt}ms`);
  return { success: true, users: adminUsers };
}

async function handleGet(users, tablesDB, body, log) {
  const userId = typeof body.userId === 'string' ? body.userId.trim() : '';
  if (!userId) {
    const err = new Error('userId is required');
    err.status = 400;
    throw err;
  }

  const startedAt = Date.now();
  const [user, profileResult, companies, membershipsResult] = await Promise.all([
    users.get({ userId }),
    tablesDB.listRows({
      databaseId: DATABASE_ID,
      tableId: TABLES.userProfiles,
      queries: [Query.equal('userId', userId), Query.limit(1)],
    }),
    listAllCompanies(tablesDB),
    users.listMemberships({ userId, queries: [Query.limit(100)] }),
  ]);
  const profile = profileResult.rows[0];
  const companyByTeamId = new Map(companies.map((company) => [company.teamId, company]));
  const linkedCompanies = [];
  for (const membership of membershipsResult.memberships ?? []) {
    if (!membership.teamId || membership.confirm === false) continue;
    const company = companyByTeamId.get(membership.teamId);
    if (company) {
      linkedCompanies.push({
        companyId: company.$id,
        teamId: company.teamId,
        name: company.name,
      });
    }
  }
  log(`get user ${userId} with ${linkedCompanies.length} companies in ${Date.now() - startedAt}ms`);
  return { success: true, user: toAdminUser(user, profile, linkedCompanies) };
}

async function handleUpdate(users, teams, tablesDB, body, log) {
  const userId = typeof body.userId === 'string' ? body.userId.trim() : '';
  if (!userId) {
    const err = new Error('userId is required');
    err.status = 400;
    throw err;
  }

  const targetUser = await users.get({ userId });
  const profile = (
    await tablesDB.listRows({
      databaseId: DATABASE_ID,
      tableId: TABLES.userProfiles,
      queries: [Query.equal('userId', userId), Query.limit(1)],
    })
  ).rows[0];

  const nextRole =
    typeof body.role === 'string' && VALID_ROLES.has(body.role)
      ? body.role
      : profile?.globalRole && VALID_ROLES.has(profile.globalRole)
        ? profile.globalRole
        : roleFromLabels(targetUser.labels ?? []);

  const nextDisplayName =
    typeof body.displayName === 'string' && body.displayName.trim()
      ? body.displayName.trim()
      : profile?.displayName || targetUser.name || targetUser.email || userId;

  const nextEmail =
    typeof body.email === 'string' && body.email.trim()
      ? body.email.trim().toLowerCase()
      : targetUser.email || profile?.email || '';

  if (nextEmail && nextEmail !== targetUser.email) {
    await users.updateEmail({ userId, email: nextEmail });
  }
  if (nextDisplayName !== targetUser.name) {
    await users.updateName({ userId, name: nextDisplayName });
  }

  await users.updateLabels({ userId, labels: labelsForRole(nextRole) });
  await upsertUserProfile(tablesDB, {
    userId,
    displayName: nextDisplayName,
    email: nextEmail,
    globalRole: nextRole,
  });

  const companies = await listAllCompanies(tablesDB);
  const allCompanyTeamIds = companies.map((company) => company.teamId);

  if (nextRole === 'client') {
    const companyIds = Array.isArray(body.companyIds)
      ? body.companyIds.filter((id) => typeof id === 'string' && id.trim())
      : null;

    if (companyIds) {
      const byId = new Map(companies.map((company) => [company.$id, company]));
      const teamIds = [];
      for (const companyId of companyIds) {
        const company = byId.get(companyId);
        if (!company) {
          const err = new Error(`Unknown companyId: ${companyId}`);
          err.status = 400;
          throw err;
        }
        teamIds.push(company.teamId);
      }
      await syncClientCompanies(teams, users, {
        userId,
        companyTeamIds: teamIds,
        allCompanyTeamIds,
        log,
      });
    }
  } else {
    // Non-clients should not stay on company teams as portal clients.
    await syncClientCompanies(teams, users, {
      userId,
      companyTeamIds: [],
      allCompanyTeamIds,
      log,
    });
  }

  return { success: true };
}

async function handleDelete(users, tablesDB, body, callerId, log) {
  const userId = typeof body.userId === 'string' ? body.userId.trim() : '';
  if (!userId) {
    const err = new Error('userId is required');
    err.status = 400;
    throw err;
  }
  if (userId === callerId) {
    const err = new Error('You cannot delete your own account');
    err.status = 400;
    throw err;
  }

  await deleteUserProfile(tablesDB, userId);
  await users.delete({ userId });
  log(`Deleted user ${userId}`);
  return { success: true };
}

async function handleSetRole(users, tablesDB, body, log) {
  const userId = typeof body.userId === 'string' ? body.userId.trim() : '';
  const role = body.role;
  if (!userId) {
    const err = new Error('userId is required');
    err.status = 400;
    throw err;
  }
  if (!VALID_ROLES.has(role)) {
    const err = new Error("role must be 'admin', 'developer', or 'client'");
    err.status = 400;
    throw err;
  }

  const targetUser = await users.get({ userId });
  await users.updateLabels({ userId, labels: labelsForRole(role) });

  const resolvedDisplayName =
    (typeof body.displayName === 'string' && body.displayName.trim()) ||
    targetUser.name ||
    targetUser.email ||
    userId;
  const resolvedEmail =
    (typeof body.email === 'string' && body.email.trim()) || targetUser.email || '';

  await upsertUserProfile(tablesDB, {
    userId,
    displayName: resolvedDisplayName,
    email: resolvedEmail,
    globalRole: role,
  });
  log(`Updated labels for ${userId} to ${role}`);
  return { success: true };
}

function parseBody(req) {
  const raw = req.bodyJson ?? req.body ?? {};
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw || '{}');
    } catch {
      return {};
    }
  }
  if (raw && typeof raw === 'object') {
    return raw;
  }
  return {};
}

async function handleSyncProfilePermissions(tablesDB, log) {
  const profiles = await listAllProfiles(tablesDB);
  let updated = 0;
  for (const profile of profiles) {
    const globalRole = VALID_ROLES.has(profile.globalRole) ? profile.globalRole : 'client';
    await tablesDB.updateRow({
      databaseId: DATABASE_ID,
      tableId: TABLES.userProfiles,
      rowId: profile.$id,
      permissions: userProfilePermissions(profile.userId, globalRole),
    });
    updated += 1;
  }
  log(`Synced permissions on ${updated} user profiles`);
  return { success: true, updated };
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
    const body = parseBody(req);
    const action = body.action;
    log(`action=${action}`);

    if (!VALID_ACTIONS.has(action)) {
      return res.json({ success: false, message: 'Unsupported action' }, 400);
    }

    const allowApiKeySync =
      action === 'syncProfilePermissions' && Boolean(req.headers['x-appwrite-key']);
    const callerId = allowApiKeySync ? null : await assertCallerIsAdmin(users, req);

    switch (action) {
      case 'list': {
        const payload = await handleList(users, tablesDB, log);
        return res.json(payload);
      }
      case 'get': {
        const payload = await handleGet(users, tablesDB, body, log);
        return res.json(payload);
      }
      case 'update': {
        const payload = await handleUpdate(users, teams, tablesDB, body, log);
        return res.json(payload);
      }
      case 'delete': {
        const payload = await handleDelete(users, tablesDB, body, callerId, log);
        return res.json(payload);
      }
      case 'setRole': {
        const payload = await handleSetRole(users, tablesDB, body, log);
        return res.json(payload);
      }
      case 'listTeamMembers': {
        const payload = await handleListTeamMembers(teams, body);
        return res.json(payload);
      }
      case 'revokeTeamMember': {
        const payload = await handleRevokeTeamMember(teams, body, log);
        return res.json(payload);
      }
      case 'inviteTeamMember': {
        const payload = await handleInviteTeamMember(teams, body, log);
        return res.json(payload);
      }
      case 'syncProfilePermissions': {
        const payload = await handleSyncProfilePermissions(tablesDB, log);
        return res.json(payload);
      }
      default: {
        const _exhaustive = action;
        return res.json({ success: false, message: `Unsupported action: ${_exhaustive}` }, 400);
      }
    }
  } catch (err) {
    const status = err.status ?? err.code ?? 500;
    error(`manage-user-role failed: ${err.message}`);
    return res.json({ success: false, message: err.message }, status);
  }
};
