import { useState, type FormEvent } from 'react';
import { Trans, useLingui } from '@lingui/react/macro';
import { Modal } from '../../components/Modal';
import {
  DISCUSSION_CATEGORY_LABELS,
  DISCUSSION_CATEGORY_TYPES,
  type DiscussionCategoryType,
  type ProjectRow,
} from '../../appwrite/types';
import { useCreateDiscussion } from './hooks';

interface NewTopicDialogProps {
  companyId: string;
  teamId: string;
  userId: string;
  projects: ProjectRow[];
  defaultCategoryType?: DiscussionCategoryType;
  defaultProjectId?: string;
  lockCategory?: boolean;
  canGrantStaffRoles?: boolean;
  assigneeUserIds?: string[];
  companyOptions?: Array<{ id: string; name: string }>;
  onCompanyChange?: (companyId: string) => void;
  onClose: () => void;
  onCreated?: (discussionId: string) => void;
}

export function NewTopicDialog({
  companyId,
  teamId,
  userId,
  projects,
  defaultCategoryType = 'general',
  defaultProjectId = '',
  lockCategory = false,
  canGrantStaffRoles = false,
  assigneeUserIds,
  companyOptions,
  onCompanyChange,
  onClose,
  onCreated,
}: NewTopicDialogProps) {
  const { t } = useLingui();
  const createDiscussion = useCreateDiscussion({
    companyId,
    projectId: defaultProjectId || undefined,
  });
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [categoryType, setCategoryType] = useState<DiscussionCategoryType>(defaultCategoryType);
  const [projectId, setProjectId] = useState(defaultProjectId);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!title.trim() || !body.trim()) return;
    if (categoryType === 'project' && !projectId) {
      setError(t`Kies een project.`);
      return;
    }
    setError(null);
    try {
      const created = await createDiscussion.mutateAsync({
        companyId,
        teamId,
        title: title.trim(),
        body: body.trim(),
        createdBy: userId,
        categoryType,
        projectId: categoryType === 'project' ? projectId : null,
        assigneeUserIds,
        canGrantStaffRoles,
      });
      onCreated?.(created.$id);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : t`Topic aanmaken mislukt.`);
    }
  }

  return (
    <Modal title={t`Nieuw topic`} onClose={onClose}>
      <form className="form" onSubmit={(event) => void handleSubmit(event)}>
        {companyOptions && companyOptions.length > 1 && (
          <label>
            <Trans>Bedrijf</Trans>
            <select
              value={companyId}
              onChange={(event) => {
                onCompanyChange?.(event.target.value);
                setProjectId('');
              }}
            >
              {companyOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {!lockCategory && (
          <label>
            <Trans>Categorie</Trans>
            <select
              value={categoryType}
              onChange={(event) => setCategoryType(event.target.value as DiscussionCategoryType)}
            >
              {DISCUSSION_CATEGORY_TYPES.map((type) => (
                <option key={type} value={type}>
                  {DISCUSSION_CATEGORY_LABELS[type]}
                </option>
              ))}
            </select>
          </label>
        )}
        {categoryType === 'project' && (
          <label>
            <Trans>Project</Trans>
            <select
              value={projectId}
              onChange={(event) => setProjectId(event.target.value)}
              required
              disabled={lockCategory && Boolean(defaultProjectId)}
            >
              <option value="">{t`Kies project…`}</option>
              {projects.map((project) => (
                <option key={project.$id} value={project.$id}>
                  {project.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label>
          <Trans>Titel</Trans>
          <input
            autoFocus
            type="text"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            required
          />
        </label>
        <label>
          <Trans>Bericht</Trans>
          <textarea
            rows={5}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            required
          />
        </label>
        {error && <p className="form-error">{error}</p>}
        <div className="form-actions">
          <button type="button" className="btn-link" onClick={onClose}>
            <Trans>Annuleren</Trans>
          </button>
          <button
            type="submit"
            className="btn-accent"
            disabled={createDiscussion.isPending || !title.trim() || !body.trim()}
          >
            <Trans>Plaatsen</Trans>
          </button>
        </div>
      </form>
    </Modal>
  );
}
