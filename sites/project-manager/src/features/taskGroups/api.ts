import { ID, Query } from 'appwrite';
import { tablesDB } from '../../appwrite/client';
import { DATABASE_ID, TABLES } from '../../appwrite/constants';
import { adminOnlyTaskGroupPermissions, taskGroupPermissions } from '../../appwrite/permissions';
import type { TaskGroupRow } from '../../appwrite/types';

function isPermissionGrantError(err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  return message.includes('Permissions must be one of');
}

export async function listTaskGroupsByProject(projectId: string) {
  const result = await tablesDB.listRows<TaskGroupRow>({
    databaseId: DATABASE_ID,
    tableId: TABLES.taskGroups,
    queries: [Query.equal('projectId', projectId), Query.orderAsc('name'), Query.limit(100)],
  });
  return result.rows;
}

export async function listTaskGroupsByCompany(companyId: string) {
  const result = await tablesDB.listRows<TaskGroupRow>({
    databaseId: DATABASE_ID,
    tableId: TABLES.taskGroups,
    queries: [Query.equal('companyId', companyId), Query.orderAsc('name'), Query.limit(100)],
  });
  return result.rows;
}

export async function createTaskGroup(input: { projectId: string; companyId: string; teamId: string; name: string }) {
  const rowId = ID.unique();
  const data = { projectId: input.projectId, companyId: input.companyId, name: input.name };

  try {
    return await tablesDB.createRow<TaskGroupRow>({
      databaseId: DATABASE_ID,
      tableId: TABLES.taskGroups,
      rowId,
      data,
      permissions: taskGroupPermissions(input.teamId),
    });
  } catch (err) {
    if (!isPermissionGrantError(err)) throw err;
    // Admins often are not members of client teams and cannot grant team:*.
    return await tablesDB.createRow<TaskGroupRow>({
      databaseId: DATABASE_ID,
      tableId: TABLES.taskGroups,
      rowId,
      data,
      permissions: adminOnlyTaskGroupPermissions(),
    });
  }
}

export async function renameTaskGroup(taskGroupId: string, name: string) {
  return tablesDB.updateRow<TaskGroupRow>({
    databaseId: DATABASE_ID,
    tableId: TABLES.taskGroups,
    rowId: taskGroupId,
    data: { name },
  });
}

export async function reorderTaskGroups(updates: { taskGroupId: string; order: number }[]) {
  await Promise.all(
    updates.map(({ taskGroupId, order }) =>
      tablesDB.updateRow<TaskGroupRow>({
        databaseId: DATABASE_ID,
        tableId: TABLES.taskGroups,
        rowId: taskGroupId,
        data: { order },
      }),
    ),
  );
}

export async function deleteTaskGroup(taskGroupId: string) {
  await tablesDB.deleteRow({
    databaseId: DATABASE_ID,
    tableId: TABLES.taskGroups,
    rowId: taskGroupId,
  });
}
