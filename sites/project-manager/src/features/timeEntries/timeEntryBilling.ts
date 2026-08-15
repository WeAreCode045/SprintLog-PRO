import type { TimeEntryRow } from '../../appwrite/types';

export function isFreeOfChargeEntry(entry: TimeEntryRow) {
  return Boolean(entry.freeOfCharge);
}

export function entryNeedsApproval(entry: TimeEntryRow) {
  return !entry.approved && !isFreeOfChargeEntry(entry);
}

export function isBillableUninvoicedEntry(entry: TimeEntryRow) {
  return Boolean(entry.approved) && !entry.invoiced && !isFreeOfChargeEntry(entry);
}
