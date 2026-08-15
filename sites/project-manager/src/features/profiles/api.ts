import { Query } from 'appwrite';
import { tablesDB } from '../../appwrite/client';
import { DATABASE_ID, TABLES } from '../../appwrite/constants';
import type {
  AdminUser,
  AdminUserCompany,
  AdminUserMembership,
  GlobalRole,
  UserProfileRow,
} from '../../appwrite/types';
import {
  deleteAdminUser,
  getAdminUser,
  listAdminUsers,
  manageUserRole,
  revokeTeamMember,
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

function profileToAdminUser(
  profile: UserProfileRow,
  companies: AdminUserCompany[] = [],
  memberships: AdminUserMembership[] = [],
): AdminUser {
  return {
    userId: profile.userId,
    email: profile.email,
    displayName: profile.displayName,
    role: profile.globalRole,
    companies,
    memberships,
    profileId: profile.$id,
  };
}

/**
 * Goes through the server function (not the fast TablesDB profiles path) because account
 * status and last-login only live on the Auth user record, not in our profile rows.
 */
export async function fetchAdminUsers(): Promise<AdminUser[]> {
  return listAdminUsers();
}

/**
 * Profile from TablesDB; company links via server function (API key).
 * Client teams.listMemberships 404s when admin is not a team member.
 */
export async function fetchAdminUser(userId: string): Promise<AdminUser> {
  const profile = await getUserProfile(userId);
  if (!profile) {
    throw new Error('User profile not found');
  }

  try {
    const remote = await getAdminUser(userId);
    return profileToAdminUser(profile, remote.companies, remote.memberships);
  } catch {
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

export async function removeUserTeamMembership(teamId: string, membershipId: string) {
  return revokeTeamMember(teamId, membershipId);
}
