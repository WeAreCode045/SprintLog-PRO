import { Query } from 'appwrite';
import { storage, tablesDB } from '../../appwrite/client';
import { BUCKETS, DATABASE_ID, TABLES } from '../../appwrite/constants';
import type { InvoiceRow, InvoiceStatus } from '../../appwrite/types';
import {
  runInvoiceGeneration as runInvoiceGenerationFn,
  regenerateInvoice as regenerateInvoiceFn,
  createCreditInvoice as createCreditInvoiceFn,
} from '../../lib/functions';

export async function getInvoice(invoiceId: string) {
  return tablesDB.getRow<InvoiceRow>({
    databaseId: DATABASE_ID,
    tableId: TABLES.invoices,
    rowId: invoiceId,
  });
}

export async function listInvoices(filters?: { companyId?: string; status?: InvoiceStatus }) {
  const queries = [Query.orderDesc('periodStart'), Query.limit(200)];
  if (filters?.companyId) {
    queries.push(Query.equal('companyId', filters.companyId));
  }
  if (filters?.status) {
    queries.push(Query.equal('status', filters.status));
  }
  const result = await tablesDB.listRows<InvoiceRow>({
    databaseId: DATABASE_ID,
    tableId: TABLES.invoices,
    queries,
  });
  return result.rows;
}

export function getInvoicePdfUrl(pdfFileId: string): string {
  return storage.getFileView({
    bucketId: BUCKETS.invoicePdfs,
    fileId: pdfFileId,
  });
}

export async function runInvoiceGeneration(companyId?: string) {
  return runInvoiceGenerationFn(companyId ? { companyId } : undefined);
}

export async function regenerateInvoice(invoiceId: string) {
  return regenerateInvoiceFn(invoiceId);
}

export async function createCreditInvoice(invoiceId: string) {
  return createCreditInvoiceFn(invoiceId);
}
