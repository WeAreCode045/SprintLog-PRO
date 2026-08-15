import { Query, ID, Permission, Role } from 'node-appwrite';
import { DATABASE_ID, TABLES, listAllRows } from '../lib/appwrite.js';
import { ADMIN_LABEL, DEVELOPER_LABEL } from '../lib/auth.js';

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

export async function handleCascadeDelete({ req, tablesDB, teams, storage, log, error }) {
  const deletedCompany = req.bodyJson;
  if (!deletedCompany || !deletedCompany.$id) {
    error('companies cascadeDelete: no row payload on the delete event');
    return { success: false, message: 'No row payload', status: 400 };
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

  return { success: true };
}
