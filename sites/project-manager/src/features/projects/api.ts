import { ID, Query } from 'appwrite';
import { tablesDB } from '../../appwrite/client';
import { DATABASE_ID, TABLES } from '../../appwrite/constants';
import { adminOnlyProjectPermissions, projectPermissions } from '../../appwrite/permissions';
import { assignProjectDeveloper } from '../../lib/functions';
import type { ProjectPriority, ProjectRow, ProjectStatus } from '../../appwrite/types';

function isPermissionGrantError(err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  return message.includes('Permissions must be one of');
}

export async function listProjects(companyId: string) {
  const result = await tablesDB.listRows<ProjectRow>({
    databaseId: DATABASE_ID,
    tableId: TABLES.projects,
    queries: [Query.equal('companyId', companyId), Query.orderAsc('name'), Query.limit(100)],
  });
  return result.rows;
}

export async function listProjectsForCompanies(companyIds: string[]) {
  if (companyIds.length === 0) return [];
  const result = await tablesDB.listRows<ProjectRow>({
    databaseId: DATABASE_ID,
    tableId: TABLES.projects,
    queries: [Query.equal('companyId', companyIds), Query.orderAsc('name'), Query.limit(500)],
  });
  return result.rows;
}

export async function getProject(projectId: string) {
  return tablesDB.getRow<ProjectRow>({
    databaseId: DATABASE_ID,
    tableId: TABLES.projects,
    rowId: projectId,
  });
}

export async function createProject(
  companyId: string,
  teamId: string,
  name: string,
  extras?: {
    description?: string;
    link?: string | null;
    status?: ProjectStatus;
    priority?: ProjectPriority;
  },
) {
  const rowId = ID.unique();
  const data = {
    companyId,
    name,
    description: extras?.description ?? null,
    link: extras?.link ?? null,
    status: extras?.status ?? 'active',
    priority: extras?.priority ?? 'medium',
  };

  let created: ProjectRow;
  try {
    created = await tablesDB.createRow<ProjectRow>({
      databaseId: DATABASE_ID,
      tableId: TABLES.projects,
      rowId,
      data,
      permissions: projectPermissions(teamId),
    });
  } catch (err) {
    if (!isPermissionGrantError(err)) throw err;
    // Admins often are not members of client teams and cannot grant team:*.
    created = await tablesDB.createRow<ProjectRow>({
      databaseId: DATABASE_ID,
      tableId: TABLES.projects,
      rowId,
      data,
      permissions: adminOnlyProjectPermissions(),
    });
  }

  try {
    await assignProjectDeveloper({
      action: 'syncPermissions',
      companyId,
      projectId: created.$id,
      teamId,
    });
  } catch {
    // Admin label ACL remains; server sync attaches team access when available.
  }

  return created;
}

export async function updateProject(
  projectId: string,
  data: {
    name?: string;
    description?: string | null;
    link?: string | null;
    status?: ProjectStatus | null;
    priority?: ProjectPriority | null;
  },
) {
  return tablesDB.updateRow<ProjectRow>({
    databaseId: DATABASE_ID,
    tableId: TABLES.projects,
    rowId: projectId,
    data,
  });
}

export async function renameProject(projectId: string, name: string) {
  return updateProject(projectId, { name });
}

export async function deleteProject(projectId: string) {
  await tablesDB.deleteRow({
    databaseId: DATABASE_ID,
    tableId: TABLES.projects,
    rowId: projectId,
  });
}
