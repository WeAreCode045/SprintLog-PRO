import { Client, Users, TablesDB, Storage, Teams, Query, ID, Permission, Role } from 'node-appwrite';
import { InputFile } from 'node-appwrite/file';
import { renderToBuffer } from '@react-pdf/renderer';
import { buildInvoiceDocument } from '../lib/invoiceDocument.js';
import { flattenAdminSettings } from '../lib/appwrite.js';

const DATABASE_ID = 'main';
const TABLES = {
  companies: 'companies',
  timeEntries: 'timeEntries',
  invoices: 'invoices',
  invoiceItems: 'invoiceItems',
  // adminSettings replaces invoiceSettings — see flattenAdminSettings in lib/appwrite.js.
  invoiceSettings: 'adminSettings',
  notifications: 'notifications',
};
const INVOICE_PDF_BUCKET = 'invoice-pdfs';
const ADMIN_LABEL = 'admin';
const DEFAULT_CURRENCY = 'EUR';
const SETTINGS_ROW_ID = 'default';

/** Mirrors sites/project-manager/src/appwrite/permissions.ts#draftInvoicePermissions. */
function draftInvoicePermissions() {
  return [
    Permission.read(Role.label(ADMIN_LABEL)),
    Permission.update(Role.label(ADMIN_LABEL)),
    Permission.delete(Role.label(ADMIN_LABEL)),
  ];
}

/** Mirrors sites/project-manager/src/appwrite/permissions.ts#sentInvoicePermissions. */
function sentInvoicePermissions(teamId) {
  return [...draftInvoicePermissions(), Permission.read(Role.team(teamId))];
}

/** Mirrors sites/project-manager/src/appwrite/permissions.ts#lockedTimeEntryPermissions. */
function lockedTimeEntryPermissions(teamId) {
  return [
    Permission.read(Role.label(ADMIN_LABEL)),
    Permission.update(Role.label(ADMIN_LABEL)),
    Permission.delete(Role.label(ADMIN_LABEL)),
    Permission.read(Role.team(teamId)),
  ];
}

function notificationPermissions(userId) {
  return [Permission.read(Role.user(userId)), Permission.update(Role.user(userId))];
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

async function listTeamMemberIds(teams, teamId, log) {
  if (!teamId) return [];
  const userIds = [];
  let cursor = null;
  try {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const queries = [Query.limit(100)];
      if (cursor) {
        queries.push(Query.cursorAfter(cursor));
      }
      const result = await teams.listMemberships({ teamId, queries });
      const memberships = result.memberships ?? result.rows ?? [];
      if (memberships.length === 0) break;
      for (const membership of memberships) {
        if (membership.userId) {
          userIds.push(membership.userId);
        }
      }
      if (memberships.length < 100) break;
      cursor = memberships[memberships.length - 1].$id;
    }
  } catch (err) {
    log(`Unable to list team memberships for ${teamId}: ${err.message}`);
    return [];
  }
  return [...new Set(userIds)];
}

async function createNotification(tablesDB, payload, log) {
  const { userId, companyId, type, title, body, href } = payload;
  if (!userId || !companyId || !type || !title) return;
  await tablesDB.createRow({
    databaseId: DATABASE_ID,
    tableId: TABLES.notifications,
    rowId: ID.unique(),
    data: {
      userId,
      companyId,
      projectId: null,
      type,
      title,
      body: body ?? null,
      href: href ?? null,
      readAt: null,
      sourceId: null,
    },
    permissions: notificationPermissions(userId),
  });
  log(`Created ${type} notification for user ${userId}`);
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

/** Sum of quantity*unitPrice per item, VAT computed per distinct rate present (a manual
 * invoice can mix Hoog/Laag/0% lines) — mirrors invoiceDocument.js#groupVat so the numbers
 * stored on the invoice row match what the rendered PDF shows. */
function computeTotals(items) {
  let totalAmount = 0;
  let totalHours = 0;
  const vatGroups = new Map();
  for (const item of items) {
    const base = (item.quantity ?? 0) * (item.unitPrice ?? 0);
    totalAmount += base;
    totalHours += item.quantity ?? 0;
    const rate = item.vatRate ?? 0;
    vatGroups.set(rate, (vatGroups.get(rate) ?? 0) + base);
  }
  totalAmount = Math.round(totalAmount * 100) / 100;
  let vatAmount = 0;
  for (const [rate, base] of vatGroups) {
    vatAmount += Math.round(base * rate) / 100;
  }
  vatAmount = Math.round(vatAmount * 100) / 100;
  const totalWithVat = Math.round((totalAmount + vatAmount) * 100) / 100;
  return { totalAmount, totalHours, vatAmount, totalWithVat };
}

function sourceEntryIds(items) {
  return [...new Set(items.flatMap((item) => item.sourceTimeEntryIds ?? []).filter(Boolean))];
}

async function sendInvoice({ tablesDB, storage, teams, invoiceId, log, error }) {
  const invoice = await tablesDB.getRow({
    databaseId: DATABASE_ID,
    tableId: TABLES.invoices,
    rowId: invoiceId,
  });

  if (invoice.status !== 'draft') {
    const err = new Error('Only draft invoices can be sent');
    err.status = 400;
    throw err;
  }

  const items = await listAllRows(tablesDB, TABLES.invoiceItems, [Query.equal('invoiceId', invoiceId)]);
  if (items.length === 0) {
    const err = new Error('Invoice has no line items');
    err.status = 400;
    throw err;
  }
  items.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  const company = await tablesDB.getRow({
    databaseId: DATABASE_ID,
    tableId: TABLES.companies,
    rowId: invoice.companyId,
  });
  const settings = await getInvoiceSettings(tablesDB);
  const currency = invoice.currency || settings?.currency || DEFAULT_CURRENCY;

  const entryIds = sourceEntryIds(items);
  const entries = await Promise.all(
    entryIds.map((entryId) =>
      tablesDB
        .getRow({ databaseId: DATABASE_ID, tableId: TABLES.timeEntries, rowId: entryId })
        .catch(() => null),
    ),
  ).then((rows) => rows.filter(Boolean));
  const workedDates = entries.map((entry) => entry.workedDate).filter(Boolean).sort();
  const periodStart = workedDates[0] ?? null;
  const periodEnd = workedDates[workedDates.length - 1] ?? null;

  const { totalAmount, totalHours, vatAmount, totalWithVat } = computeTotals(items);
  const issueDate = new Date();
  const paymentTermDays = invoice.paymentTermDays ?? settings?.paymentTermDays ?? 30;
  const dueDate = new Date(issueDate);
  dueDate.setUTCDate(dueDate.getUTCDate() + paymentTermDays);
  const invoiceNumber = await nextInvoiceNumber(tablesDB, issueDate.getUTCFullYear());

  const updatedInvoice = {
    ...invoice,
    invoiceNumber,
    issueDate: issueDate.toISOString(),
    dueDate: dueDate.toISOString(),
    currency,
    totalAmount,
    vatAmount,
    totalWithVat,
  };

  const pdfBuffer = await renderToBuffer(
    buildInvoiceDocument({ invoice: updatedInvoice, company, items, settings }),
  );
  const uploadedFile = await uploadInvoicePdf(storage, {
    pdfBuffer,
    invoiceNumber,
    companyTeamId: company.teamId,
  });

  await tablesDB.updateRow({
    databaseId: DATABASE_ID,
    tableId: TABLES.invoices,
    rowId: invoice.$id,
    data: {
      status: 'sent',
      sentAt: issueDate.toISOString(),
      invoiceNumber,
      issueDate: issueDate.toISOString(),
      dueDate: dueDate.toISOString(),
      periodStart,
      periodEnd,
      paymentTermDays,
      totalAmount,
      totalHours,
      vatAmount,
      totalWithVat,
      pdfFileId: uploadedFile.$id,
    },
    permissions: sentInvoicePermissions(company.teamId),
  });

  for (const item of items) {
    await tablesDB.updateRow({
      databaseId: DATABASE_ID,
      tableId: TABLES.invoiceItems,
      rowId: item.$id,
      data: {},
      permissions: sentInvoicePermissions(company.teamId),
    });
  }

  for (const entry of entries) {
    await tablesDB.updateRow({
      databaseId: DATABASE_ID,
      tableId: TABLES.timeEntries,
      rowId: entry.$id,
      data: {},
      permissions: lockedTimeEntryPermissions(company.teamId),
    });
  }

  const memberIds = await listTeamMemberIds(teams, company.teamId, log);
  for (const userId of memberIds) {
    await createNotification(
      tablesDB,
      {
        userId,
        companyId: company.$id,
        type: 'invoice_sent',
        title: `Nieuwe factuur ${invoiceNumber}`,
        body: `${currency} ${totalWithVat.toFixed(2)}`,
        href: `/app/my-invoices/${invoice.$id}`,
      },
      log,
    );
  }

  log(`Sent invoice ${invoiceNumber} (${invoice.$id}) for company ${company.$id}`);
  return { invoiceId: invoice.$id, invoiceNumber, pdfFileId: uploadedFile.$id };
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
  if (invoice.status !== 'sent') {
    const err = new Error('Only sent invoices can be regenerated');
    err.status = 400;
    throw err;
  }

  const company = await tablesDB.getRow({
    databaseId: DATABASE_ID,
    tableId: TABLES.companies,
    rowId: invoice.companyId,
  });
  const settings = await getInvoiceSettings(tablesDB);

  const items = await listAllRows(tablesDB, TABLES.invoiceItems, [Query.equal('invoiceId', invoice.$id)]);
  if (items.length === 0) {
    const err = new Error('Invoice has no line items to rebuild the PDF');
    err.status = 400;
    throw err;
  }
  items.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  const pdfBuffer = await renderToBuffer(buildInvoiceDocument({ invoice, company, items, settings }));
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
  const teams = new Teams(client);

  try {
    await assertCallerIsAdmin(users, req);

    const body = req.bodyJson ?? {};
    const invoiceId = typeof body.invoiceId === 'string' ? body.invoiceId : null;
    if (!invoiceId) {
      const err = new Error('invoiceId is required');
      err.status = 400;
      throw err;
    }

    if (body.action === 'regenerate') {
      const result = await regenerateInvoicePdf({ tablesDB, storage, invoiceId, log, error });
      return res.json({ success: true, ...result });
    }

    const result = await sendInvoice({ tablesDB, storage, teams, invoiceId, log, error });
    return res.json({ success: true, ...result });
  } catch (err) {
    const status = err.status ?? 500;
    error(`send-invoice failed: ${err.message}`);
    return res.json({ success: false, message: err.message }, status);
  }
};
