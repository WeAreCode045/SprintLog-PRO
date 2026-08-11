import { useState, type FormEvent } from 'react';
import { Trans, useLingui } from '@lingui/react/macro';
import { Modal } from '../../components/Modal';
import type { ProjectRow } from '../../appwrite/types';
import { ProjectAssignmentsPanel } from '../assignments/ProjectAssignmentsPanel';
import { useUpdateProject } from './hooks';

interface ProjectEditDialogProps {
  companyId: string;
  teamId: string;
  project: ProjectRow;
  onClose: () => void;
}

function normalizeLink(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export function ProjectEditDialog({ companyId, teamId, project, onClose }: ProjectEditDialogProps) {
  const { t } = useLingui();
  const updateProject = useUpdateProject(companyId, project.$id);
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description ?? '');
  const [link, setLink] = useState(project.link ?? '');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError(t`Vul een projectnaam in.`);
      return;
    }
    try {
      await updateProject.mutateAsync({
        name: name.trim(),
        description: description.trim() || null,
        link: normalizeLink(link),
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : t`Opslaan mislukt.`);
    }
  }

  return (
    <Modal title={t`Project bewerken`} onClose={onClose}>
      <form className="form" onSubmit={(event) => void handleSubmit(event)}>
        <label>
          <Trans>Naam</Trans>
          <input
            autoFocus
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
          />
        </label>
        <label>
          <Trans>Link</Trans>
          <input
            type="text"
            inputMode="url"
            placeholder="https://example.com"
            value={link}
            onChange={(event) => setLink(event.target.value)}
          />
        </label>
        <label>
          <Trans>Beschrijving</Trans>
          <textarea
            rows={3}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </label>
        {error && <p className="form-error">{error}</p>}
        <div className="form-actions">
          <button type="submit" className="btn-accent" disabled={updateProject.isPending || !name.trim()}>
            <Trans>Opslaan</Trans>
          </button>
          <button type="button" onClick={onClose}>
            <Trans>Annuleren</Trans>
          </button>
        </div>
      </form>

      <div className="project-edit-assignments">
        <ProjectAssignmentsPanel companyId={companyId} projectId={project.$id} teamId={teamId} />
      </div>
    </Modal>
  );
}
