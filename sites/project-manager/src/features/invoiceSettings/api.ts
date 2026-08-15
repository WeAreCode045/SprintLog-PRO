import { Permission, Role } from 'appwrite';
import { tablesDB } from '../../appwrite/client';
import { ADMIN_LABEL, DATABASE_ID, TABLES } from '../../appwrite/constants';
import type { AdminSettingsRawRow, InvoiceSettingsRow } from '../../appwrite/types';

/** Singleton row — one admin-settings record for the whole project. */
const SETTINGS_ROW_ID = 'default';

/** label:admin, not a specific creator's user:* — this is a shared, admin-wide singleton,
 * and any admin (not just whoever first saved it) must be able to update it. */
const SETTINGS_PERMISSIONS = [
  Permission.read(Role.label(ADMIN_LABEL)),
  Permission.update(Role.label(ADMIN_LABEL)),
  Permission.delete(Role.label(ADMIN_LABEL)),
];

function parseGroup<T extends object>(json: string | null | undefined): Partial<T> {
  if (!json) return {};
  try {
    return JSON.parse(json) as Partial<T>;
  } catch {
    return {};
  }
}

function flatten(row: AdminSettingsRawRow): InvoiceSettingsRow {
  return {
    ...row,
    ...parseGroup(row.company),
    ...parseGroup(row.bank),
    ...parseGroup(row.vat),
    ...parseGroup(row.texts),
  } as InvoiceSettingsRow;
}

export async function getInvoiceSettings(): Promise<InvoiceSettingsRow | null> {
  try {
    const row = await tablesDB.getRow<AdminSettingsRawRow>({
      databaseId: DATABASE_ID,
      tableId: TABLES.adminSettings,
      rowId: SETTINGS_ROW_ID,
    });
    return flatten(row);
  } catch {
    return null;
  }
}

export async function updateInvoiceSettings(data: Partial<InvoiceSettingsRow>) {
  const raw: Partial<AdminSettingsRawRow> = {
    company: JSON.stringify({
      senderName: data.senderName,
      contactPerson: data.contactPerson,
      senderAddress: data.senderAddress,
      senderPostalCode: data.senderPostalCode,
      senderCity: data.senderCity,
      senderCountry: data.senderCountry,
      senderRegistrationNumber: data.senderRegistrationNumber,
      contactPhone: data.contactPhone,
      contactEmail: data.contactEmail,
      contactWebsite: data.contactWebsite,
    }),
    bank: JSON.stringify({
      bankName: data.bankName,
      bankIban: data.bankIban,
      bankSwiftBic: data.bankSwiftBic,
    }),
    vat: JSON.stringify({
      vatEnabled: data.vatEnabled,
      vatRateHigh: data.vatRateHigh,
      vatRateLow: data.vatRateLow,
      vatLabel: data.vatLabel,
      senderVatNumber: data.senderVatNumber,
      paymentTermDays: data.paymentTermDays,
      currency: data.currency,
    }),
    texts: JSON.stringify({
      defaultInstructionsText: data.defaultInstructionsText,
      footerText: data.footerText,
      creditInstructionsText: data.creditInstructionsText,
      creditFooterText: data.creditFooterText,
    }),
  };
  return tablesDB.upsertRow<AdminSettingsRawRow>({
    databaseId: DATABASE_ID,
    tableId: TABLES.adminSettings,
    rowId: SETTINGS_ROW_ID,
    data: raw,
    permissions: SETTINGS_PERMISSIONS,
  });
}
