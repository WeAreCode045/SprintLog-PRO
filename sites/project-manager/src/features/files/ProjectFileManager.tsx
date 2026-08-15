import { useMemo, useRef, useState } from 'react';
import { Download, Eye, FileWarning, Trash2, Upload } from 'lucide-react';
import dayjs from 'dayjs';
import { Trans, useLingui } from '@lingui/react/macro';
import { useAuth } from '../../auth/AuthContext';
import { Modal } from '../../components/Modal';
import { getFileDownloadUrl, getFileViewUrl } from './api';
import { useDeleteProjectFile, useProjectFiles, useUploadProjectFile } from './hooks';
import { useTasksByProject } from '../tasks/hooks';
import type { ProjectFileRow } from '../../appwrite/types';

function isPreviewableFile(file: ProjectFileRow) {
  return file.mimeType.startsWith('image/') || file.mimeType === 'application/pdf';
}

interface ProjectFileManagerProps {
  companyId: string;
  projectId: string;
  teamId: string;
  canDelete?: boolean;
}

function formatBytes(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function ProjectFileManager({
  companyId,
  projectId,
  teamId,
  canDelete = true,
}: ProjectFileManagerProps) {
  const { t } = useLingui();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const requestFileInputRef = useRef<HTMLInputElement>(null);
  const { data: files = [], isLoading } = useProjectFiles(projectId);
  const { data: tasks = [] } = useTasksByProject(projectId);
  const uploadFile = useUploadProjectFile(projectId);
  const deleteFile = useDeleteProjectFile(projectId);
  const [error, setError] = useState<string | null>(null);
  const [requestTaskId, setRequestTaskId] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<ProjectFileRow | null>(null);

  const fulfilledTaskIds = useMemo(
    () => new Set(files.map((file) => file.taskId).filter((id): id is string => Boolean(id))),
    [files],
  );

  const pendingFileRequests = useMemo(
    () =>
      tasks.filter(
        (task) =>
          (task.audience ?? 'internal') === 'client' &&
          task.requiresFileUpload &&
          task.status === 'open' &&
          !fulfilledTaskIds.has(task.$id),
      ),
    [tasks, fulfilledTaskIds],
  );

  async function handleUpload(fileList: FileList | null, taskId: string | null = null) {
    if (!user || !fileList || fileList.length === 0) return;
    setError(null);
    try {
      for (const file of Array.from(fileList)) {
        await uploadFile.mutateAsync({
          companyId,
          projectId,
          teamId,
          file,
          uploadedBy: user.$id,
          taskId,
        });
      }
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : t`Upload mislukt`);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (requestFileInputRef.current) requestFileInputRef.current.value = '';
      setRequestTaskId(null);
    }
  }

  async function handleDelete(row: ProjectFileRow) {
    if (!confirm(t`Bestand "${row.name}" verwijderen?`)) return;
    setError(null);
    try {
      await deleteFile.mutateAsync(row);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : t`Verwijderen mislukt`);
    }
  }

  return (
    <div className="project-file-manager">
      <div className="pane-header pane-header--actions-only">
        <button
          type="button"
          className="btn-accent"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploadFile.isPending || !user}
        >
          <Upload size={16} /> <Trans>Upload bestand</Trans>
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        hidden
        onChange={(event) => void handleUpload(event.target.files)}
      />
      <input
        ref={requestFileInputRef}
        type="file"
        hidden
        onChange={(event) => void handleUpload(event.target.files, requestTaskId)}
      />

      {uploadFile.isPending && <p><Trans>Uploaden…</Trans></p>}
      {error && <p className="form-error">{error}</p>}
      {isLoading && <p><Trans>Laden…</Trans></p>}
      {!isLoading && files.length === 0 && pendingFileRequests.length === 0 && (
        <p className="empty-state"><Trans>Nog geen bestanden.</Trans></p>
      )}

      {pendingFileRequests.length > 0 && (
        <ul className="client-list">
          {pendingFileRequests.map((task) => (
            <li key={task.$id} className="client-list-item">
              <div className="member-identity">
                <span className="member-name">
                  <FileWarning size={14} aria-hidden /> {task.title}
                </span>
                <span className="badge badge-requested">
                  <Trans>Bestand aangevraagd</Trans>
                </span>
              </div>
              <div className="todo-item-actions">
                <button
                  type="button"
                  className="btn-link"
                  disabled={uploadFile.isPending}
                  onClick={() => {
                    setRequestTaskId(task.$id);
                    requestFileInputRef.current?.click();
                  }}
                >
                  <Upload size={14} /> <Trans>Upload bestand</Trans>
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <ul className="client-list">
        {files.map((file) => (
          <li key={file.$id} className="client-list-item">
            <div className="member-identity">
              <span className="member-name">{file.name}</span>
              <span className="member-email">
                {formatBytes(file.size)} · {dayjs(file.$createdAt).format('D MMM YYYY')}
              </span>
            </div>
            <div className="todo-item-actions">
              {isPreviewableFile(file) && (
                <button
                  type="button"
                  className="icon-button"
                  title={t`Bekijken`}
                  onClick={() => setPreviewFile(file)}
                >
                  <Eye size={16} />
                </button>
              )}
              <a
                className="icon-button"
                href={getFileDownloadUrl(file.bucketFileId)}
                download={file.name}
                title={t`Download`}
              >
                <Download size={16} />
              </a>
              {canDelete && (
                <button
                  type="button"
                  className="icon-button"
                  title={t`Verwijderen`}
                  onClick={() => void handleDelete(file)}
                  disabled={deleteFile.isPending}
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>

      {previewFile && (
        <Modal title={previewFile.name} onClose={() => setPreviewFile(null)} className="file-preview-modal">
          <div className="file-preview-body">
            {previewFile.mimeType.startsWith('image/') ? (
              <img
                className="file-preview-image"
                src={getFileViewUrl(previewFile.bucketFileId)}
                alt={previewFile.name}
              />
            ) : (
              <iframe
                className="file-preview-pdf"
                src={getFileViewUrl(previewFile.bucketFileId)}
                title={previewFile.name}
              />
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
