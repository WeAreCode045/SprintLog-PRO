import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../lib/queryKeys';
import { addClientDirect, inviteMember, listMembers, resendInvite, revokeMember } from './api';
import type { TeamMemberRole } from '../../appwrite/types';

export function useMembers(teamId: string) {
  return useQuery({ queryKey: queryKeys.members(teamId), queryFn: () => listMembers(teamId) });
}

export function useInviteMember(teamId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ email, role }: { email: string; role: TeamMemberRole }) => inviteMember(teamId, email, role),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.members(teamId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.userProfiles });
      void queryClient.invalidateQueries({ queryKey: queryKeys.adminUsers });
    },
  });
}

export function useAddClientDirect(teamId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { email: string; displayName?: string; password?: string }) =>
      addClientDirect(teamId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.members(teamId) });
    },
  });
}

export function useRevokeMember(teamId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (membershipId: string) => revokeMember(teamId, membershipId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.members(teamId) });
    },
  });
}

export function useResendInvite(teamId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ membershipId, email }: { membershipId: string; email: string }) =>
      resendInvite(teamId, membershipId, email),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.members(teamId) });
    },
  });
}
