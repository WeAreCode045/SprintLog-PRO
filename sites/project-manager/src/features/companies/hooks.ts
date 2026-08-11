import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../lib/queryKeys';
import {
  createCompany,
  deleteCompany,
  getCompany,
  listAllCompanies,
  listCompaniesByIds,
  renameCompany,
  updateCompanyContactDetails,
  updateCompanyDetails,
} from './api';

export function useAllCompanies(enabled: boolean) {
  return useQuery({ queryKey: ['companies', 'all'], queryFn: listAllCompanies, enabled });
}

export function useCompaniesByIds(companyIds: string[]) {
  return useQuery({
    queryKey: ['companies', 'byIds', ...companyIds].sort(),
    queryFn: () => listCompaniesByIds(companyIds),
    enabled: companyIds.length > 0,
  });
}

export function useCompany(companyId: string | undefined) {
  return useQuery({
    queryKey: companyId ? queryKeys.company(companyId) : ['companies', 'none'],
    queryFn: () => getCompany(companyId as string),
    enabled: Boolean(companyId),
  });
}

export function useCreateCompany() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createCompany,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['companies'] });
    },
  });
}

export function useRenameCompany() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ companyId, name }: { companyId: string; name: string }) => renameCompany(companyId, name),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['companies'] });
    },
  });
}

export function useUpdateCompanyDetails(companyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof updateCompanyDetails>[1]) => updateCompanyDetails(companyId, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.company(companyId) });
      void queryClient.invalidateQueries({ queryKey: ['companies'] });
    },
  });
}

export function useUpdateCompanyContactDetails(companyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof updateCompanyContactDetails>[1]) =>
      updateCompanyContactDetails(companyId, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.company(companyId) });
      void queryClient.invalidateQueries({ queryKey: ['companies'] });
    },
  });
}

export function useDeleteCompany() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (companyId: string) => deleteCompany(companyId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['companies'] });
    },
  });
}
