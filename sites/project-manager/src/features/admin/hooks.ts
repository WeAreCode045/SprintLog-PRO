import { useMutation, useQueryClient } from '@tanstack/react-query';
import { adminDataReset, type AdminDataResetType } from './api';

export function useAdminDataReset() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { resetType: AdminDataResetType; companyId: string; projectId?: string }) =>
      adminDataReset(input),
    onSuccess: () => {
      void queryClient.invalidateQueries();
    },
  });
}
