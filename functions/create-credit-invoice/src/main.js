import { Client, Users, TablesDB, Storage, Query, ID, Permission, Role } from 'node-appwrite';
import { InputFile } from 'node-appwrite/file';
import { renderToBuffer } from '@react-pdf/renderer';
import { buildCreditInvoiceDocument } from './invoiceDocument.js';

const DATABASE_ID = 'main';
const TABLES = {
  companies: 'companies',
  tasks: 'tasks',
  timeEntries: 'timeEntries',
  invoices: 'invoices',
  invoiceSettings: 'invoiceSettings',
};
const INVOICE_PDF_BUCKET = 'invoice-pdfs';
const ADMIN_LABEL = 'admin';
const SETTINGS_ROW_ID = 'default';

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
    return await tablesDB.getRow({
      databaseId: DATABASE_ID,
      tableId: TABLES.invoiceSettings,
      rowId: SETTINGS_ROW_ID,
    });
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
    if (original.status === 'void') {
      return res.json({ success: false, message: 'Invoice is void' }, 400);
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

    let entries = await listAllRows(tablesDB, TABLES.timeEntries, [
      Query.equal('invoiceId', original.$id),
    ]);
    if (entries.length === 0 && original.companyId && original.periodStart && original.periodEnd) {
      entries = await listAllRows(tablesDB, TABLES.timeEntries, [
        Query.equal('companyId', original.companyId),
        Query.greaterThanEqual('workedDate', original.periodStart),
        Query.lessThanEqual('workedDate', original.periodEnd),
      ]);
    }

    const taskIds = [...new Set(entries.map((entry) => entry.taskId).filter(Boolean))];
    const tasks = await Promise.all(
      taskIds.map((taskId) =>
        tablesDB.getRow({ databaseId: DATABASE_ID, tableId: TABLES.tasks, rowId: taskId }).catch(() => null),
      ),
    );
    const taskById = new Map(tasks.filter(Boolean).map((task) => [task.$id, task]));

    const lineByTask = new Map();
    for (const entry of entries) {
      const task = taskById.get(entry.taskId);
      const line = lineByTask.get(entry.taskId) ?? {
        taskId: entry.taskId,
        taskTitle: task?.title ?? entry.taskId,
        hours: 0,
        dates: [],
      };
      line.hours += entry.hours ?? 0;
      if (entry.workedDate) {
        line.dates.push(entry.workedDate.slice(0, 10));
      }
      lineByTask.set(entry.taskId, line);
    }
    const lines = [...lineByTask.values()].sort((a, b) => a.taskTitle.localeCompare(b.taskTitle));

    const year = original.periodStart ? new Date(original.periodStart).getUTCFullYear() : new Date().getUTCFullYear();
    const creditNoteNumber = await nextCreditNoteNumber(tablesDB, year);
    const issueDate = new Date();

    const invoicePermissions = [
      Permission.read(Role.label(ADMIN_LABEL)),
      Permission.update(Role.label(ADMIN_LABEL)),
      Permission.delete(Role.label(ADMIN_LABEL)),
    ];
    if (company && company.teamId) {
      invoicePermissions.push(Permission.read(Role.team(company.teamId)));
    }

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
        hourlyRate: original.hourlyRate,
        totalHours: original.totalHours,
        totalAmount: original.totalAmount,
        currency: original.currency ?? 'EUR',
        status: 'generated',
        entryCount: original.entryCount,
        pdfFileId: null,
        issueDate: issueDate.toISOString(),
        dueDate: null,
        vatRate: original.vatRate ?? null,
        vatAmount: original.vatAmount ?? null,
        totalWithVat: original.totalWithVat ?? null,
        creditForInvoiceId: original.$id,
        creditedByInvoiceId: null,
      },
      permissions: invoicePermissions,
    });

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
          lines,
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
