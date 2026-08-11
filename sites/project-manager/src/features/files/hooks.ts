import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../lib/queryKeys';
import { deleteProjectFile, listProjectFiles, uploadProjectFile } from './api';
import type { ProjectFileRow } from '../../appwrite/types';

export function useProjectFiles(projectId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.projectFiles(projectId ?? ''),
    queryFn: () => listProjectFiles(projectId!),
    enabled: Boolean(projectId),
  });
}

export function useUploadProjectFile(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: uploadProjectFile,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.projectFiles(projectId) });
      void queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}

export function useDeleteProjectFile(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (row: ProjectFileRow) => deleteProjectFile(row),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.projectFiles(projectId) });
    },
  });
}
