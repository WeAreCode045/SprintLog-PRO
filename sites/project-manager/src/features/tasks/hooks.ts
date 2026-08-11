import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../lib/queryKeys';
import {
  acceptRequestedTask,
  createTask,
  deleteTask,
  listCompletedTasksInRange,
  listTasks,
  listTasksForCompanies,
  listTasksByProject,
  markTaskFinished,
  reopenTask,
  reorderTasks,
  updateOpenTask,
  type CompletedFilters,
  type TaskFilter,
} from './api';

export function useTasks(companyId: string, filter: TaskFilter) {
  return useQuery({
    queryKey: queryKeys.tasksByFilter(companyId, filter),
    queryFn: () => listTasks(companyId, filter),
    enabled: Boolean(companyId),
  });
}

export function useTasksForCompanies(companyIds: string[], filter: TaskFilter) {
  const sortedIds = companyIds.slice().sort();
  return useQuery({
    queryKey: queryKeys.tasksByCompanies(sortedIds, filter),
    queryFn: () => listTasksForCompanies(sortedIds, filter),
    enabled: sortedIds.length > 0,
  });
}

export function useTasksByProject(projectId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.tasksByProject(projectId ?? ''),
    queryFn: () => listTasksByProject(projectId!),
    enabled: Boolean(projectId),
  });
}

export function useCompletedTasksInRange(companyId: string, filters: CompletedFilters) {
  return useQuery({
    queryKey: [
      ...queryKeys.completedTasks(companyId),
      filters.start.toISOString(),
      filters.end.toISOString(),
      filters.projectId,
    ],
    queryFn: () => listCompletedTasksInRange(companyId, filters),
    enabled: Boolean(companyId),
  });
}

function useInvalidateTasks(_companyId: string) {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: ['tasks'] });
  };
}

export function useCreateTask(companyId: string) {
  const invalidate = useInvalidateTasks(companyId);
  return useMutation({ mutationFn: createTask, onSuccess: invalidate });
}

export function useUpdateOpenTask(companyId: string) {
  const invalidate = useInvalidateTasks(companyId);
  return useMutation({
    mutationFn: ({
      taskId,
      data,
      access,
    }: {
      taskId: string;
      data: Parameters<typeof updateOpenTask>[1];
      access?: Parameters<typeof updateOpenTask>[2];
    }) => updateOpenTask(taskId, data, access),
    onSuccess: invalidate,
  });
}

export function useDeleteTask(companyId: string) {
  const invalidate = useInvalidateTasks(companyId);
  return useMutation({ mutationFn: (taskId: string) => deleteTask(taskId), onSuccess: invalidate });
}

export function useMarkTaskFinished(companyId: string) {
  const invalidate = useInvalidateTasks(companyId);
  return useMutation({ mutationFn: markTaskFinished, onSuccess: invalidate });
}

export function useReopenTask(companyId: string) {
  const invalidate = useInvalidateTasks(companyId);
  return useMutation({ mutationFn: reopenTask, onSuccess: invalidate });
}

export function useAcceptRequestedTask(companyId: string) {
  const invalidate = useInvalidateTasks(companyId);
  return useMutation({ mutationFn: acceptRequestedTask, onSuccess: invalidate });
}

export function useReorderTasks(companyId: string) {
  const invalidate = useInvalidateTasks(companyId);
  return useMutation({ mutationFn: reorderTasks, onSuccess: invalidate });
}
