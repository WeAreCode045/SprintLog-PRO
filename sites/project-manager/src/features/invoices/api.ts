import { ID, Query } from 'appwrite';
import { storage, tablesDB } from '../../appwrite/client';
import { BUCKETS, DATABASE_ID, TABLES } from '../../appwrite/constants';
import { draftInvoicePermissions } from '../../appwrite/permissions';
import type { InvoiceItemRow, InvoiceRow, InvoiceStatus, TimeEntryRow } from '../../appwrite/types';
import {
  regenerateInvoice as regenerateInvoiceFn,
  createCreditInvoice as createCreditInvoiceFn,
  sendInvoice as sendInvoiceFn,
} from '../../lib/functions';

export async function getInvoice(invoiceId: string) {
  return tablesDB.getRow<InvoiceRow>({
    databaseId: DATABASE_ID,
    tableId: TABLES.invoices,
    rowId: invoiceId,
  });
}

export async function listInvoices(filters?: { companyId?: string; status?: InvoiceStatus }) {
  const queries = [Query.orderDesc('$createdAt'), Query.limit(200)];
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

export async function sendInvoice(invoiceId: string) {
  return sendInvoiceFn(invoiceId);
}

export async function regenerateInvoice(invoiceId: string) {
  return regenerateInvoiceFn(invoiceId);
}

export async function createCreditInvoice(invoiceId: string) {
  return createCreditInvoiceFn(invoiceId);
}

export async function createInvoiceDraft(input: {
  companyId: string;
  currency: string;
  paymentTermDays: number | null;
  instructionsText: string | null;
  footerText: string | null;
}) {
  return tablesDB.createRow<InvoiceRow>({
    databaseId: DATABASE_ID,
    tableId: TABLES.invoices,
    rowId: ID.unique(),
    data: {
      companyId: input.companyId,
      status: 'draft',
      currency: input.currency,
      totalHours: 0,
      totalAmount: 0,
      paymentTermDays: input.paymentTermDays,
      instructionsText: input.instructionsText,
      footerText: input.footerText,
    },
    permissions: draftInvoicePermissions(),
  });
}

export async function updateInvoiceDraft(
  invoiceId: string,
  data: {
    companyId?: string;
    currency?: string;
    paymentTermDays?: number | null;
    instructionsText?: string | null;
    footerText?: string | null;
  },
) {
  return tablesDB.updateRow<InvoiceRow>({
    databaseId: DATABASE_ID,
    tableId: TABLES.invoices,
    rowId: invoiceId,
    data,
  });
}

export async function deleteInvoiceDraft(invoiceId: string) {
  const items = await listInvoiceItems(invoiceId);
  await releaseTimeEntries(items.flatMap((item) => item.sourceTimeEntryIds ?? []));
  await Promise.all(
    items.map((item) =>
      tablesDB.deleteRow({ databaseId: DATABASE_ID, tableId: TABLES.invoiceItems, rowId: item.$id }),
    ),
  );
  await tablesDB.deleteRow({ databaseId: DATABASE_ID, tableId: TABLES.invoices, rowId: invoiceId });
}

export async function listInvoiceItems(invoiceId: string) {
  const result = await tablesDB.listRows<InvoiceItemRow>({
    databaseId: DATABASE_ID,
    tableId: TABLES.invoiceItems,
    queries: [Query.equal('invoiceId', invoiceId), Query.orderAsc('order'), Query.limit(500)],
  });
  return result.rows;
}

async function reserveTimeEntries(entryIds: string[], invoiceId: string) {
  const uniqueIds = [...new Set(entryIds)];
  await Promise.all(
    uniqueIds.map(async (entryId) => {
      const entry = await tablesDB.getRow<TimeEntryRow>({
        databaseId: DATABASE_ID,
        tableId: TABLES.timeEntries,
        rowId: entryId,
      });
      if (entry.freeOfCharge) return;
      await tablesDB.updateRow<TimeEntryRow>({
        databaseId: DATABASE_ID,
        tableId: TABLES.timeEntries,
        rowId: entryId,
        data: { invoiced: true, invoiceId },
      });
    }),
  );
}

async function releaseTimeEntries(entryIds: string[]) {
  await Promise.all(
    entryIds.map((entryId) =>
      tablesDB.updateRow<TimeEntryRow>({
        databaseId: DATABASE_ID,
        tableId: TABLES.timeEntries,
        rowId: entryId,
        data: { invoiced: false, invoiceId: null },
      }),
    ),
  );
}

export interface InvoiceItemInput {
  /** Present for an already-persisted row (edit-in-place); absent for a newly added line. */
  id?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  vatRate: number;
  order: number;
  sourceTimeEntryIds?: string[];
}

/** Diffs the submitted items against what's currently persisted for this draft: removed items
 * release their linked timeEntries back to billable, newly added items reserve theirs. Only
 * ever called against a draft invoice — sent invoices are read-only. */
export async function replaceInvoiceItems(invoiceId: string, companyId: string, items: InvoiceItemInput[]) {
  const existing = await listInvoiceItems(invoiceId);
  const existingById = new Map(existing.map((item) => [item.$id, item]));
  const keptIds = new Set(items.filter((item) => item.id).map((item) => item.id as string));

  const removed = existing.filter((item) => !keptIds.has(item.$id));
  const added = items.filter((item) => !item.id);

  await releaseTimeEntries(removed.flatMap((item) => item.sourceTimeEntryIds ?? []));
  await reserveTimeEntries(
    added.flatMap((item) => item.sourceTimeEntryIds ?? []),
    invoiceId,
  );

  await Promise.all(removed.map((item) => tablesDB.deleteRow({ databaseId: DATABASE_ID, tableId: TABLES.invoiceItems, rowId: item.$id })));

  await Promise.all(
    items.map((item) => {
      if (item.id && existingById.has(item.id)) {
        return tablesDB.updateRow<InvoiceItemRow>({
          databaseId: DATABASE_ID,
          tableId: TABLES.invoiceItems,
          rowId: item.id,
          data: {
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            vatRate: item.vatRate,
            order: item.order,
          },
        });
      }
      return tablesDB.createRow<InvoiceItemRow>({
        databaseId: DATABASE_ID,
        tableId: TABLES.invoiceItems,
        rowId: ID.unique(),
        data: {
          invoiceId,
          companyId,
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          vatRate: item.vatRate,
          order: item.order,
          sourceTimeEntryIds: item.sourceTimeEntryIds ?? [],
        },
        permissions: draftInvoicePermissions(),
      });
    }),
  );

  const totalHours = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalAmount = Math.round(items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0) * 100) / 100;
  await tablesDB.updateRow<InvoiceRow>({
    databaseId: DATABASE_ID,
    tableId: TABLES.invoices,
    rowId: invoiceId,
    data: { totalHours, totalAmount },
  });

  return listInvoiceItems(invoiceId);
}

/** Approved, not-yet-billed timeEntries for a client — the pool `AddApprovedHoursModal` picks
 * from. Entries already reserved by the draft currently being edited (`invoiceId`) are included
 * too, so re-opening the modal shows them as already-selected instead of hiding them. */
export async function listApprovedUnbilledEntries(companyId: string, invoiceId?: string) {
  const invoicedFilter = invoiceId
    ? Query.or([Query.equal('invoiced', false), Query.equal('invoiceId', invoiceId)])
    : Query.equal('invoiced', false);
  const result = await tablesDB.listRows<TimeEntryRow>({
    databaseId: DATABASE_ID,
    tableId: TABLES.timeEntries,
    queries: [
      Query.equal('companyId', companyId),
      Query.equal('approved', true),
      Query.equal('freeOfCharge', false),
      invoicedFilter,
      Query.orderAsc('workedDate'),
      Query.limit(2000),
    ],
  });
  return result.rows;
}
