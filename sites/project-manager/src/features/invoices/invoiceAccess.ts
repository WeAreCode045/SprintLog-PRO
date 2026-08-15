import type { InvoiceRow, ResolvedRole } from '../../appwrite/types';

/**
 * An invoice can be edited by an admin if:
 * 1. It is a draft, or
 * 2. It is a sent invoice that has NOT been credited (no credit note issued for it),
 *    is NOT a credit note itself, is NOT void, and is NOT marked as paid.
 */
export function canEditInvoice(
  invoice: InvoiceRow | null | undefined,
  role?: ResolvedRole | string | null,
): boolean {
  if (!invoice || role !== 'admin') return false;
  if (invoice.creditForInvoiceId) return false;
  if (invoice.creditedByInvoiceId) return false;
  if (invoice.status === 'void') return false;
  if ((invoice.status as string) === 'paid') return false;

  return invoice.status === 'draft' || invoice.status === 'sent';
}
