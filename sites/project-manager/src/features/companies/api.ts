import { ID, Query } from 'appwrite';
import { tablesDB, teams } from '../../appwrite/client';
import { DATABASE_ID, TABLES } from '../../appwrite/constants';
import { adminOnlyCompanyPermissions, companyPermissions } from '../../appwrite/permissions';
import type { CompanyRow } from '../../appwrite/types';

function isPermissionGrantError(err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  return message.includes('Permissions must be one of');
}

export async function listCompaniesByIds(companyIds: string[]) {
  if (companyIds.length === 0) return [];
  const result = await tablesDB.listRows<CompanyRow>({
    databaseId: DATABASE_ID,
    tableId: TABLES.companies,
    queries: [Query.equal('$id', companyIds), Query.limit(100)],
  });
  return result.rows;
}

export async function listAllCompanies() {
  const result = await tablesDB.listRows<CompanyRow>({
    databaseId: DATABASE_ID,
    tableId: TABLES.companies,
    queries: [Query.orderAsc('name'), Query.limit(500)],
  });
  return result.rows;
}

export async function getCompany(companyId: string) {
  return tablesDB.getRow<CompanyRow>({
    databaseId: DATABASE_ID,
    tableId: TABLES.companies,
    rowId: companyId,
  });
}

export async function createCompany(input: { name: string }) {
  const team = await teams.create({ teamId: ID.unique(), name: input.name });
  const rowId = ID.unique();
  const data = {
    name: input.name,
    teamId: team.$id,
  };

  try {
    return await tablesDB.createRow<CompanyRow>({
      databaseId: DATABASE_ID,
      tableId: TABLES.companies,
      rowId,
      data,
      permissions: companyPermissions(team.$id),
    });
  } catch (err) {
    if (!isPermissionGrantError(err)) throw err;
    // Admins often are not members of client teams and cannot grant team:*.
    return await tablesDB.createRow<CompanyRow>({
      databaseId: DATABASE_ID,
      tableId: TABLES.companies,
      rowId,
      data,
      permissions: adminOnlyCompanyPermissions(),
    });
  }
}

export async function renameCompany(companyId: string, name: string) {
  return tablesDB.updateRow<CompanyRow>({
    databaseId: DATABASE_ID,
    tableId: TABLES.companies,
    rowId: companyId,
    data: { name },
  });
}

export async function updateCompanyDetails(
  companyId: string,
  data: {
    name: string;
    email?: string;
    address?: string;
    phone?: string;
    hourlyRate?: number | null;
    vatNumber?: string | null;
  },
) {
  return tablesDB.updateRow<CompanyRow>({
    databaseId: DATABASE_ID,
    tableId: TABLES.companies,
    rowId: companyId,
    data: {
      name: data.name,
      email: data.email || null,
      address: data.address || null,
      phone: data.phone || null,
      hourlyRate: data.hourlyRate ?? null,
      vatNumber: data.vatNumber || null,
    },
  });
}

/** Client-safe update — only contact/invoicing fields, never hourlyRate (admin-only, edited via
 * ClientManagerPage). Used by the client-facing company settings page. */
export async function updateCompanyContactDetails(
  companyId: string,
  data: { name: string; email?: string; address?: string; phone?: string; vatNumber?: string | null },
) {
  return tablesDB.updateRow<CompanyRow>({
    databaseId: DATABASE_ID,
    tableId: TABLES.companies,
    rowId: companyId,
    data: {
      name: data.name,
      email: data.email || null,
      address: data.address || null,
      phone: data.phone || null,
      vatNumber: data.vatNumber || null,
    },
  });
}

export async function deleteCompany(companyId: string) {
  await tablesDB.deleteRow({
    databaseId: DATABASE_ID,
    tableId: TABLES.companies,
    rowId: companyId,
  });
}
