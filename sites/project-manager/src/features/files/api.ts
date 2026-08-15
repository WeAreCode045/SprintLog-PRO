import { ID, Query } from 'appwrite';
import { storage, tablesDB } from '../../appwrite/client';
import { BUCKETS, DATABASE_ID, TABLES } from '../../appwrite/constants';
import { projectFilePermissions, selfOnlyPermissions } from '../../appwrite/permissions';
import type { ProjectFileRow } from '../../appwrite/types';

function isPermissionGrantError(err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  return message.includes('Permissions must be one of');
}

export async function listProjectFiles(projectId: string) {
  const result = await tablesDB.listRows<ProjectFileRow>({
    databaseId: DATABASE_ID,
    tableId: TABLES.projectFiles,
    queries: [Query.equal('projectId', projectId), Query.orderDesc('$createdAt'), Query.limit(200)],
  });
  return result.rows;
}

export async function uploadProjectFile(input: {
  companyId: string;
  projectId: string;
  teamId: string;
  file: File;
  uploadedBy: string;
  taskId?: string | null;
}) {
  let bucketFile;
  try {
    bucketFile = await storage.createFile({
      bucketId: BUCKETS.projectFiles,
      fileId: ID.unique(),
      file: input.file,
      // Prefer team ACL when the actor is a company team member.
      permissions: projectFilePermissions(input.teamId, input.uploadedBy),
    });
  } catch (err) {
    if (!isPermissionGrantError(err)) throw err;
    // Staff not on the company team can only grant permissions about themselves;
    // table/bucket-level label:admin/label:developer grants cover their own access.
    bucketFile = await storage.createFile({
      bucketId: BUCKETS.projectFiles,
      fileId: ID.unique(),
      file: input.file,
      permissions: selfOnlyPermissions(input.uploadedBy),
    });
  }

  const data = {
    companyId: input.companyId,
    projectId: input.projectId,
    taskId: input.taskId ?? null,
    bucketFileId: bucketFile.$id,
    name: input.file.name,
    mimeType: input.file.type || 'application/octet-stream',
    size: input.file.size,
    uploadedBy: input.uploadedBy,
  };

  try {
    return await tablesDB.createRow<ProjectFileRow>({
      databaseId: DATABASE_ID,
      tableId: TABLES.projectFiles,
      rowId: ID.unique(),
      data,
      permissions: projectFilePermissions(input.teamId, input.uploadedBy),
    });
  } catch (err) {
    if (!isPermissionGrantError(err)) throw err;
    return tablesDB.createRow<ProjectFileRow>({
      databaseId: DATABASE_ID,
      tableId: TABLES.projectFiles,
      rowId: ID.unique(),
      data,
      permissions: selfOnlyPermissions(input.uploadedBy),
    });
  }
}

export async function deleteProjectFile(row: ProjectFileRow) {
  try {
    await storage.deleteFile({ bucketId: BUCKETS.projectFiles, fileId: row.bucketFileId });
  } catch {
    // Row cleanup still proceeds if storage object already gone.
  }
  await tablesDB.deleteRow({
    databaseId: DATABASE_ID,
    tableId: TABLES.projectFiles,
    rowId: row.$id,
  });
}

export function getFileViewUrl(bucketFileId: string): string {
  return storage.getFileView({
    bucketId: BUCKETS.projectFiles,
    fileId: bucketFileId,
  });
}

export function getFileDownloadUrl(bucketFileId: string): string {
  return storage.getFileDownload({
    bucketId: BUCKETS.projectFiles,
    fileId: bucketFileId,
  });
}
