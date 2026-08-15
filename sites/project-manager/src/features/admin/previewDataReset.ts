import { Query } from 'appwrite';
import { tablesDB } from '../../appwrite/client';
import { DATABASE_ID, TABLES } from '../../appwrite/constants';
import type { InvoiceItemRow, InvoiceRow, ProjectRow, TimeEntryRow } from '../../appwrite/types';
import type { RowMeta } from '../../specs/types';
import type { AdminDataResetPreviewItem, AdminDataResetType } from '../../lib/functions';

function filterQueries(companyId: string, projectId?: string) {
  const queries = [Query.equal('companyId', companyId)];
  if (projectId?.trim()) {
    queries.push(Query.equal('projectId', projectId.trim()));
  }
  return queries;
}

async function listAllRows<T extends RowMeta>(tableId: string, queries: string[]) {
  const rows: T[] = [];
  let cursor: string | null = null;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const pageQueries = [...queries, Query.limit(100)];
    if (cursor) {
      pageQueries.push(Query.cursorAfter(cursor));
    }
    const result = await tablesDB.listRows<T>({
      databaseId: DATABASE_ID,
      tableId,
      queries: pageQueries,
    });
    if (result.rows.length === 0) break;
    rows.push(...result.rows);
    if (result.rows.length < 100) break;
    cursor = result.rows[result.rows.length - 1].$id;
  }
  return rows;
}

async function countRows(tableId: string, queries: string[]) {
  return listAllRows(tableId, queries).then((rows) => rows.length);
}

function previewItem(kind: AdminDataResetPreviewItem['kind'], count: number): AdminDataResetPreviewItem {
  return { kind, count };
}

async function previewInvoicing(companyId: string, projectId?: string) {
  const entryQueries = filterQueries(companyId, projectId);
  const invoicedEntries = await listAllRows<TimeEntryRow>(TABLES.timeEntries, [
    ...entryQueries,
    Query.equal('invoiced', true),
  ]);

  let deletedInvoices = 0;
  let deletedItems = 0;

  if (projectId?.trim()) {
    const invoiceIds = new Set<string>();
    for (const entry of invoicedEntries) {
      if (entry.invoiceId) invoiceIds.add(entry.invoiceId);
    }
    for (const invoiceId of invoiceIds) {
      const items = await listAllRows<InvoiceItemRow>(TABLES.invoiceItems, [Query.equal('invoiceId', invoiceId)]);
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
    const invoices = await listAllRows<InvoiceRow>(TABLES.invoices, [Query.equal('companyId', companyId)]);
    deletedInvoices = invoices.length;
    deletedItems = await countRows(TABLES.invoiceItems, [Query.equal('companyId', companyId)]);
  }

  return {
    items: [
      previewItem('invoices', deletedInvoices),
      previewItem('invoiceItems', deletedItems),
      previewItem('invoicedEntriesReleased', invoicedEntries.length),
    ],
  };
}

async function previewApprovedHours(companyId: string, projectId?: string) {
  const count = await countRows(TABLES.timeEntries, [
    ...filterQueries(companyId, projectId),
    Query.equal('approved', true),
  ]);
  return { items: [previewItem('approvedEntries', count)] };
}

async function previewBookedHours(companyId: string, projectId?: string) {
  const count = await countRows(TABLES.timeEntries, filterQueries(companyId, projectId));
  return { items: [previewItem('timeEntries', count)] };
}

async function previewTasks(companyId: string, projectId?: string) {
  const count = await countRows(TABLES.tasks, filterQueries(companyId, projectId));
  return { items: [previewItem('tasks', count)] };
}

async function previewProjects(companyId: string, projectId?: string) {
  const projectQueries = projectId?.trim()
    ? [Query.equal('$id', projectId.trim())]
    : [Query.equal('companyId', companyId)];

  const projects = await listAllRows<ProjectRow>(TABLES.projects, projectQueries);
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
    totals.timeEntries += await countRows(TABLES.timeEntries, scopedQueries);
    totals.tasks += await countRows(TABLES.tasks, scopedQueries);
    totals.taskGroups += await countRows(TABLES.taskGroups, scopedQueries);
    totals.discussions += await countRows(TABLES.discussions, scopedQueries);
    totals.discussionReplies += await countRows(TABLES.discussionReplies, scopedQueries);
    totals.projectAssignments += await countRows(TABLES.projectAssignments, scopedQueries);
    totals.notifications += await countRows(TABLES.notifications, scopedQueries);
    totals.projectFiles += await countRows(TABLES.projectFiles, scopedQueries);
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

const PREVIEW_HANDLERS: Record<
  AdminDataResetType,
  (companyId: string, projectId?: string) => Promise<{ items: AdminDataResetPreviewItem[] }>
> = {
  invoicing: previewInvoicing,
  approvedHours: previewApprovedHours,
  bookedHours: previewBookedHours,
  tasks: previewTasks,
  projects: previewProjects,
};

export async function previewDataReset(input: {
  resetType: AdminDataResetType;
  companyId: string;
  projectId?: string;
}): Promise<{
  success: boolean;
  dryRun: boolean;
  resetType: AdminDataResetType;
  companyId: string;
  projectId: string | null;
  items: AdminDataResetPreviewItem[];
}> {
  const companyId = input.companyId.trim();
  if (!companyId) {
    throw new Error('companyId is required');
  }
  const projectId = input.projectId?.trim() || undefined;
  const handler = PREVIEW_HANDLERS[input.resetType];
  const result = await handler(companyId, projectId);

  return {
    success: true,
    dryRun: true,
    resetType: input.resetType,
    companyId,
    projectId: projectId ?? null,
    items: result.items,
  };
}
