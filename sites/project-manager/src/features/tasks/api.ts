import { ID, Query } from 'appwrite';
import { tablesDB } from '../../appwrite/client';
import { DATABASE_ID, TABLES } from '../../appwrite/constants';
import {
  adminOnlyTaskPermissions,
  clientSafeOpenTaskPermissions,
  selfOnlyPermissions,
} from '../../appwrite/permissions';
import type { TaskAudience, TaskPriority, TaskRow, TaskStatus, TaskType } from '../../appwrite/types';
import { listAssignmentsByProject } from '../assignments/api';
import { hasInvoicedTimeEntries } from '../timeEntries/api';
import { assignProjectDeveloper, assignTaskAssignees } from '../../lib/functions';

function isPermissionGrantError(err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  return message.includes('Permissions must be one of');
}

async function projectAssigneeIds(projectId: string): Promise<string[]> {
  const assignments = await listAssignmentsByProject(projectId);
  return [...new Set(assignments.map((row) => row.userId).filter(Boolean))];
}

/** Task assignees, or project developers when the task has none. */
export function effectiveTaskAssigneeIds(
  task: Pick<TaskRow, 'assigneeIds' | 'projectId'>,
  projectAssigneesByProjectId: Map<string, string[]>,
): string[] {
  if (task.assigneeIds?.length) return task.assigneeIds;
  return projectAssigneesByProjectId.get(task.projectId) ?? [];
}

export type TaskFilter = 'all' | 'open' | 'completed';

export async function listTasks(companyId: string, filter: TaskFilter) {
  return listTasksForCompanies([companyId], filter);
}

export async function listTasksForCompanies(companyIds: string[], filter: TaskFilter) {
  if (companyIds.length === 0) return [];
  const queries = [
    Query.equal('companyId', companyIds),
    Query.orderDesc('$createdAt'),
    Query.limit(500),
  ];
  if (filter === 'open') {
    // Include requested so the Requested Tasks section can load alongside open developer tasks.
    queries.push(Query.equal('status', ['open', 'requested']));
  } else if (filter === 'completed') {
    queries.push(Query.equal('status', 'finished'));
  }
  const result = await tablesDB.listRows<TaskRow>({
    databaseId: DATABASE_ID,
    tableId: TABLES.tasks,
    queries,
  });
  return result.rows;
}

export async function listTasksByProject(projectId: string) {
  const result = await tablesDB.listRows<TaskRow>({
    databaseId: DATABASE_ID,
    tableId: TABLES.tasks,
    // Sort client-side by `order` — querying orderAsc('order') can omit rows with null order.
    queries: [Query.equal('projectId', projectId), Query.orderDesc('$createdAt'), Query.limit(500)],
  });
  return result.rows;
}

export interface CompletedFilters {
  start: Date;
  end: Date;
  projectId?: string;
  assigneeId?: string;
}

/** Finished developer tasks only — Client Tasks never enter time reporting. */
export async function listCompletedTasksInRange(companyId: string, filters: CompletedFilters) {
  const queries = [
    Query.equal('companyId', companyId),
    Query.equal('status', 'finished'),
    Query.equal('audience', 'internal'),
    Query.greaterThanEqual('completedDate', filters.start.toISOString()),
    Query.lessThanEqual('completedDate', filters.end.toISOString()),
    Query.orderDesc('completedDate'),
    Query.limit(1000),
  ];
  if (filters.projectId) {
    queries.push(Query.equal('projectId', filters.projectId));
  }
  const result = await tablesDB.listRows<TaskRow>({
    databaseId: DATABASE_ID,
    tableId: TABLES.tasks,
    queries,
  });
  let rows = result.rows;
  if (filters.assigneeId) {
    rows = rows.filter((task) => task.assigneeIds?.includes(filters.assigneeId!));
  }
  return rows;
}

export async function createTask(input: {
  companyId: string;
  teamId: string;
  projectId: string;
  taskGroupId?: string;
  title: string;
  description?: string;
  userId: string;
  parentTaskId?: string | null;
  audience?: TaskAudience;
  status?: TaskStatus;
  assigneeIds?: string[];
  requiresFileUpload?: boolean;
  priority?: TaskPriority | null;
  taskType?: TaskType | null;
  dueDate?: string | null;
}) {
  const audience = input.audience ?? 'internal';
  const status: TaskStatus = input.status ?? 'open';
  let assigneeIds = [...(input.assigneeIds ?? [])];
  if (assigneeIds.length === 0) {
    assigneeIds = await projectAssigneeIds(input.projectId);
  }
  const rowId = ID.unique();
  const data = {
      companyId: input.companyId,
      projectId: input.projectId,
      taskGroupId: input.taskGroupId || null,
      title: input.title,
    description: input.description?.trim() ? input.description.trim() : null,
    status,
      createdBy: input.userId,
    parentTaskId: input.parentTaskId ?? null,
    audience,
    assigneeIds,
    requiresFileUpload: input.requiresFileUpload ?? false,
    priority: input.priority ?? 'medium',
    taskType: input.taskType ?? 'development',
    dueDate: input.dueDate ?? null,
    // Ensure new rows appear in order-sorted queries and client trees.
    order: Date.now() / 1000,
  };

  let created: TaskRow;
  try {
    created = await tablesDB.createRow<TaskRow>({
      databaseId: DATABASE_ID,
      tableId: TABLES.tasks,
      rowId,
      data,
      // Prefer team ACL when the actor is a company team member (e.g. a client).
      permissions: clientSafeOpenTaskPermissions(input.teamId),
    });
  } catch (err) {
    if (!isPermissionGrantError(err)) throw err;
    // Staff not on the company team (e.g. a developer) can only grant permissions about
    // themselves; table-level label:admin/label:developer grants cover their own access.
    created = await tablesDB.createRow<TaskRow>({
      databaseId: DATABASE_ID,
      tableId: TABLES.tasks,
      rowId,
      data,
      permissions: selfOnlyPermissions(input.userId),
    });
  }

  // Always sync so the row ends up with the full team+staff+assignee ACL, regardless of
  // which client-safe tier the create attempt used.
  try {
    await assignProjectDeveloper({
      action: 'syncPermissions',
      companyId: input.companyId,
      projectId: input.projectId,
      teamId: input.teamId,
    });
  } catch {
    // Row exists; ACL sync is best-effort via API key. Staff still has table-level read/update.
  }

  return created;
}

export async function acceptRequestedTask(input: {
  taskId: string;
  teamId: string;
  companyId?: string;
  createdBy?: string | null;
  assigneeIds?: string[] | null;
}) {
  let assignees = [...(input.assigneeIds ?? [])];
  let projectId = '';
  if (assignees.length === 0 || !input.companyId) {
    const task = await tablesDB.getRow<TaskRow>({
      databaseId: DATABASE_ID,
      tableId: TABLES.tasks,
      rowId: input.taskId,
    });
    projectId = task.projectId;
    if (assignees.length === 0) {
      assignees = task.assigneeIds?.length
        ? [...task.assigneeIds]
        : await projectAssigneeIds(task.projectId);
    }
  }
  const data = {
    status: 'open' as const,
    assigneeIds: assignees,
  };
  let updated: TaskRow;
  try {
    updated = await tablesDB.updateRow<TaskRow>({
      databaseId: DATABASE_ID,
      tableId: TABLES.tasks,
      rowId: input.taskId,
      data,
      permissions: adminOnlyTaskPermissions(),
    });
  } catch (err) {
    if (!isPermissionGrantError(err)) throw err;
    updated = await tablesDB.updateRow<TaskRow>({
      databaseId: DATABASE_ID,
      tableId: TABLES.tasks,
      rowId: input.taskId,
      data,
    });
  }

  const syncCompanyId = input.companyId ?? updated.companyId;
  const syncProjectId = projectId || updated.projectId;
  if (syncCompanyId && syncProjectId) {
    try {
      await assignProjectDeveloper({
        action: 'syncPermissions',
        companyId: syncCompanyId,
        projectId: syncProjectId,
        teamId: input.teamId,
      });
    } catch {
      // Status already updated with admin ACL.
    }
  }

  return updated;
}

export async function updateOpenTask(
  taskId: string,
  data: {
    title?: string;
    description?: string | null;
    projectId?: string;
    taskGroupId?: string | null;
    parentTaskId?: string | null;
    audience?: TaskAudience;
    requiresFileUpload?: boolean;
    priority?: TaskPriority | null;
    taskType?: TaskType | null;
    dueDate?: string | null;
  },
  access?: {
    teamId: string;
    companyId: string;
    createdBy?: string | null;
    assigneeIds?: string[] | null;
  },
) {
  const payload = {
    ...data,
    description:
      data.description === undefined
        ? undefined
        : data.description?.trim()
          ? data.description.trim()
          : null,
    taskGroupId: data.taskGroupId === undefined ? undefined : data.taskGroupId || null,
  };

  // Data-only update. Never attach team:* ACL from the Web SDK here — admins who are
  // not company team members cannot grant those roles, and legacy rows often lack
  // label:admin until a server sync runs.
  const updated = await tablesDB.updateRow<TaskRow>({
    databaseId: DATABASE_ID,
    tableId: TABLES.tasks,
    rowId: taskId,
    data: payload,
  });

  if (access?.teamId && access.companyId && updated.status !== 'finished') {
    try {
      await assignProjectDeveloper({
        action: 'syncPermissions',
        companyId: access.companyId,
        projectId: updated.projectId,
        teamId: access.teamId,
      });
    } catch {
      // Row data already saved; ACL sync is best-effort via API key.
    }
  }

  return updated;
}

export interface TaskOrderUpdate {
  taskId: string;
  order: number;
  taskGroupId?: string | null;
}

export async function reorderTasks(updates: TaskOrderUpdate[]) {
  await Promise.all(
    updates.map(({ taskId, order, taskGroupId }) =>
      tablesDB.updateRow<TaskRow>({
        databaseId: DATABASE_ID,
        tableId: TABLES.tasks,
        rowId: taskId,
        data: taskGroupId === undefined ? { order } : { order, taskGroupId },
      }),
    ),
  );
}

/** Historical placeholder for a task that can no longer be deleted (see deleteTask). */
export async function archiveTask(taskId: string) {
  await tablesDB.updateRow<TaskRow>({
    databaseId: DATABASE_ID,
    tableId: TABLES.tasks,
    rowId: taskId,
    data: { status: 'archived' },
  });
}

/** Tasks with invoiced hours are archived instead of deleted so billing history is never lost. */
export async function deleteTask(taskId: string) {
  if (await hasInvoicedTimeEntries(taskId)) {
    await archiveTask(taskId);
    return;
  }
  await tablesDB.deleteRow({
    databaseId: DATABASE_ID,
    tableId: TABLES.tasks,
    rowId: taskId,
  });
}

export async function markTaskFinished(input: {
  taskId: string;
  teamId: string;
  companyId: string;
  projectId: string;
  completedDate: Date;
  assigneeIds?: string[] | null;
}) {
  // Hours stay as denormalized sum of timeEntries — do not overwrite here.
  // Update status without rewriting permissions first — replacing ACLs in the same
  // call often fails for users who can update the row but aren't listed on the new ACL.
  const updated = await tablesDB.updateRow<TaskRow>({
    databaseId: DATABASE_ID,
    tableId: TABLES.tasks,
    rowId: input.taskId,
    data: {
      status: 'finished',
      completedDate: input.completedDate.toISOString(),
    },
  });

  try {
    await tablesDB.updateRow<TaskRow>({
      databaseId: DATABASE_ID,
      tableId: TABLES.tasks,
      rowId: input.taskId,
      data: {},
      permissions: adminOnlyTaskPermissions(),
    });
  } catch {
    // Data already saved; continue to server sync.
  }

  try {
    await assignProjectDeveloper({
      action: 'syncPermissions',
      companyId: input.companyId,
      projectId: input.projectId,
      teamId: input.teamId,
    });
  } catch {
    // Finished status already persisted.
  }

  return updated;
}

export async function reopenTask(input: {
  taskId: string;
  teamId: string;
  companyId?: string;
  projectId?: string;
  createdBy?: string | null;
  assigneeIds?: string[] | null;
}) {
  const data = {
    status: 'open' as const,
    completedDate: null,
  };
  let updated: TaskRow;
  try {
    updated = await tablesDB.updateRow<TaskRow>({
      databaseId: DATABASE_ID,
      tableId: TABLES.tasks,
      rowId: input.taskId,
      data,
      permissions: adminOnlyTaskPermissions(),
    });
  } catch (err) {
    if (!isPermissionGrantError(err)) throw err;
    updated = await tablesDB.updateRow<TaskRow>({
      databaseId: DATABASE_ID,
      tableId: TABLES.tasks,
      rowId: input.taskId,
      data,
    });
  }

  const syncCompanyId = input.companyId ?? updated.companyId;
  const syncProjectId = input.projectId ?? updated.projectId;
  if (syncCompanyId && syncProjectId) {
    try {
      await assignProjectDeveloper({
        action: 'syncPermissions',
        companyId: syncCompanyId,
        projectId: syncProjectId,
        teamId: input.teamId,
      });
    } catch {
      // Status already updated.
    }
  }

  return updated;
}

export async function setTaskAssignees(input: {
  taskId: string;
  teamId: string;
  assigneeIds: string[];
  createdBy?: string | null;
}) {
  return assignTaskAssignees(input);
}

export function taskNestDepth(task: TaskRow, byId: Map<string, TaskRow>): number {
  let depth = 0;
  let current: TaskRow | undefined = task;
  const seen = new Set<string>();
  while (current?.parentTaskId) {
    if (seen.has(current.$id)) break;
    seen.add(current.$id);
    depth += 1;
    current = byId.get(current.parentTaskId);
  }
  return depth;
}

export function hasOpenSubtasks(taskId: string, tasks: TaskRow[]): boolean {
  return tasks.some((task) => task.parentTaskId === taskId && task.status === 'open');
}

/** Include ancestor tasks from `pool` so trees can render parents filtered out of `base`. */
export function includeTaskAncestors(base: TaskRow[], pool: TaskRow[]): TaskRow[] {
  const byId = new Map(pool.map((task) => [task.$id, task]));
  const included = new Map(base.map((task) => [task.$id, task]));
  for (const task of base) {
    let current = task.parentTaskId ? byId.get(task.parentTaskId) : undefined;
    const seen = new Set<string>();
    while (current && !seen.has(current.$id)) {
      seen.add(current.$id);
      included.set(current.$id, current);
      current = current.parentTaskId ? byId.get(current.parentTaskId) : undefined;
    }
  }
  return [...included.values()];
}
