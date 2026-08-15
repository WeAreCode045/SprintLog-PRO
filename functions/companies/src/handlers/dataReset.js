import { Query } from 'node-appwrite';
import {
  DATABASE_ID,
  TABLES,
  PROJECT_FILES_BUCKET,
  INVOICE_PDF_BUCKET,
  listAllRows,
} from '../lib/appwrite.js';

function assertCompanyId(companyId) {
  if (!companyId?.trim()) {
    const err = new Error('companyId is required');
    err.status = 400;
    throw err;
  }
  return companyId.trim();
}

function filterQueries(companyId, projectId) {
  const queries = [Query.equal('companyId', companyId)];
  if (projectId?.trim()) {
    queries.push(Query.equal('projectId', projectId.trim()));
  }
  return queries;
}

async function countRows(tablesDB, tableId, queries) {
  const rows = await listAllRows(tablesDB, tableId, queries);
  return rows.length;
}

function previewItem(kind, count) {
  return { kind, count };
}

async function deleteRowsWithQueries(tablesDB, tableId, queries, log) {
  let deleted = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const result = await tablesDB.listRows({
      databaseId: DATABASE_ID,
      tableId,
      queries: [...queries, Query.limit(100)],
    });
    if (result.rows.length === 0) break;
    for (const row of result.rows) {
      await tablesDB.deleteRow({ databaseId: DATABASE_ID, tableId, rowId: row.$id });
      deleted++;
    }
  }
  log(`Deleted ${deleted} row(s) from ${tableId}`);
  return deleted;
}

async function previewInvoicing({ tablesDB, companyId, projectId }) {
  const entryQueries = filterQueries(companyId, projectId);
  const invoicedEntries = await listAllRows(tablesDB, TABLES.timeEntries, [
    ...entryQueries,
    Query.equal('invoiced', true),
  ]);

  let deletedInvoices = 0;
  let deletedItems = 0;

  if (projectId?.trim()) {
    const invoiceIds = new Set();
    for (const entry of invoicedEntries) {
      if (entry.invoiceId) invoiceIds.add(entry.invoiceId);
    }
    for (const invoiceId of invoiceIds) {
      const items = await listAllRows(tablesDB, TABLES.invoiceItems, [Query.equal('invoiceId', invoiceId)]);
      let removedItems = 0;
      for (const item of items) {
        const overlapsProject = (item.sourceTimeEntryIds ?? []).some((entryId) =>
          invoicedEntries.some((entry) => entry.$id === entryId),
        );
        if (overlapsProject) removedItems++;
      }
      deletedItems += removedItems;
      if (items.length - removedItems === 0) deletedInvoices++;
    }
  } else {
    const invoices = await listAllRows(tablesDB, TABLES.invoices, [Query.equal('companyId', companyId)]);
    deletedInvoices = invoices.length;
    for (const invoice of invoices) {
      deletedItems += await countRows(tablesDB, TABLES.invoiceItems, [Query.equal('invoiceId', invoice.$id)]);
    }
  }

  return {
    items: [
      previewItem('invoices', deletedInvoices),
      previewItem('invoiceItems', deletedItems),
      previewItem('invoicedEntriesReleased', invoicedEntries.length),
    ],
  };
}

async function previewApprovedHours({ tablesDB, companyId, projectId }) {
  const count = await countRows(tablesDB, TABLES.timeEntries, [
    ...filterQueries(companyId, projectId),
    Query.equal('approved', true),
  ]);
  return { items: [previewItem('approvedEntries', count)] };
}

async function previewBookedHours({ tablesDB, companyId, projectId }) {
  const count = await countRows(tablesDB, TABLES.timeEntries, filterQueries(companyId, projectId));
  return { items: [previewItem('timeEntries', count)] };
}

async function previewTasks({ tablesDB, companyId, projectId }) {
  const count = await countRows(tablesDB, TABLES.tasks, filterQueries(companyId, projectId));
  return { items: [previewItem('tasks', count)] };
}

async function previewProjects({ tablesDB, companyId, projectId }) {
  const projectQueries = projectId?.trim()
    ? [Query.equal('$id', projectId.trim())]
    : [Query.equal('companyId', companyId)];

  const projects = await listAllRows(tablesDB, TABLES.projects, projectQueries);
  const totals = {
    projects: projects.length,
    timeEntries: 0,
    tasks: 0,
    taskGroups: 0,
    discussions: 0,
    discussionReplies: 0,
    projectAssignments: 0,
    notifications: 0,
    projectFiles: 0,
  };

  for (const project of projects) {
    const scopedQueries = filterQueries(project.companyId ?? companyId, project.$id);
    totals.timeEntries += await countRows(tablesDB, TABLES.timeEntries, scopedQueries);
    totals.tasks += await countRows(tablesDB, TABLES.tasks, scopedQueries);
    totals.taskGroups += await countRows(tablesDB, TABLES.taskGroups, scopedQueries);
    totals.discussions += await countRows(tablesDB, TABLES.discussions, scopedQueries);
    totals.discussionReplies += await countRows(tablesDB, TABLES.discussionReplies, scopedQueries);
    totals.projectAssignments += await countRows(tablesDB, TABLES.projectAssignments, scopedQueries);
    totals.notifications += await countRows(tablesDB, TABLES.notifications, scopedQueries);
    totals.projectFiles += await countRows(tablesDB, TABLES.projectFiles, scopedQueries);
  }

  return {
    items: [
      previewItem('projects', totals.projects),
      previewItem('tasks', totals.tasks),
      previewItem('timeEntries', totals.timeEntries),
      previewItem('taskGroups', totals.taskGroups),
      previewItem('discussions', totals.discussions),
      previewItem('discussionReplies', totals.discussionReplies),
      previewItem('projectAssignments', totals.projectAssignments),
      previewItem('notifications', totals.notifications),
      previewItem('projectFiles', totals.projectFiles),
    ].filter((item) => item.count > 0),
  };
}

async function resetInvoicing({ tablesDB, storage, companyId, projectId, log, error }) {
  const entryQueries = filterQueries(companyId, projectId);
  const invoicedEntries = await listAllRows(tablesDB, TABLES.timeEntries, [
    ...entryQueries,
    Query.equal('invoiced', true),
  ]);

  const invoiceIds = new Set();
  for (const entry of invoicedEntries) {
    if (entry.invoiceId) invoiceIds.add(entry.invoiceId);
    await tablesDB.updateRow({
      databaseId: DATABASE_ID,
      tableId: TABLES.timeEntries,
      rowId: entry.$id,
      data: { invoiced: false, invoiceId: null },
    });
  }

  let deletedInvoices = 0;
  let deletedItems = 0;

  if (projectId?.trim()) {
    for (const invoiceId of invoiceIds) {
      const items = await listAllRows(tablesDB, TABLES.invoiceItems, [Query.equal('invoiceId', invoiceId)]);
      const remainingIds = [];
      for (const item of items) {
        const sourceIds = item.sourceTimeEntryIds ?? [];
        const overlapsProject = sourceIds.some((entryId) =>
          invoicedEntries.some((entry) => entry.$id === entryId),
        );
        if (overlapsProject) {
          await tablesDB.deleteRow({
            databaseId: DATABASE_ID,
            tableId: TABLES.invoiceItems,
            rowId: item.$id,
          });
          deletedItems++;
        } else {
          remainingIds.push(item.$id);
        }
      }
      if (remainingIds.length === 0) {
        const invoice = await tablesDB.getRow({
          databaseId: DATABASE_ID,
          tableId: TABLES.invoices,
          rowId: invoiceId,
        });
        if (invoice.pdfFileId) {
          try {
            await storage.deleteFile({ bucketId: INVOICE_PDF_BUCKET, fileId: invoice.pdfFileId });
          } catch (err) {
            error(`Skipped invoice PDF ${invoice.pdfFileId}: ${err.message}`);
          }
        }
        await tablesDB.deleteRow({
          databaseId: DATABASE_ID,
          tableId: TABLES.invoices,
          rowId: invoiceId,
        });
        deletedInvoices++;
      }
    }
  } else {
    const invoices = await listAllRows(tablesDB, TABLES.invoices, [Query.equal('companyId', companyId)]);
    for (const invoice of invoices) {
      const items = await listAllRows(tablesDB, TABLES.invoiceItems, [Query.equal('invoiceId', invoice.$id)]);
      for (const item of items) {
        await tablesDB.deleteRow({
          databaseId: DATABASE_ID,
          tableId: TABLES.invoiceItems,
          rowId: item.$id,
        });
        deletedItems++;
      }
      if (invoice.pdfFileId) {
        try {
          await storage.deleteFile({ bucketId: INVOICE_PDF_BUCKET, fileId: invoice.pdfFileId });
        } catch (err) {
          error(`Skipped invoice PDF ${invoice.pdfFileId}: ${err.message}`);
        }
      }
      await tablesDB.deleteRow({
        databaseId: DATABASE_ID,
        tableId: TABLES.invoices,
        rowId: invoice.$id,
      });
      deletedInvoices++;
    }
  }

  return {
    releasedEntries: invoicedEntries.length,
    deletedInvoiceItems: deletedItems,
    deletedInvoices,
  };
}

async function resetApprovedHours({ tablesDB, companyId, projectId, log }) {
  const entries = await listAllRows(tablesDB, TABLES.timeEntries, [
    ...filterQueries(companyId, projectId),
    Query.equal('approved', true),
  ]);
  for (const entry of entries) {
    await tablesDB.updateRow({
      databaseId: DATABASE_ID,
      tableId: TABLES.timeEntries,
      rowId: entry.$id,
      data: { approved: false },
    });
  }
  log(`Unapproved ${entries.length} time entry row(s)`);
  return { unapprovedEntries: entries.length };
}

async function resetBookedHours({ tablesDB, companyId, projectId, log }) {
  const deleted = await deleteRowsWithQueries(
    tablesDB,
    TABLES.timeEntries,
    filterQueries(companyId, projectId),
    log,
  );
  return { deletedEntries: deleted };
}

async function deleteProjectFiles(tablesDB, storage, queries, log, error) {
  let deletedRows = 0;
  let deletedFiles = 0;
  const rows = await listAllRows(tablesDB, TABLES.projectFiles, queries);
  for (const row of rows) {
    if (row.bucketFileId) {
      try {
        await storage.deleteFile({ bucketId: PROJECT_FILES_BUCKET, fileId: row.bucketFileId });
        deletedFiles++;
      } catch (err) {
        error(`Skipped storage file ${row.bucketFileId}: ${err.message}`);
      }
    }
    await tablesDB.deleteRow({
      databaseId: DATABASE_ID,
      tableId: TABLES.projectFiles,
      rowId: row.$id,
    });
    deletedRows++;
  }
  log(`Deleted ${deletedRows} projectFiles row(s) and ${deletedFiles} storage file(s)`);
  return deletedRows;
}

async function resetTasks({ tablesDB, companyId, projectId, log }) {
  const deleted = await deleteRowsWithQueries(
    tablesDB,
    TABLES.tasks,
    filterQueries(companyId, projectId),
    log,
  );
  return { deletedTasks: deleted };
}

async function resetProjects({ tablesDB, storage, companyId, projectId, log, error }) {
  const projectQueries = projectId?.trim()
    ? [Query.equal('$id', projectId.trim())]
    : [Query.equal('companyId', companyId)];

  const projects = await listAllRows(tablesDB, TABLES.projects, projectQueries);
  let deletedProjects = 0;

  for (const project of projects) {
    const scopedCompanyId = project.companyId ?? companyId;
    const scopedProjectId = project.$id;
    const scopedQueries = filterQueries(scopedCompanyId, scopedProjectId);

    await deleteRowsWithQueries(tablesDB, TABLES.timeEntries, scopedQueries, log);
    await deleteRowsWithQueries(tablesDB, TABLES.tasks, scopedQueries, log);
    await deleteRowsWithQueries(tablesDB, TABLES.taskGroups, scopedQueries, log);
    await deleteRowsWithQueries(tablesDB, TABLES.discussions, scopedQueries, log);
    await deleteRowsWithQueries(tablesDB, TABLES.discussionReplies, scopedQueries, log);
    await deleteRowsWithQueries(tablesDB, TABLES.projectAssignments, scopedQueries, log);
    await deleteRowsWithQueries(tablesDB, TABLES.notifications, scopedQueries, log);
    await deleteProjectFiles(tablesDB, storage, scopedQueries, log, error);

    await tablesDB.deleteRow({
      databaseId: DATABASE_ID,
      tableId: TABLES.projects,
      rowId: scopedProjectId,
    });
    deletedProjects++;
  }

  return { deletedProjects };
}

const PREVIEW_HANDLERS = {
  invoicing: previewInvoicing,
  approvedHours: previewApprovedHours,
  bookedHours: previewBookedHours,
  tasks: previewTasks,
  projects: previewProjects,
};

const RESET_HANDLERS = {
  invoicing: resetInvoicing,
  approvedHours: resetApprovedHours,
  bookedHours: resetBookedHours,
  tasks: resetTasks,
  projects: resetProjects,
};

export async function handleDataReset({ body, tablesDB, storage, log, error }) {
  const resetType = body.resetType;
  const companyId = assertCompanyId(body.companyId);
  const projectId = body.projectId?.trim() || undefined;
  const dryRun = Boolean(body.dryRun);

  const handler = dryRun ? PREVIEW_HANDLERS[resetType] : RESET_HANDLERS[resetType];
  if (!handler) {
    const err = new Error(`Unsupported resetType: ${resetType}`);
    err.status = 400;
    throw err;
  }

  log(`dataReset ${dryRun ? 'preview' : 'execute'} ${resetType} for company=${companyId} project=${projectId ?? 'all'}`);
  const result = await handler({ tablesDB, storage, companyId, projectId, log, error });

  return {
    success: true,
    dryRun,
    resetType,
    companyId,
    projectId: projectId ?? null,
    ...result,
  };
}
