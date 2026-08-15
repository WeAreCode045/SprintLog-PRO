import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../lib/queryKeys';
import {
  approveTimeEntries,
  createTimeEntry,
  deleteTimeEntry,
  listTimeEntriesByCompany,
  listTimeEntriesForCompanies,
  listTimeEntriesByProject,
  listTimeEntriesByTask,
  listTaskIdsWithInvoicedHours,
  unlockTimeEntries,
  updateTimeEntry,
} from './api';

function useInvalidateTimeEntries() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: ['timeEntries'] });
    void queryClient.invalidateQueries({ queryKey: ['tasks'] });
    void queryClient.invalidateQueries({ queryKey: ['reports'] });
  };
}

export function useTimeEntriesByTask(taskId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.timeEntriesByTask(taskId ?? ''),
    queryFn: () => listTimeEntriesByTask(taskId!),
    enabled: Boolean(taskId),
  });
}

export function useTimeEntriesByProject(projectId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.timeEntriesByProject(projectId ?? ''),
    queryFn: () => listTimeEntriesByProject(projectId!),
    enabled: Boolean(projectId),
  });
}

export function useTimeEntriesByCompany(
  companyId: string,
  filters: { start: Date; end: Date; projectId?: string; userId?: string },
  enabled = true,
) {
  return useQuery({
    queryKey: queryKeys.timeEntriesByCompany(
      companyId,
      filters.start.toISOString(),
      filters.end.toISOString(),
      filters.projectId,
      filters.userId,
    ),
    queryFn: () => listTimeEntriesByCompany(companyId, filters),
    enabled: Boolean(companyId) && enabled,
  });
}

export function useTimeEntriesForCompanies(
  companyIds: string[],
  filters: { start: Date; end: Date; projectId?: string; userId?: string },
  enabled = true,
) {
  const sortedIds = companyIds.slice().sort();
  return useQuery({
    queryKey: queryKeys.timeEntriesByCompanies(
      sortedIds,
      filters.start.toISOString(),
      filters.end.toISOString(),
      filters.projectId,
      filters.userId,
    ),
    queryFn: () => listTimeEntriesForCompanies(sortedIds, filters),
    enabled: sortedIds.length > 0 && enabled,
  });
}

export function useCreateTimeEntry(_companyId: string) {
  const invalidate = useInvalidateTimeEntries();
  return useMutation({
    mutationFn: createTimeEntry,
    onSuccess: invalidate,
  });
}

export function useUpdateTimeEntry() {
  const invalidate = useInvalidateTimeEntries();
  return useMutation({ mutationFn: updateTimeEntry, onSuccess: invalidate });
}

export function useDeleteTimeEntry() {
  const invalidate = useInvalidateTimeEntries();
  return useMutation({ mutationFn: deleteTimeEntry, onSuccess: invalidate });
}

export function useTaskIdsWithInvoicedHours(taskIds: string[]) {
  const sortedIds = taskIds.slice().sort();
  return useQuery({
    queryKey: ['timeEntries', 'invoicedTasks', ...sortedIds] as const,
    queryFn: () => listTaskIdsWithInvoicedHours(sortedIds),
    enabled: sortedIds.length > 0,
  });
}

export function useApproveTimeEntries() {
  const invalidate = useInvalidateTimeEntries();
  return useMutation({ mutationFn: approveTimeEntries, onSuccess: invalidate });
}

export function useUnlockTimeEntries() {
  const invalidate = useInvalidateTimeEntries();
  return useMutation({ mutationFn: unlockTimeEntries, onSuccess: invalidate });
}
