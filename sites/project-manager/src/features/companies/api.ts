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
    postalCode?: string;
    city?: string;
    country?: string;
    phone?: string;
    hourlyRate?: number | null;
    autoApproveHours?: boolean | null;
    vatNumber?: string | null;
    invoiceEmail?: string | null;
    generalTerms?: string | null;
    paymentTermDays?: number | null;
    invoiceAddress?: string | null;
    invoicePostalCode?: string | null;
    invoiceCity?: string | null;
    invoiceCountry?: string | null;
    vatExempt?: boolean | null;
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
      postalCode: data.postalCode || null,
      city: data.city || null,
      country: data.country || null,
      phone: data.phone || null,
      hourlyRate: data.hourlyRate ?? null,
      autoApproveHours: data.autoApproveHours ?? false,
      vatNumber: data.vatNumber || null,
      invoiceEmail: data.invoiceEmail || null,
      generalTerms: data.generalTerms ?? null,
      paymentTermDays: data.paymentTermDays ?? null,
      invoiceAddress: data.invoiceAddress || null,
      invoicePostalCode: data.invoicePostalCode || null,
      invoiceCity: data.invoiceCity || null,
      invoiceCountry: data.invoiceCountry || null,
      vatExempt: data.vatExempt ?? false,
    },
  });
}

/** Client-safe update — contact fields clients may edit on company-settings; never hourlyRate
 * or paymentTermDays (admin-only, edited via ClientManagerPage). */
export async function updateCompanyContactDetails(
  companyId: string,
  data: {
    name: string;
    email?: string;
    address?: string;
    postalCode?: string;
    city?: string;
    country?: string;
    phone?: string;
    vatNumber?: string | null;
    invoiceEmail?: string | null;
    invoiceAddress?: string | null;
    invoicePostalCode?: string | null;
    invoiceCity?: string | null;
    invoiceCountry?: string | null;
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
      postalCode: data.postalCode || null,
      city: data.city || null,
      country: data.country || null,
      phone: data.phone || null,
      vatNumber: data.vatNumber || null,
      invoiceEmail: data.invoiceEmail || null,
      invoiceAddress: data.invoiceAddress || null,
      invoicePostalCode: data.invoicePostalCode || null,
      invoiceCity: data.invoiceCity || null,
      invoiceCountry: data.invoiceCountry || null,
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
