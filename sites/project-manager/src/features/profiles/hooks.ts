import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../lib/queryKeys';
import {
  fetchAdminUser,
  fetchAdminUsers,
  getUserProfile,
  listDeveloperProfiles,
  listUserProfiles,
  removeAdminUser,
  removeUserTeamMembership,
  saveAdminUser,
  setUserRole,
} from './api';

export function useUserProfiles(enabled = true) {
  return useQuery({
    queryKey: queryKeys.userProfiles,
    queryFn: listUserProfiles,
    enabled,
  });
}

export function useAdminUsers(enabled = true) {
  return useQuery({
    queryKey: queryKeys.adminUsers,
    queryFn: fetchAdminUsers,
    enabled,
    staleTime: 30_000,
    retry: 1,
  });
}

export function useAdminUser(userId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: queryKeys.adminUser(userId ?? ''),
    queryFn: () => fetchAdminUser(userId!),
    enabled: Boolean(userId) && enabled,
  });
}

export function useDeveloperProfiles(enabled = true) {
  return useQuery({
    queryKey: queryKeys.developers,
    queryFn: listDeveloperProfiles,
    enabled,
  });
}

export function useUserProfile(userId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.userProfile(userId ?? ''),
    queryFn: () => getUserProfile(userId!),
    enabled: Boolean(userId),
  });
}

export function useSetUserRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: setUserRole,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.userProfiles });
      void queryClient.invalidateQueries({ queryKey: queryKeys.adminUsers });
      void queryClient.invalidateQueries({ queryKey: queryKeys.developers });
    },
  });
}

export function useSaveAdminUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: saveAdminUser,
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.userProfiles });
      void queryClient.invalidateQueries({ queryKey: queryKeys.adminUsers });
      void queryClient.invalidateQueries({ queryKey: queryKeys.adminUser(variables.userId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.developers });
      void queryClient.invalidateQueries({ queryKey: ['companies'] });
      void queryClient.invalidateQueries({ queryKey: ['members'] });
    },
  });
}

export function useRevokeUserTeamMembership(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ teamId, membershipId }: { teamId: string; membershipId: string }) =>
      removeUserTeamMembership(teamId, membershipId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.adminUser(userId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.adminUsers });
      void queryClient.invalidateQueries({ queryKey: ['companies'] });
      void queryClient.invalidateQueries({ queryKey: ['members'] });
    },
  });
}

export function useDeleteAdminUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: removeAdminUser,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.userProfiles });
      void queryClient.invalidateQueries({ queryKey: queryKeys.adminUsers });
      void queryClient.invalidateQueries({ queryKey: queryKeys.developers });
    },
  });
}
