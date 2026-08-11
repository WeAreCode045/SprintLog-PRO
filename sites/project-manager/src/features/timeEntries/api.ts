import { ID, Query } from 'appwrite';
import { tablesDB } from '../../appwrite/client';
import { DATABASE_ID, TABLES } from '../../appwrite/constants';
import { clientSafeTimeEntryPermissions, timeEntryPermissions } from '../../appwrite/permissions';
import type { TaskRow, TimeEntryRow } from '../../appwrite/types';
import { approveTimeEntries as approveTimeEntriesFn, assignProjectDeveloper, unlockTimeEntries as unlockTimeEntriesFn } from '../../lib/functions';

function isPermissionGrantError(err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  return message.includes('Permissions must be one of');
}

async function syncTimeEntryAcl(input: {
  companyId: string;
  teamId: string;
  projectId: string;
}) {
  try {
    await assignProjectDeveloper({
      action: 'syncTimeEntryPermissions',
      companyId: input.companyId,
      teamId: input.teamId,
      projectId: input.projectId,
    });
  } catch {
    // Row exists; ACL sync is best-effort via API key.
  }
}

export async function listTimeEntriesByTask(taskId: string) {
  const result = await tablesDB.listRows<TimeEntryRow>({
    databaseId: DATABASE_ID,
    tableId: TABLES.timeEntries,
    queries: [Query.equal('taskId', taskId), Query.orderDesc('workedDate'), Query.limit(500)],
  });
  return result.rows;
}

export async function listTimeEntriesByProject(projectId: string) {
  const result = await tablesDB.listRows<TimeEntryRow>({
    databaseId: DATABASE_ID,
    tableId: TABLES.timeEntries,
    queries: [Query.equal('projectId', projectId), Query.orderDesc('workedDate'), Query.limit(1000)],
  });
  return result.rows;
}

export async function listTimeEntriesByCompany(
  companyId: string,
  filters: { start: Date; end: Date; projectId?: string; userId?: string },
) {
  return listTimeEntriesForCompanies([companyId], filters);
}

export async function listTimeEntriesForCompanies(
  companyIds: string[],
  filters: { start: Date; end: Date; projectId?: string; userId?: string },
) {
  if (companyIds.length === 0) return [];
  const queries = [
    Query.equal('companyId', companyIds),
    Query.greaterThanEqual('workedDate', filters.start.toISOString()),
    Query.lessThanEqual('workedDate', filters.end.toISOString()),
    Query.orderDesc('workedDate'),
    Query.limit(2000),
  ];
  if (filters.projectId) {
    queries.push(Query.equal('projectId', filters.projectId));
  }
  if (filters.userId) {
    queries.push(Query.equal('userId', filters.userId));
  }
  const result = await tablesDB.listRows<TimeEntryRow>({
    databaseId: DATABASE_ID,
    tableId: TABLES.timeEntries,
    queries,
  });
  return result.rows;
}

async function syncTaskHoursTotal(taskId: string) {
  const entries = await listTimeEntriesByTask(taskId);
  const totalHours = entries.reduce((sum, entry) => sum + (entry.hours ?? 0), 0);
  return tablesDB.updateRow<TaskRow>({
    databaseId: DATABASE_ID,
    tableId: TABLES.tasks,
    rowId: taskId,
    data: { hours: totalHours },
  });
}

export async function createTimeEntry(input: {
  companyId: string;
  projectId: string;
  taskId: string;
  teamId: string;
  userId: string;
  hours: number;
  workedDate: Date;
  comment?: string | null;
}) {
  let entry: TimeEntryRow;
  try {
    entry = await tablesDB.createRow<TimeEntryRow>({
      databaseId: DATABASE_ID,
      tableId: TABLES.timeEntries,
      rowId: ID.unique(),
      data: {
        companyId: input.companyId,
        projectId: input.projectId,
        taskId: input.taskId,
        userId: input.userId,
        hours: input.hours,
        workedDate: input.workedDate.toISOString(),
        comment: input.comment?.trim() ? input.comment.trim() : null,
      },
      // Prefer team ACL when the actor is a company team member.
      permissions: timeEntryPermissions(input.teamId, input.userId, {
        canGrantStaffRoles: false,
      }),
    });
  } catch (err) {
    if (!isPermissionGrantError(err)) throw err;
    // Admins are often not members of client teams and cannot grant team:*.
    entry = await tablesDB.createRow<TimeEntryRow>({
      databaseId: DATABASE_ID,
      tableId: TABLES.timeEntries,
      rowId: ID.unique(),
      data: {
        companyId: input.companyId,
        projectId: input.projectId,
        taskId: input.taskId,
        userId: input.userId,
        hours: input.hours,
        workedDate: input.workedDate.toISOString(),
        comment: input.comment?.trim() ? input.comment.trim() : null,
      },
      permissions: clientSafeTimeEntryPermissions(input.userId),
    });
    await syncTimeEntryAcl({
      companyId: input.companyId,
      teamId: input.teamId,
      projectId: input.projectId,
    });
  }
  await syncTaskHoursTotal(input.taskId);
  return entry;
}

export async function updateTimeEntry(input: {
  entryId: string;
  taskId: string;
  hours: number;
  workedDate: Date;
  comment?: string | null;
}) {
  const entry = await tablesDB.updateRow<TimeEntryRow>({
    databaseId: DATABASE_ID,
    tableId: TABLES.timeEntries,
    rowId: input.entryId,
    data: {
      hours: input.hours,
      workedDate: input.workedDate.toISOString(),
      comment: input.comment?.trim() ? input.comment.trim() : null,
    },
  });
  await syncTaskHoursTotal(input.taskId);
  return entry;
}

export async function deleteTimeEntry(input: { entryId: string; taskId: string }) {
  await tablesDB.deleteRow({
    databaseId: DATABASE_ID,
    tableId: TABLES.timeEntries,
    rowId: input.entryId,
  });
  await syncTaskHoursTotal(input.taskId);
}

export async function hasInvoicedTimeEntries(taskId: string) {
  const result = await tablesDB.listRows<TimeEntryRow>({
    databaseId: DATABASE_ID,
    tableId: TABLES.timeEntries,
    queries: [Query.equal('taskId', taskId), Query.equal('invoiced', true), Query.limit(1)],
  });
  return result.rows.length > 0;
}

export async function approveTimeEntries(input: { entryIds: string[]; teamId: string }) {
  return approveTimeEntriesFn(input);
}

export async function unlockTimeEntries(input: { entryIds: string[]; teamId: string; reason: string }) {
  return unlockTimeEntriesFn(input);
}
