import {
  addTeamClient,
  inviteTeamMember,
  listTeamMembers,
  revokeTeamMember,
} from '../../lib/functions';
import type { TeamMemberRole } from '../../appwrite/types';

export async function listMembers(teamId: string) {
  // #region agent log
  fetch('http://127.0.0.1:7737/ingest/b4987c15-427e-45cf-9088-9b18f5a7c074', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '40eb62' },
    body: JSON.stringify({
      sessionId: '40eb62',
      runId: 'post-fix',
      hypothesisId: 'B',
      location: 'invites/api.ts:listMembers',
      message: 'listMembers via function',
      data: { teamId },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion
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
