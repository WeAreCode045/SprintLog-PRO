import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../lib/queryKeys';
import type { InvoiceStatus } from '../../appwrite/types';
import {
  createCreditInvoice,
  createInvoiceDraft,
  deleteInvoiceDraft,
  getInvoice,
  listApprovedUnbilledEntries,
  listInvoiceItems,
  listInvoices,
  regenerateInvoice,
  replaceInvoiceItems,
  sendInvoice,
  updateInvoiceDraft,
  type InvoiceItemInput,
} from './api';

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

export function useInvoiceItems(invoiceId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.invoiceItems(invoiceId ?? ''),
    queryFn: () => listInvoiceItems(invoiceId!),
    enabled: Boolean(invoiceId),
  });
}

export function useApprovedUnbilledEntries(companyId: string | undefined, invoiceId?: string) {
  return useQuery({
    queryKey: queryKeys.approvedUnbilledEntries(companyId ?? '', invoiceId),
    queryFn: () => listApprovedUnbilledEntries(companyId!, invoiceId),
    enabled: Boolean(companyId),
  });
}

export function useCreateInvoiceDraft() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createInvoiceDraft,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['invoices'] });
    },
  });
}

export function useUpdateInvoiceDraft() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ invoiceId, data }: { invoiceId: string; data: Parameters<typeof updateInvoiceDraft>[1] }) =>
      updateInvoiceDraft(invoiceId, data),
    onSuccess: (_result, { invoiceId }) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.invoice(invoiceId) });
      void queryClient.invalidateQueries({ queryKey: ['invoices'] });
    },
  });
}

export function useDeleteInvoiceDraft() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (invoiceId: string) => deleteInvoiceDraft(invoiceId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['invoices'] });
      void queryClient.invalidateQueries({ queryKey: ['timeEntries'] });
    },
  });
}

export function useReplaceInvoiceItems() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      invoiceId,
      companyId,
      items,
    }: {
      invoiceId: string;
      companyId: string;
      items: InvoiceItemInput[];
    }) => replaceInvoiceItems(invoiceId, companyId, items),
    onSuccess: (_result, { invoiceId }) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.invoiceItems(invoiceId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.invoice(invoiceId) });
      void queryClient.invalidateQueries({ queryKey: ['invoices'] });
      void queryClient.invalidateQueries({ queryKey: ['timeEntries'] });
    },
  });
}

export function useSendInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (invoiceId: string) => sendInvoice(invoiceId),
    onSuccess: (_result, invoiceId) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.invoice(invoiceId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.invoiceItems(invoiceId) });
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
