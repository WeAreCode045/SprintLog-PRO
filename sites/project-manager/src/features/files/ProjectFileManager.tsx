import { useRef, useState } from 'react';
import { Download, Trash2, Upload } from 'lucide-react';
import dayjs from 'dayjs';
import { Trans, useLingui } from '@lingui/react/macro';
import { useAuth } from '../../auth/AuthContext';
import { getFileViewUrl } from './api';
import { useDeleteProjectFile, useProjectFiles, useUploadProjectFile } from './hooks';
import type { ProjectFileRow } from '../../appwrite/types';

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
  const { data: files = [], isLoading } = useProjectFiles(projectId);
  const uploadFile = useUploadProjectFile(projectId);
  const deleteFile = useDeleteProjectFile(projectId);
  const [error, setError] = useState<string | null>(null);

  async function handleUpload(fileList: FileList | null) {
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
        });
      }
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : t`Upload mislukt`);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
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

      {uploadFile.isPending && <p><Trans>Uploaden…</Trans></p>}
      {error && <p className="form-error">{error}</p>}
      {isLoading && <p><Trans>Laden…</Trans></p>}
      {!isLoading && files.length === 0 && <p className="empty-state"><Trans>Nog geen bestanden.</Trans></p>}

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
              <a
                className="icon-button"
                href={getFileViewUrl(file.bucketFileId)}
                target="_blank"
                rel="noreferrer"
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
    </div>
  );
}
