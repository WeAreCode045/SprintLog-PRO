import {
  addTeamClient,
  inviteTeamMember,
  listTeamMembers,
  resendTeamInvite,
  revokeTeamMember,
} from '../../lib/functions';
import type { TeamMemberRole } from '../../appwrite/types';

export async function listMembers(teamId: string) {
  return listTeamMembers(teamId);
}

export async function inviteMember(teamId: string, email: string, _role: TeamMemberRole = 'client') {
  const redirectUrl = `${window.location.origin}/accept-invite`;
  const result = await inviteTeamMember(teamId, email, redirectUrl);
  return result.membership;
}

export async function addClientDirect(
  teamId: string,
  input: { email: string; displayName?: string; password?: string },
) {
  return addTeamClient({
    teamId,
    email: input.email,
    displayName: input.displayName,
    password: input.password,
  });
}

export async function revokeMember(teamId: string, membershipId: string) {
  await revokeTeamMember(teamId, membershipId);
}

export async function resendInvite(teamId: string, membershipId: string, email: string) {
  const redirectUrl = `${window.location.origin}/accept-invite`;
  const result = await resendTeamInvite(teamId, membershipId, email, redirectUrl);
  return result.membership;
}
