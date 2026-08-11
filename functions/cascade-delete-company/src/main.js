import { Client, TablesDB, Teams, Storage, Query } from 'node-appwrite';

const DATABASE_ID = 'main';
const TABLES = {
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
};
const BUCKET = 'project-files';

async function deleteRowsWhere(tablesDB, tableId, column, value, log) {
  let deleted = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const result = await tablesDB.listRows({
      databaseId: DATABASE_ID,
      tableId,
      queries: [Query.equal(column, value), Query.limit(100)],
    });
    if (result.rows.length === 0) break;
    for (const row of result.rows) {
      await tablesDB.deleteRow({ databaseId: DATABASE_ID, tableId, rowId: row.$id });
      deleted++;
    }
  }
  log(`Deleted ${deleted} row(s) from ${tableId} where ${column}=${value}`);
}

async function deleteProjectFilesAndStorage(tablesDB, storage, companyId, log, error) {
  let deletedRows = 0;
  let deletedFiles = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const result = await tablesDB.listRows({
      databaseId: DATABASE_ID,
      tableId: TABLES.projectFiles,
      queries: [Query.equal('companyId', companyId), Query.limit(100)],
    });
    if (result.rows.length === 0) break;
    for (const row of result.rows) {
      if (row.bucketFileId) {
        try {
          await storage.deleteFile({ bucketId: BUCKET, fileId: row.bucketFileId });
          deletedFiles++;
        } catch (err) {
          // Storage scope may be unavailable; continue with row cleanup.
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
  }
  log(
    `Deleted ${deletedRows} projectFiles row(s) and ${deletedFiles} storage file(s) for company ${companyId}`,
  );
}

async function deleteTeam(teams, teamId, log) {
  if (!teamId) return;
  try {
    await teams.delete({ teamId });
    log(`Deleted team ${teamId}`);
  } catch (err) {
    if (err.code !== 404) {
      throw err;
    }
    log(`Team ${teamId} was already gone`);
  }
}

export default async ({ req, res, log, error }) => {
  const client = new Client()
    .setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT)
    .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
    .setKey(req.headers['x-appwrite-key'] ?? '');

  const tablesDB = new TablesDB(client);
  const teams = new Teams(client);
  const storage = new Storage(client);

  try {
    const deletedCompany = req.bodyJson;
    if (!deletedCompany || !deletedCompany.$id) {
      error('cascade-delete-company: no row payload on the delete event');
      return res.json({ success: false, message: 'No row payload' }, 400);
    }

    const companyId = deletedCompany.$id;
    const teamId = deletedCompany.teamId;

    log(`Cleaning up company ${companyId} (team ${teamId ?? 'none'})`);
    await deleteRowsWhere(tablesDB, TABLES.tasks, 'companyId', companyId, log);
    await deleteRowsWhere(tablesDB, TABLES.taskGroups, 'companyId', companyId, log);
    await deleteRowsWhere(tablesDB, TABLES.projects, 'companyId', companyId, log);
    await deleteRowsWhere(tablesDB, TABLES.projectAssignments, 'companyId', companyId, log);
    await deleteRowsWhere(tablesDB, TABLES.discussions, 'companyId', companyId, log);
    await deleteRowsWhere(tablesDB, TABLES.discussionReplies, 'companyId', companyId, log);
    await deleteProjectFilesAndStorage(tablesDB, storage, companyId, log, error);
    await deleteRowsWhere(tablesDB, TABLES.notifications, 'companyId', companyId, log);
    await deleteTeam(teams, teamId, log);

    return res.json({ success: true });
  } catch (err) {
    error(`cascade-delete-client failed: ${err.message}`);
    return res.json({ success: false, message: err.message }, 500);
  }
};
