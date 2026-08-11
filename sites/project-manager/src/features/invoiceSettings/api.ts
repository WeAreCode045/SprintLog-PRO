import { Permission, Role } from 'appwrite';
import { tablesDB } from '../../appwrite/client';
import { ADMIN_LABEL, DATABASE_ID, TABLES } from '../../appwrite/constants';
import type { InvoiceSettingsRow } from '../../appwrite/types';

/** Singleton row — one invoice-settings record for the whole project. */
const SETTINGS_ROW_ID = 'default';

/** label:admin, not a specific creator's user:* — this is a shared, admin-wide singleton,
 * and any admin (not just whoever first saved it) must be able to update it. */
const SETTINGS_PERMISSIONS = [
  Permission.read(Role.label(ADMIN_LABEL)),
  Permission.update(Role.label(ADMIN_LABEL)),
  Permission.delete(Role.label(ADMIN_LABEL)),
];

export async function getInvoiceSettings(): Promise<InvoiceSettingsRow | null> {
  try {
    return await tablesDB.getRow<InvoiceSettingsRow>({
      databaseId: DATABASE_ID,
      tableId: TABLES.invoiceSettings,
      rowId: SETTINGS_ROW_ID,
    });
  } catch {
    return null;
  }
}

export async function updateInvoiceSettings(data: Partial<InvoiceSettingsRow>) {
  return tablesDB.upsertRow<InvoiceSettingsRow>({
    databaseId: DATABASE_ID,
    tableId: TABLES.invoiceSettings,
    rowId: SETTINGS_ROW_ID,
    data,
    permissions: SETTINGS_PERMISSIONS,
  });
}
