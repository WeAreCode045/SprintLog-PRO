import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../lib/queryKeys';
import type { ProjectStatus } from '../../appwrite/types';
import {
  createProject,
  deleteProject,
  getProject,
  listProjects,
  listProjectsForCompanies,
  renameProject,
  updateProject,
} from './api';

export function useProjects(companyId: string) {
  return useQuery({ queryKey: queryKeys.projects(companyId), queryFn: () => listProjects(companyId) });
}

export function useProject(projectId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.project(projectId ?? ''),
    queryFn: () => getProject(projectId!),
    enabled: Boolean(projectId),
  });
}

export function useUpdateProject(companyId: string, projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof updateProject>[1]) => updateProject(projectId, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.projects(companyId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.project(projectId) });
    },
  });
}

export function useProjectsForCompanies(companyIds: string[]) {
  return useQuery({
    queryKey: ['projects', 'byCompanies', ...companyIds.slice().sort()],
    queryFn: () => listProjectsForCompanies(companyIds),
    enabled: companyIds.length > 0,
  });
}

export function useCreateProject(companyId: string, teamId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => createProject(companyId, teamId, name),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.projects(companyId) });
      void queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}

export function useRenameProject(companyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, name }: { projectId: string; name: string }) => renameProject(projectId, name),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.projects(companyId) });
    },
  });
}

/** Not scoped to one project/company — used from list views where each row belongs to a
 * different project, so invalidation targets every 'projects'-prefixed query broadly. */
export function useSetProjectStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, status }: { projectId: string; status: ProjectStatus }) =>
      updateProject(projectId, { status }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}

export function useDeleteProject(companyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (projectId: string) => deleteProject(projectId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.projects(companyId) });
    },
  });
}
