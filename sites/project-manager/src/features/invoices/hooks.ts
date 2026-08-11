import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../lib/queryKeys';
import type { InvoiceStatus } from '../../appwrite/types';
import { createCreditInvoice, getInvoice, listInvoices, regenerateInvoice, runInvoiceGeneration } from './api';

export function useInvoices(filters?: { companyId?: string; status?: InvoiceStatus }) {
  return useQuery({
    queryKey: queryKeys.invoices(filters?.companyId, filters?.status),
    queryFn: () => listInvoices(filters),
  });
}

export function useInvoice(invoiceId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.invoice(invoiceId ?? ''),
    queryFn: () => getInvoice(invoiceId!),
    enabled: Boolean(invoiceId),
  });
}

export function useRunInvoiceGeneration() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (companyId?: string) => runInvoiceGeneration(companyId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['invoices'] });
      void queryClient.invalidateQueries({ queryKey: ['timeEntries'] });
    },
  });
}

export function useRegenerateInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (invoiceId: string) => regenerateInvoice(invoiceId),
    onSuccess: (_result, invoiceId) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.invoice(invoiceId) });
      void queryClient.invalidateQueries({ queryKey: ['invoices'] });
    },
  });
}

export function useCreateCreditInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (invoiceId: string) => createCreditInvoice(invoiceId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['invoices'] });
      void queryClient.invalidateQueries({ queryKey: ['timeEntries'] });
    },
  });
}
