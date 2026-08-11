import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../lib/queryKeys';
import {
  createTaskGroup,
  deleteTaskGroup,
  listTaskGroupsByCompany,
  listTaskGroupsByProject,
  renameTaskGroup,
  reorderTaskGroups,
} from './api';

export function useTaskGroupsByProject(projectId: string) {
  return useQuery({
    queryKey: queryKeys.taskGroupsByProject(projectId),
    queryFn: () => listTaskGroupsByProject(projectId),
    enabled: Boolean(projectId),
  });
}

export function useTaskGroupsByCompany(companyId: string) {
  return useQuery({
    queryKey: queryKeys.taskGroupsByCompany(companyId),
    queryFn: () => listTaskGroupsByCompany(companyId),
    enabled: Boolean(companyId),
  });
}

function useInvalidateTaskGroups(companyId: string) {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: ['taskGroups'] });
    void queryClient.invalidateQueries({ queryKey: queryKeys.taskGroupsByCompany(companyId) });
  };
}

export function useCreateTaskGroup(companyId: string) {
  const invalidate = useInvalidateTaskGroups(companyId);
  return useMutation({ mutationFn: createTaskGroup, onSuccess: invalidate });
}

export function useRenameTaskGroup(companyId: string) {
  const invalidate = useInvalidateTaskGroups(companyId);
  return useMutation({
    mutationFn: ({ taskGroupId, name }: { taskGroupId: string; name: string }) => renameTaskGroup(taskGroupId, name),
    onSuccess: invalidate,
  });
}

export function useDeleteTaskGroup(companyId: string) {
  const invalidate = useInvalidateTaskGroups(companyId);
  return useMutation({ mutationFn: (taskGroupId: string) => deleteTaskGroup(taskGroupId), onSuccess: invalidate });
}

export function useReorderTaskGroups(companyId: string) {
  const invalidate = useInvalidateTaskGroups(companyId);
  return useMutation({ mutationFn: reorderTaskGroups, onSuccess: invalidate });
}
