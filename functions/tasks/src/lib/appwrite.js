import { Client, TablesDB, Users, Teams, Storage } from 'node-appwrite';
import { Query } from 'node-appwrite';

export const DATABASE_ID = 'main';
export const TABLES = {
  companies: 'companies',
  projects: 'projects',
  taskGroups: 'taskGroups',
  tasks: 'tasks',
  userProfiles: 'userProfiles',
  projectAssignments: 'projectAssignments',
  discussions: 'discussions',
  discussionReplies: 'discussionReplies',
  projectFiles: 'projectFiles',
  notifications: 'notifications',
  timeEntries: 'timeEntries',
  invoices: 'invoices',
  invoiceItems: 'invoiceItems',
};
export const PROJECT_FILES_BUCKET = 'project-files';

export function createClients(req) {
  const client = new Client()
    .setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT)
    .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
    .setKey(req.headers['x-appwrite-key'] ?? '');

  return {
    client,
    tablesDB: new TablesDB(client),
    users: new Users(client),
    teams: new Teams(client),
    storage: new Storage(client),
  };
}

export function parseBody(req) {
  const raw = req.bodyJson ?? req.body ?? {};
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw || '{}');
    } catch {
      return {};
    }
  }
  if (raw && typeof raw === 'object') {
    return raw;
  }
  return {};
}

export async function listAllRows(tablesDB, tableId, queries) {
  const rows = [];
  let cursor = null;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const pageQueries = [...queries, Query.limit(100)];
    if (cursor) {
      pageQueries.push(Query.cursorAfter(cursor));
    }
    const result = await tablesDB.listRows({
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
