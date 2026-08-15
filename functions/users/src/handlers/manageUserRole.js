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
  'resendTeamInvite',
  'syncProfilePermissions',
]);

// Clients may call these for a team they're a confirmed member of (viewing/inviting accounts
// on their own company) — every other action still requires the admin label.
const TEAM_SCOPED_ACTIONS = new Set(['listTeamMembers', 'inviteTeamMember', 'resendTeamInvite']);

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

/**
 * For actions a client may perform on their own company's team (viewing/inviting accounts) —
 * admins pass automatically; anyone else must be a confirmed member of the target team.
 */
async function assertCallerCanManageTeam(users, req, teamId) {
  const callerId = req.headers['x-appwrite-user-id'];
  if (!callerId) {
    const err = new Error('Missing x-appwrite-user-id header');
    err.status = 401;
    throw err;
  }
  if (!teamId) {
    const err = new Error('teamId is required');
    err.status = 400;
    throw err;
  }
  const caller = await users.get({ userId: callerId });
  const labels = caller.labels ?? [];
  if (labels.includes(ADMIN_LABEL)) {
    return callerId;
  }
  const membershipsResult = await users.listMemberships({
    userId: callerId,
    queries: [Query.limit(100)],
  });
  const isMember = (membershipsResult.memberships ?? []).some(
    (membership) => membership.teamId === teamId && membership.confirm !== false,
  );
  if (!isMember) {
    const err = new Error('You are not a member of this team');
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

async function handleListTeamMembers(teams, tablesDB, body, log) {
  const teamId = typeof body.teamId === 'string' ? body.teamId.trim() : '';
  if (!teamId) {
    const err = new Error('teamId is required');
    err.status = 400;
    throw err;
  }
  await teams.get({ teamId });
  const memberships = await listTeamMemberships(teams, teamId);

  const userIds = memberships.map((membership) => membership.userId).filter(Boolean);
  const profiles = userIds.length
    ? (
        await tablesDB.listRows({
          databaseId: DATABASE_ID,
          tableId: TABLES.userProfiles,
          queries: [Query.equal('userId', userIds), Query.limit(userIds.length)],
        })
      ).rows
    : [];
  const roleByUserId = new Map(profiles.map((profile) => [profile.userId, profile.globalRole]));
  // Accounts tab is for clients only — staff (admin/developer) team memberships stay hidden here.
  const clientMemberships = memberships.filter((membership) => {
    const role = roleByUserId.get(membership.userId);
    return role !== 'admin' && role !== 'developer';
  });

  log(
    `listTeamMembers ${teamId}: ${clientMemberships.length}/${memberships.length} memberships (staff filtered)`,
  );
  return { success: true, memberships: clientMemberships };
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

async function handleInviteTeamMember(teams, tablesDB, body, log) {
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
  // Appwrite provisions the underlying Users record immediately on invite (before acceptance),
  // so the profile row (which drives the Klantaccounts list) needs to be created now too —
  // otherwise the invited client never shows up until they accept and someone else edits them.
  if (membership.userId) {
    await upsertUserProfile(tablesDB, {
      userId: membership.userId,
      displayName: membership.userName || email,
      email,
      globalRole: TEAM_CLIENT_ROLE,
    });
  }
  log(`Invited ${email} to team ${teamId}`);
  return { success: true, membership };
}

/** A still-pending (unconfirmed) membership can't just be re-invited — Appwrite rejects
 * createMembership for a user already in the team, confirmed or not. So a resend deletes the
 * stale invite first, then re-runs the normal invite flow to issue a fresh one. */
async function handleResendTeamInvite(teams, tablesDB, body, log) {
  const teamId = typeof body.teamId === 'string' ? body.teamId.trim() : '';
  const membershipId = typeof body.membershipId === 'string' ? body.membershipId.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const url = typeof body.url === 'string' ? body.url.trim() : '';
  if (!teamId || !membershipId || !email || !url) {
    const err = new Error('teamId, membershipId, email and url are required');
    err.status = 400;
    throw err;
  }
  await teams.deleteMembership({ teamId, membershipId });
  log(`Deleted pending membership ${membershipId} from team ${teamId} for resend`);
  return handleInviteTeamMember(teams, tablesDB, { teamId, email, url }, log);
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

function toAdminUser(user, profile, companies = [], memberships = []) {
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
    memberships,
    profileId: profile?.$id ?? null,
    status: user.status ?? true,
    lastLoginAt: user.accessedAt || null,
  };
}

function toAdminUserMemberships(memberships = []) {
  return memberships
    .filter((membership) => membership.teamId)
    .map((membership) => ({
      membershipId: membership.$id,
      teamId: membership.teamId,
      teamName: membership.teamName || membership.teamId,
      roles: membership.roles ?? [],
      confirm: membership.confirm !== false,
    }));
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
  const memberships = toAdminUserMemberships(membershipsResult.memberships ?? []);
  log(`get user ${userId} with ${linkedCompanies.length} companies, ${memberships.length} memberships in ${Date.now() - startedAt}ms`);
  return { success: true, user: toAdminUser(user, profile, linkedCompanies, memberships) };
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

const FUNCTION_RESULTS_TABLE = 'functionResults';

/**
 * Appwrite's GET /executions/{id} (used by the client's async-execution poll) never returns
 * responseBody — only the original synchronous createExecution call does, and synchronous
 * execution is unreliable on this project (consistently stalls ~30s). So the client instead
 * polls execution status (which IS reliable) and reads the actual payload from here directly.
 */
async function persistResult(tablesDB, requestId, callerId, payload) {
  if (!requestId) return;
  const permissions = callerId
    ? [Permission.read(Role.user(callerId)), Permission.delete(Role.user(callerId))]
    : [Permission.read(Role.label(ADMIN_LABEL)), Permission.delete(Role.label(ADMIN_LABEL))];
  await tablesDB.createRow({
    databaseId: DATABASE_ID,
    tableId: FUNCTION_RESULTS_TABLE,
    rowId: requestId,
    data: { data: JSON.stringify(payload) },
    permissions,
  });
}

export default async ({ req, res, log, error }) => {
  const client = new Client()
    .setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT)
    .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
    .setKey(req.headers['x-appwrite-key'] ?? '');

  const users = new Users(client);
  const teams = new Teams(client);
  const tablesDB = new TablesDB(client);

  let callerId = null;
  let requestId = null;

  try {
    const body = parseBody(req);
    const action = body.action;
    requestId = typeof body.requestId === 'string' ? body.requestId.trim() || null : null;
    log(`action=${action}`);

    if (!VALID_ACTIONS.has(action)) {
      return res.json({ success: false, message: 'Unsupported action' }, 400);
    }

    const allowApiKeySync =
      action === 'syncProfilePermissions' && Boolean(req.headers['x-appwrite-key']);
    if (TEAM_SCOPED_ACTIONS.has(action)) {
      const teamId = typeof body.teamId === 'string' ? body.teamId.trim() : '';
      callerId = await assertCallerCanManageTeam(users, req, teamId);
    } else {
      callerId = allowApiKeySync ? null : await assertCallerIsAdmin(users, req);
    }

    async function respond(payload, status) {
      await persistResult(tablesDB, requestId, callerId, payload);
      return res.json(payload, status);
    }

    switch (action) {
      case 'list': {
        const payload = await handleList(users, tablesDB, log);
        return respond(payload);
      }
      case 'get': {
        const payload = await handleGet(users, tablesDB, body, log);
        return respond(payload);
      }
      case 'update': {
        const payload = await handleUpdate(users, teams, tablesDB, body, log);
        return respond(payload);
      }
      case 'delete': {
        const payload = await handleDelete(users, tablesDB, body, callerId, log);
        return respond(payload);
      }
      case 'setRole': {
        const payload = await handleSetRole(users, tablesDB, body, log);
        return respond(payload);
      }
      case 'listTeamMembers': {
        const payload = await handleListTeamMembers(teams, tablesDB, body, log);
        return respond(payload);
      }
      case 'revokeTeamMember': {
        const payload = await handleRevokeTeamMember(teams, body, log);
        return respond(payload);
      }
      case 'inviteTeamMember': {
        const payload = await handleInviteTeamMember(teams, tablesDB, body, log);
        return respond(payload);
      }
      case 'resendTeamInvite': {
        const payload = await handleResendTeamInvite(teams, tablesDB, body, log);
        return respond(payload);
      }
      case 'syncProfilePermissions': {
        const payload = await handleSyncProfilePermissions(tablesDB, log);
        return respond(payload);
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
