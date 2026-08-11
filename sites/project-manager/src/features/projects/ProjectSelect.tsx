import { useState } from 'react';
import { Trans, useLingui } from '@lingui/react/macro';
import { IconEdit } from '../../components/icons';
import { useCreateProject, useProjects, useRenameProject } from './hooks';

interface ProjectSelectProps {
  companyId: string;
  teamId: string;
  value: string;
  onChange: (projectId: string) => void;
  canManage: boolean;
}

const NEW_PROJECT_VALUE = '__new__';

export function ProjectSelect({ companyId, teamId, value, onChange, canManage }: ProjectSelectProps) {
  const { t } = useLingui();
  const { data: projects = [] } = useProjects(companyId);
  const createProject = useCreateProject(companyId, teamId);
  const renameProject = useRenameProject(companyId);

  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');

  const selectedProject = projects.find((p) => p.$id === value);

  async function handleSelectChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value;
    if (next === NEW_PROJECT_VALUE) {
      setCreating(true);
      setNewName('');
      return;
    }
    onChange(next);
  }

  async function confirmCreate() {
    const name = newName.trim();
    if (!name) return;
    const project = await createProject.mutateAsync(name);
    setCreating(false);
    setNewName('');
    onChange(project.$id);
  }

  function startEdit() {
    if (!selectedProject) return;
    setEditName(selectedProject.name);
    setEditing(true);
  }

  async function confirmEdit() {
    if (!selectedProject) return;
    const name = editName.trim();
    if (!name) return;
    await renameProject.mutateAsync({ projectId: selectedProject.$id, name });
    setEditing(false);
  }

  if (creating) {
    return (
      <div className="project-select project-select--creating">
        <input
          autoFocus
          type="text"
          placeholder={t`Naam nieuw project`}
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && confirmCreate()}
        />
        <button type="button" onClick={confirmCreate} disabled={!newName.trim()}>
          <Trans>Toevoegen</Trans>
        </button>
        <button type="button" onClick={() => setCreating(false)}>
          <Trans>Annuleren</Trans>
        </button>
      </div>
    );
  }

  if (editing) {
    return (
      <div className="project-select project-select--editing">
        <input
          autoFocus
          type="text"
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && confirmEdit()}
        />
        <button type="button" onClick={confirmEdit} disabled={!editName.trim()}>
          <Trans>Opslaan</Trans>
        </button>
        <button type="button" onClick={() => setEditing(false)}>
          <Trans>Annuleren</Trans>
        </button>
      </div>
    );
  }

  return (
    <div className="project-select">
      <select value={value} onChange={handleSelectChange}>
        <option value="" disabled>
          {t`Kies project…`}
        </option>
        {projects.map((project) => (
          <option key={project.$id} value={project.$id}>
            {project.name}
          </option>
        ))}
        {canManage && <option value={NEW_PROJECT_VALUE}>{t`+ Nieuw project…`}</option>}
      </select>
      {canManage && selectedProject && (
        <button type="button" className="icon-button" title={t`Projectnaam wijzigen`} onClick={startEdit}>
          <IconEdit />
        </button>
      )}
    </div>
  );
}
