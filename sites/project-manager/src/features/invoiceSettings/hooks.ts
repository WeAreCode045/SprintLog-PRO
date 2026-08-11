import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getInvoiceSettings, updateInvoiceSettings } from './api';

export function useInvoiceSettings() {
  return useQuery({
    queryKey: ['invoiceSettings'],
    queryFn: getInvoiceSettings,
  });
}

export function useUpdateInvoiceSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateInvoiceSettings,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['invoiceSettings'] });
    },
  });
}
