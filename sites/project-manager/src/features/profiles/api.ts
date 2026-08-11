import { Query } from 'appwrite';
import { tablesDB } from '../../appwrite/client';
import { DATABASE_ID, TABLES } from '../../appwrite/constants';
import type { AdminUser, AdminUserCompany, GlobalRole, UserProfileRow } from '../../appwrite/types';
import {
  deleteAdminUser,
  getAdminUser,
  listAdminUsers,
  manageUserRole,
  updateAdminUser,
} from '../../lib/functions';

export async function listUserProfiles() {
  const result = await tablesDB.listRows<UserProfileRow>({
    databaseId: DATABASE_ID,
    tableId: TABLES.userProfiles,
    queries: [Query.orderAsc('displayName'), Query.limit(500)],
  });
  return result.rows;
}

export async function listDeveloperProfiles() {
  const result = await tablesDB.listRows<UserProfileRow>({
    databaseId: DATABASE_ID,
    tableId: TABLES.userProfiles,
    queries: [
      Query.equal('globalRole', ['admin', 'developer']),
      Query.orderAsc('displayName'),
      Query.limit(200),
    ],
  });
  return result.rows;
}

export async function getUserProfile(userId: string) {
  const result = await tablesDB.listRows<UserProfileRow>({
    databaseId: DATABASE_ID,
    tableId: TABLES.userProfiles,
    queries: [Query.equal('userId', userId), Query.limit(1)],
  });
  return result.rows[0] ?? null;
}

export async function setUserRole(input: {
  userId: string;
  role: GlobalRole;
  displayName?: string;
  email?: string;
}) {
  return manageUserRole({ action: 'setRole', ...input });
}

function profileToAdminUser(profile: UserProfileRow, companies: AdminUserCompany[] = []): AdminUser {
  return {
    userId: profile.userId,
    email: profile.email,
    displayName: profile.displayName,
    role: profile.globalRole,
    companies,
    profileId: profile.$id,
  };
}

/**
 * Prefer fast TablesDB profiles. If empty, bootstrap once from Auth via function
 * (also seeds missing profiles).
 */
export async function fetchAdminUsers(): Promise<AdminUser[]> {
  const profiles = await listUserProfiles();
  if (profiles.length > 0) {
    return profiles.map((profile) => profileToAdminUser(profile));
  }
  return listAdminUsers();
}

/**
 * Profile from TablesDB; company links via server function (API key).
 * Client teams.listMemberships 404s when admin is not a team member.
 */
export async function fetchAdminUser(userId: string): Promise<AdminUser> {
  const startedAt = Date.now();
  // #region agent log
  fetch('http://127.0.0.1:7737/ingest/b4987c15-427e-45cf-9088-9b18f5a7c074', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '40eb62' },
    body: JSON.stringify({
      sessionId: '40eb62',
      runId: 'post-fix',
      hypothesisId: 'B',
      location: 'profiles/api.ts:fetchAdminUser:start',
      message: 'fetchAdminUser start',
      data: { userId },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion

  const profile = await getUserProfile(userId);
  // #region agent log
  fetch('http://127.0.0.1:7737/ingest/b4987c15-427e-45cf-9088-9b18f5a7c074', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '40eb62' },
    body: JSON.stringify({
      sessionId: '40eb62',
      runId: 'post-fix',
      hypothesisId: 'B',
      location: 'profiles/api.ts:fetchAdminUser:mid',
      message: 'profile loaded',
      data: { hasProfile: Boolean(profile), elapsedMs: Date.now() - startedAt },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion

  if (!profile) {
    throw new Error('User profile not found');
  }

  try {
    const remote = await getAdminUser(userId);
    // #region agent log
    fetch('http://127.0.0.1:7737/ingest/b4987c15-427e-45cf-9088-9b18f5a7c074', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '40eb62' },
      body: JSON.stringify({
        sessionId: '40eb62',
        runId: 'post-fix',
        hypothesisId: 'B',
        location: 'profiles/api.ts:fetchAdminUser:end',
        message: 'fetchAdminUser success via function get',
        data: {
          linkedCount: remote.companies.length,
          source: 'function',
          elapsedMs: Date.now() - startedAt,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
    return profileToAdminUser(profile, remote.companies);
  } catch (error) {
    // #region agent log
    fetch('http://127.0.0.1:7737/ingest/b4987c15-427e-45cf-9088-9b18f5a7c074', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '40eb62' },
      body: JSON.stringify({
        sessionId: '40eb62',
        runId: 'post-fix',
        hypothesisId: 'B',
        location: 'profiles/api.ts:fetchAdminUser:fallback',
        message: 'function get failed; profile-only fallback',
        data: {
          error: error instanceof Error ? error.message : 'unknown',
          elapsedMs: Date.now() - startedAt,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
    return profileToAdminUser(profile, []);
  }
}

export async function saveAdminUser(input: {
  userId: string;
  displayName: string;
  email: string;
  role: GlobalRole;
  companyIds?: string[];
}) {
  return updateAdminUser({
    userId: input.userId,
    displayName: input.displayName,
    email: input.email,
    role: input.role,
    ...(input.companyIds !== undefined
      ? { companyIds: input.role === 'client' ? input.companyIds : [] }
      : {}),
  });
}

export async function removeAdminUser(userId: string) {
  return deleteAdminUser(userId);
}
