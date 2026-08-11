import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../lib/queryKeys';
import {
  assignDeveloper,
  listAssignmentsByProject,
  listAssignmentsByUser,
  unassignDeveloper,
} from './api';

export function useProjectAssignments(projectId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.assignmentsByProject(projectId ?? ''),
    queryFn: () => listAssignmentsByProject(projectId!),
    enabled: Boolean(projectId),
  });
}

export function useUserAssignments(userId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.assignmentsByUser(userId ?? ''),
    queryFn: () => listAssignmentsByUser(userId!),
    enabled: Boolean(userId),
  });
}

export function useAssignDeveloper(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: assignDeveloper,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.assignmentsByProject(projectId) });
      void queryClient.invalidateQueries({ queryKey: ['assignments'] });
      void queryClient.invalidateQueries({ queryKey: queryKeys.project(projectId) });
    },
  });
}

export function useUnassignDeveloper(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: unassignDeveloper,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.assignmentsByProject(projectId) });
      void queryClient.invalidateQueries({ queryKey: ['assignments'] });
    },
  });
}
