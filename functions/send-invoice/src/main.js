import { Client, Users, TablesDB, Storage, Query, ID, Permission, Role } from 'node-appwrite';
import { InputFile } from 'node-appwrite/file';
import { renderToBuffer } from '@react-pdf/renderer';
import { buildInvoiceDocument } from './invoiceDocument.js';

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
const DEFAULT_CURRENCY = 'EUR';
const SETTINGS_ROW_ID = 'default';

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

async function assertCallerIsAdminIfPresent(users, req) {
  // Scheduled/cron executions carry no x-appwrite-user-id — trust the system trigger.
  const callerId = req.headers['x-appwrite-user-id'];
  if (!callerId) return null;
  const caller = await users.get({ userId: callerId });
  const labels = caller.labels ?? [];
  if (!labels.includes(ADMIN_LABEL)) {
    const err = new Error('Caller is not an admin');
    err.status = 403;
    throw err;
  }
  return callerId;
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

/** Monday 00:00:00.000Z of the UTC week containing `date`. */
function mondayOfWeek(date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d;
}

function weekKeyAndBounds(workedDateIso) {
  const monday = mondayOfWeek(new Date(workedDateIso));
  const nextMonday = new Date(monday);
  nextMonday.setUTCDate(nextMonday.getUTCDate() + 7);
  return { key: monday.toISOString(), periodStart: monday.toISOString(), periodEnd: nextMonday.toISOString() };
}

async function nextInvoiceNumber(tablesDB, year) {
  const prefix = `INV-${year}-`;
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

/** Strips non-admin delete grants from a task's row permissions once it carries invoiced
 * hours, so it can no longer be hard-deleted (deleteTask falls back to archiveTask instead
 * once this is in place; admins keep delete via the table-level label:admin grant regardless). */
function stripNonAdminDeletePermissions(permissions) {
  return permissions.filter((p) => !p.startsWith('delete(') || p.includes('label:admin'));
}

function buildTaskLines(entries, taskById) {
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
    line.dates.push(entry.workedDate.slice(0, 10));
    lineByTask.set(entry.taskId, line);
  }
  return [...lineByTask.values()].sort((a, b) => a.taskTitle.localeCompare(b.taskTitle));
}

async function uploadInvoicePdf(storage, { pdfBuffer, invoiceNumber, companyTeamId }) {
  return storage.createFile({
    bucketId: INVOICE_PDF_BUCKET,
    fileId: ID.unique(),
    file: InputFile.fromBuffer(pdfBuffer, `${invoiceNumber}.pdf`),
    permissions: [
      Permission.read(Role.label(ADMIN_LABEL)),
      Permission.read(Role.team(companyTeamId)),
    ],
  });
}

async function regenerateInvoicePdf({ tablesDB, storage, invoiceId, log, error }) {
  const invoice = await tablesDB.getRow({
    databaseId: DATABASE_ID,
    tableId: TABLES.invoices,
    rowId: invoiceId,
  });

  if (invoice.creditForInvoiceId) {
    const err = new Error('Credit notes cannot be regenerated with this action');
    err.status = 400;
    throw err;
  }
  if (invoice.status === 'void') {
    const err = new Error('Void invoices cannot be regenerated');
    err.status = 400;
    throw err;
  }

  const company = await tablesDB.getRow({
    databaseId: DATABASE_ID,
    tableId: TABLES.companies,
    rowId: invoice.companyId,
  });
  const settings = await getInvoiceSettings(tablesDB);

  const entries = await listAllRows(tablesDB, TABLES.timeEntries, [
    Query.equal('invoiceId', invoice.$id),
  ]);
  if (entries.length === 0) {
    const err = new Error('Invoice has no linked time entries to rebuild the PDF');
    err.status = 400;
    throw err;
  }

  const taskIds = [...new Set(entries.map((entry) => entry.taskId).filter(Boolean))];
  const tasks = await Promise.all(
    taskIds.map((taskId) =>
      tablesDB
        .getRow({ databaseId: DATABASE_ID, tableId: TABLES.tasks, rowId: taskId })
        .catch(() => null),
    ),
  );
  const taskById = new Map(tasks.filter(Boolean).map((task) => [task.$id, task]));
  const lines = buildTaskLines(entries, taskById);

  const pdfBuffer = await renderToBuffer(buildInvoiceDocument({ invoice, company, lines, settings }));
  const uploadedFile = await uploadInvoicePdf(storage, {
    pdfBuffer,
    invoiceNumber: invoice.invoiceNumber,
    companyTeamId: company.teamId,
  });

  const previousPdfFileId = invoice.pdfFileId;
  await tablesDB.updateRow({
    databaseId: DATABASE_ID,
    tableId: TABLES.invoices,
    rowId: invoice.$id,
    data: { pdfFileId: uploadedFile.$id },
  });

  if (previousPdfFileId && previousPdfFileId !== uploadedFile.$id) {
    try {
      await storage.deleteFile({
        bucketId: INVOICE_PDF_BUCKET,
        fileId: previousPdfFileId,
      });
    } catch (deleteErr) {
      error(`Could not delete previous PDF ${previousPdfFileId}: ${deleteErr.message}`);
    }
  }

  log(`Regenerated PDF for invoice ${invoice.invoiceNumber} (${invoice.$id})`);
  return { pdfFileId: uploadedFile.$id, invoiceId: invoice.$id };
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
    await assertCallerIsAdminIfPresent(users, req);

    const body = req.bodyJson ?? {};

    if (body.action === 'regenerate') {
      const callerId = req.headers['x-appwrite-user-id'];
      if (!callerId) {
        const err = new Error('Missing x-appwrite-user-id header');
        err.status = 401;
        throw err;
      }
      const invoiceId = typeof body.invoiceId === 'string' ? body.invoiceId : null;
      if (!invoiceId) {
        const err = new Error('invoiceId is required');
        err.status = 400;
        throw err;
      }
      const result = await regenerateInvoicePdf({ tablesDB, storage, invoiceId, log, error });
      return res.json({ success: true, ...result });
    }

    const requestedCompanyId = typeof body.companyId === 'string' ? body.companyId : null;

    let companies;
    if (requestedCompanyId) {
      const company = await tablesDB.getRow({
        databaseId: DATABASE_ID,
        tableId: TABLES.companies,
        rowId: requestedCompanyId,
      });
      companies = [company];
    } else {
      companies = await listAllRows(tablesDB, TABLES.companies, [Query.isNotNull('hourlyRate')]);
    }
    companies = companies.filter((company) => typeof company.hourlyRate === 'number' && company.hourlyRate > 0);

    const settings = await getInvoiceSettings(tablesDB);
    const currency = settings?.currency || DEFAULT_CURRENCY;
    const vatEnabled = settings?.vatEnabled ?? true;
    const vatRate = vatEnabled ? (settings?.vatRate ?? 0) : 0;
    const paymentTermDays = settings?.paymentTermDays ?? 30;

    let invoicesCreated = 0;

    for (const company of companies) {
      const approvedEntries = await listAllRows(tablesDB, TABLES.timeEntries, [
        Query.equal('companyId', company.$id),
        Query.equal('approved', true),
      ]);
      const eligibleEntries = approvedEntries.filter((entry) => !entry.invoiced);
      if (eligibleEntries.length === 0) {
        log(`No unbilled approved hours for company ${company.$id}`);
        continue;
      }

      const taskIds = [...new Set(eligibleEntries.map((entry) => entry.taskId).filter(Boolean))];
      const tasks = await Promise.all(
        taskIds.map((taskId) =>
          tablesDB
            .getRow({ databaseId: DATABASE_ID, tableId: TABLES.tasks, rowId: taskId })
            .catch(() => null),
        ),
      );
      const taskById = new Map(tasks.filter(Boolean).map((task) => [task.$id, task]));

      const billableEntries = eligibleEntries.filter((entry) => {
        const task = taskById.get(entry.taskId);
        return (task?.audience ?? 'internal') !== 'client';
      });
      if (billableEntries.length === 0) {
        log(`No billable (non-client-audience) hours for company ${company.$id}`);
        continue;
      }

      const weekGroups = new Map();
      for (const entry of billableEntries) {
        const { key, periodStart, periodEnd } = weekKeyAndBounds(entry.workedDate);
        const group = weekGroups.get(key) ?? { periodStart, periodEnd, entries: [] };
        group.entries.push(entry);
        weekGroups.set(key, group);
      }

      const sortedWeekKeys = [...weekGroups.keys()].sort();
      for (const weekKey of sortedWeekKeys) {
        const group = weekGroups.get(weekKey);
        const totalHours = group.entries.reduce((sum, entry) => sum + (entry.hours ?? 0), 0);
        const totalAmount = Math.round(totalHours * company.hourlyRate * 100) / 100;
        const vatAmount = Math.round(totalAmount * vatRate) / 100;
        const totalWithVat = Math.round((totalAmount + vatAmount) * 100) / 100;
        const issueDate = new Date();
        const dueDate = new Date(issueDate);
        dueDate.setUTCDate(dueDate.getUTCDate() + paymentTermDays);
        const year = new Date(group.periodStart).getUTCFullYear();
        const invoiceNumber = await nextInvoiceNumber(tablesDB, year);

        const invoice = await tablesDB.createRow({
          databaseId: DATABASE_ID,
          tableId: TABLES.invoices,
          rowId: ID.unique(),
          data: {
            companyId: company.$id,
            invoiceNumber,
            periodStart: group.periodStart,
            periodEnd: group.periodEnd,
            hourlyRate: company.hourlyRate,
            totalHours,
            totalAmount,
            currency,
            status: 'generated',
            entryCount: group.entries.length,
            pdfFileId: null,
            issueDate: issueDate.toISOString(),
            dueDate: dueDate.toISOString(),
            vatRate,
            vatAmount,
            totalWithVat,
          },
          permissions: [
            Permission.read(Role.label(ADMIN_LABEL)),
            Permission.update(Role.label(ADMIN_LABEL)),
            Permission.delete(Role.label(ADMIN_LABEL)),
            Permission.read(Role.team(company.teamId)),
          ],
        });

        for (const entry of group.entries) {
          await tablesDB.updateRow({
            databaseId: DATABASE_ID,
            tableId: TABLES.timeEntries,
            rowId: entry.$id,
            data: { invoiced: true, invoiceId: invoice.$id },
          });
        }

        const lines = buildTaskLines(group.entries, taskById);

        try {
          const pdfBuffer = await renderToBuffer(buildInvoiceDocument({ invoice, company, lines, settings }));
          const uploadedFile = await uploadInvoicePdf(storage, {
            pdfBuffer,
            invoiceNumber,
            companyTeamId: company.teamId,
          });
          await tablesDB.updateRow({
            databaseId: DATABASE_ID,
            tableId: TABLES.invoices,
            rowId: invoice.$id,
            data: { pdfFileId: uploadedFile.$id },
          });
        } catch (pdfErr) {
          error(`PDF generation/upload failed for invoice ${invoice.$id}: ${pdfErr.message}`);
        }

        for (const taskId of new Set(group.entries.map((entry) => entry.taskId))) {
          const task = taskById.get(taskId);
          if (!task) continue;
          try {
            await tablesDB.updateRow({
              databaseId: DATABASE_ID,
              tableId: TABLES.tasks,
              rowId: taskId,
              data: {},
              permissions: stripNonAdminDeletePermissions(task.$permissions ?? []),
            });
          } catch (permErr) {
            log(`Could not tighten delete permissions on task ${taskId}: ${permErr.message}`);
          }
        }

        invoicesCreated += 1;
        log(
          `Created invoice ${invoiceNumber} for company ${company.$id}: ${totalHours}h, ${currency} ${totalWithVat} (incl. VAT)`,
        );
      }
    }

    return res.json({ success: true, invoicesCreated });
  } catch (err) {
    const status = err.status ?? 500;
    error(`generate-invoices failed: ${err.message}`);
    return res.json({ success: false, message: err.message }, status);
  }
};
