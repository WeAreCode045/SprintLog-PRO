import { Query } from 'appwrite';
import { tablesDB } from '../../appwrite/client';
import { DATABASE_ID, TABLES } from '../../appwrite/constants';
import type { ProjectAssignmentRow } from '../../appwrite/types';
import { assignProjectDeveloper } from '../../lib/functions';

export async function listAssignmentsByProject(projectId: string) {
  const result = await tablesDB.listRows<ProjectAssignmentRow>({
    databaseId: DATABASE_ID,
    tableId: TABLES.projectAssignments,
    queries: [Query.equal('projectId', projectId), Query.limit(200)],
  });
  return result.rows;
}

export async function listAssignmentsByUser(userId: string) {
  const result = await tablesDB.listRows<ProjectAssignmentRow>({
    databaseId: DATABASE_ID,
    tableId: TABLES.projectAssignments,
    queries: [Query.equal('userId', userId), Query.limit(500)],
  });
  return result.rows;
}

export async function assignDeveloper(input: {
  companyId: string;
  projectId: string;
  userId: string;
  teamId: string;
}) {
  return assignProjectDeveloper({ action: 'assign', ...input });
}

export async function unassignDeveloper(input: {
  companyId: string;
  projectId: string;
  userId: string;
  teamId: string;
}) {
  return assignProjectDeveloper({ action: 'unassign', ...input });
}
