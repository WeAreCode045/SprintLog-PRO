import { Client, Users, TablesDB, Storage, Query, ID, Permission, Role } from 'node-appwrite';
import { InputFile } from 'node-appwrite/file';
import { renderToBuffer } from '@react-pdf/renderer';
import { buildCreditInvoiceDocument } from '../lib/invoiceDocument.js';
import { flattenAdminSettings } from '../lib/appwrite.js';

const DATABASE_ID = 'main';
const TABLES = {
  companies: 'companies',
  timeEntries: 'timeEntries',
  invoices: 'invoices',
  invoiceItems: 'invoiceItems',
  // adminSettings replaces invoiceSettings — see flattenAdminSettings in lib/appwrite.js.
  invoiceSettings: 'adminSettings',
};
const INVOICE_PDF_BUCKET = 'invoice-pdfs';
const ADMIN_LABEL = 'admin';
const SETTINGS_ROW_ID = 'default';

/** Mirrors sites/project-manager/src/appwrite/permissions.ts#sentInvoicePermissions —
 * a credit note is created already-final (it reverses a sent invoice), so it goes straight
 * to sent-level visibility rather than passing through draft. */
function sentInvoicePermissions(teamId) {
  return [
    Permission.read(Role.label(ADMIN_LABEL)),
    Permission.update(Role.label(ADMIN_LABEL)),
    Permission.delete(Role.label(ADMIN_LABEL)),
    Permission.read(Role.team(teamId)),
  ];
}

async function assertCallerIsAdmin(users, req) {
  const callerId = req.headers['x-appwrite-user-id'];
  if (!callerId) {
    const err = new Error('Missing x-appwrite-user-id header');
    err.status = 401;
    throw err;
  }
  const caller = await users.get({ userId: callerId });
  const labels = caller.labels ?? [];
  if (!labels.includes(ADMIN_LABEL)) {
    const err = new Error('Caller is not an admin');
    err.status = 403;
    throw err;
  }
  return callerId;
}

async function getInvoiceSettings(tablesDB) {
  try {
    const row = await tablesDB.getRow({
      databaseId: DATABASE_ID,
      tableId: TABLES.invoiceSettings,
      rowId: SETTINGS_ROW_ID,
    });
    return flattenAdminSettings(row);
  } catch {
    return null;
  }
}

async function listAllRows(tablesDB, tableId, queries) {
  const rows = [];
  let cursor = null;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const pageQueries = [...queries, Query.limit(100)];
    if (cursor) {
      pageQueries.push(Query.cursorAfter(cursor));
    }
    const result = await tablesDB.listRows({ databaseId: DATABASE_ID, tableId, queries: pageQueries });
    if (result.rows.length === 0) break;
    rows.push(...result.rows);
    if (result.rows.length < 100) break;
    cursor = result.rows[result.rows.length - 1].$id;
  }
  return rows;
}

async function nextCreditNoteNumber(tablesDB, year) {
  const prefix = `CN-${year}-`;
  const result = await tablesDB.listRows({
    databaseId: DATABASE_ID,
    tableId: TABLES.invoices,
    queries: [Query.startsWith('invoiceNumber', prefix), Query.orderDesc('invoiceNumber'), Query.limit(1)],
  });
  const last = result.rows[0];
  let nextSeq = 1;
  if (last) {
    const lastSeq = parseInt(last.invoiceNumber.slice(prefix.length), 10);
    if (!Number.isNaN(lastSeq)) nextSeq = lastSeq + 1;
  }
  return `${prefix}${String(nextSeq).padStart(4, '0')}`;
}

export default async ({ req, res, log, error }) => {
  const client = new Client()
    .setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT)
    .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
    .setKey(req.headers['x-appwrite-key'] ?? '');

  const users = new Users(client);
  const tablesDB = new TablesDB(client);
  const storage = new Storage(client);

  try {
    const callerId = await assertCallerIsAdmin(users, req);

    const body = req.bodyJson ?? {};
    const { invoiceId } = body;
    if (!invoiceId || typeof invoiceId !== 'string') {
      return res.json({ success: false, message: 'invoiceId is required' }, 400);
    }

    const original = await tablesDB.getRow({
      databaseId: DATABASE_ID,
      tableId: TABLES.invoices,
      rowId: invoiceId,
    });

    if (original.creditForInvoiceId) {
      return res.json({ success: false, message: 'Cannot credit a credit note' }, 400);
    }
    if (original.creditedByInvoiceId) {
      return res.json({ success: false, message: 'Invoice has already been credited' }, 400);
    }
    if (original.status !== 'sent') {
      return res.json({ success: false, message: 'Only sent invoices can be credited' }, 400);
    }

    let company = null;
    try {
      company = await tablesDB.getRow({
        databaseId: DATABASE_ID,
        tableId: TABLES.companies,
        rowId: original.companyId,
      });
    } catch {
      company = { name: original.companyId, address: '', email: '', vatNumber: '' };
    }
    const settings = await getInvoiceSettings(tablesDB);

    const originalItems = await listAllRows(tablesDB, TABLES.invoiceItems, [
      Query.equal('invoiceId', original.$id),
    ]);
    originalItems.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    let entries = [];
    const entryIds = [...new Set(originalItems.flatMap((item) => item.sourceTimeEntryIds ?? []).filter(Boolean))];
    if (entryIds.length > 0) {
      entries = (
        await Promise.all(
          entryIds.map((entryId) =>
            tablesDB.getRow({ databaseId: DATABASE_ID, tableId: TABLES.timeEntries, rowId: entryId }).catch(() => null),
          ),
        )
      ).filter(Boolean);
    } else if (original.companyId && original.periodStart && original.periodEnd) {
      // Legacy invoices with no stored line items (pre-invoiceItems data) — fall back to the
      // period-range query so old invoices can still be credited.
      entries = await listAllRows(tablesDB, TABLES.timeEntries, [
        Query.equal('companyId', original.companyId),
        Query.greaterThanEqual('workedDate', original.periodStart),
        Query.lessThanEqual('workedDate', original.periodEnd),
      ]);
    }

    const year = original.periodStart ? new Date(original.periodStart).getUTCFullYear() : new Date().getUTCFullYear();
    const creditNoteNumber = await nextCreditNoteNumber(tablesDB, year);
    const issueDate = new Date();

    // Credit notes are created already-final (they reverse a sent invoice), so they're visible
    // to the client team immediately rather than passing through the draft admin-only state.
    const invoicePermissions =
      company && company.teamId
        ? sentInvoicePermissions(company.teamId)
        : [
            Permission.read(Role.label(ADMIN_LABEL)),
            Permission.update(Role.label(ADMIN_LABEL)),
            Permission.delete(Role.label(ADMIN_LABEL)),
          ];

    const filePermissions = [
      Permission.read(Role.label(ADMIN_LABEL)),
    ];
    if (company && company.teamId) {
      filePermissions.push(Permission.read(Role.team(company.teamId)));
    }

    const creditInvoice = await tablesDB.createRow({
      databaseId: DATABASE_ID,
      tableId: TABLES.invoices,
      rowId: ID.unique(),
      data: {
        companyId: original.companyId,
        invoiceNumber: creditNoteNumber,
        periodStart: original.periodStart,
        periodEnd: original.periodEnd,
        totalHours: original.totalHours,
        totalAmount: original.totalAmount,
        currency: original.currency ?? 'EUR',
        status: 'sent',
        pdfFileId: null,
        issueDate: issueDate.toISOString(),
        dueDate: null,
        sentAt: issueDate.toISOString(),
        paymentTermDays: null,
        instructionsText: null,
        footerText: null,
        vatAmount: original.vatAmount ?? null,
        totalWithVat: original.totalWithVat ?? null,
        creditForInvoiceId: original.$id,
        creditedByInvoiceId: null,
      },
      permissions: invoicePermissions,
    });

    for (const item of originalItems) {
      await tablesDB.createRow({
        databaseId: DATABASE_ID,
        tableId: TABLES.invoiceItems,
        rowId: ID.unique(),
        data: {
          invoiceId: creditInvoice.$id,
          companyId: original.companyId,
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          vatRate: item.vatRate,
          order: item.order ?? 0,
          sourceTimeEntryIds: [],
        },
        permissions: invoicePermissions,
      });
    }

    await tablesDB.updateRow({
      databaseId: DATABASE_ID,
      tableId: TABLES.invoices,
      rowId: original.$id,
      data: { status: 'void', creditedByInvoiceId: creditInvoice.$id },
    });

    for (const entry of entries) {
      await tablesDB.updateRow({
        databaseId: DATABASE_ID,
        tableId: TABLES.timeEntries,
        rowId: entry.$id,
        data: { invoiced: false, invoiceId: null },
      });
    }

    try {
      const pdfBuffer = await renderToBuffer(
        buildCreditInvoiceDocument({
          invoice: creditInvoice,
          company,
          items: originalItems,
          settings,
          originalInvoiceNumber: original.invoiceNumber,
        }),
      );
      const uploadedFile = await storage.createFile({
        bucketId: INVOICE_PDF_BUCKET,
        fileId: ID.unique(),
        file: InputFile.fromBuffer(pdfBuffer, `${creditNoteNumber}.pdf`),
        permissions: filePermissions,
      });
      await tablesDB.updateRow({
        databaseId: DATABASE_ID,
        tableId: TABLES.invoices,
        rowId: creditInvoice.$id,
        data: { pdfFileId: uploadedFile.$id },
      });
    } catch (pdfErr) {
      error(`Credit note PDF generation/upload failed for ${creditInvoice.$id}: ${pdfErr.message}`);
    }

    log(
      `ADMIN CREDIT invoiceId=${original.$id} (${original.invoiceNumber}) -> creditInvoiceId=${creditInvoice.$id} (${creditNoteNumber}) admin=${callerId}, released ${entries.length} time entries`,
    );

    return res.json({
      success: true,
      creditInvoiceId: creditInvoice.$id,
      creditInvoiceNumber: creditNoteNumber,
    });
  } catch (err) {
    const status = err.status ?? 500;
    error(`create-credit-invoice failed: ${err.message}`);
    return res.json({ success: false, message: err.message }, status);
  }
};
