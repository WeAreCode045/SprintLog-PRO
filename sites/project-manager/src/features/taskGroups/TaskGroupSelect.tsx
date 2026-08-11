import { useState } from 'react';
import { IconEdit, IconTrash } from '../../components/icons';
import { useCreateTaskGroup, useDeleteTaskGroup, useRenameTaskGroup, useTaskGroupsByProject } from './hooks';

interface TaskGroupSelectProps {
  projectId: string;
  companyId: string;
  teamId: string;
  value: string;
  onChange: (taskGroupId: string) => void;
  canManage: boolean;
}

const NEW_GROUP_VALUE = '__new__';

export function TaskGroupSelect({ projectId, companyId, teamId, value, onChange, canManage }: TaskGroupSelectProps) {
  const { data: taskGroups = [] } = useTaskGroupsByProject(projectId);
  const createTaskGroup = useCreateTaskGroup(companyId);
  const renameTaskGroup = useRenameTaskGroup(companyId);
  const deleteTaskGroup = useDeleteTaskGroup(companyId);

  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');

  const selectedGroup = taskGroups.find((g) => g.$id === value);

  function handleSelectChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value;
    if (next === NEW_GROUP_VALUE) {
      setCreating(true);
      setNewName('');
      return;
    }
    onChange(next);
  }

  async function confirmCreate() {
    const name = newName.trim();
    if (!name) return;
    const group = await createTaskGroup.mutateAsync({ projectId, companyId, teamId, name });
    setCreating(false);
    setNewName('');
    onChange(group.$id);
  }

  function startEdit() {
    if (!selectedGroup) return;
    setEditName(selectedGroup.name);
    setEditing(true);
  }

  async function confirmEdit() {
    if (!selectedGroup) return;
    const name = editName.trim();
    if (!name) return;
    await renameTaskGroup.mutateAsync({ taskGroupId: selectedGroup.$id, name });
    setEditing(false);
  }

  async function handleDelete() {
    if (!selectedGroup) return;
    if (!confirm(`Task group "${selectedGroup.name}" verwijderen?`)) return;
    await deleteTaskGroup.mutateAsync(selectedGroup.$id);
    onChange('');
  }

  if (creating) {
    return (
      <div className="project-select project-select--creating">
        <input
          autoFocus
          type="text"
          placeholder="Naam nieuwe task group"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && confirmCreate()}
        />
        <button type="button" onClick={confirmCreate} disabled={!newName.trim()}>
          Toevoegen
        </button>
        <button type="button" onClick={() => setCreating(false)}>
          Annuleren
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
          Opslaan
        </button>
        <button type="button" onClick={() => setEditing(false)}>
          Annuleren
        </button>
      </div>
    );
  }

  return (
    <div className="project-select">
      <select value={value} onChange={handleSelectChange} disabled={!projectId}>
        <option value="">Geen groep</option>
        {taskGroups.map((group) => (
          <option key={group.$id} value={group.$id}>
            {group.name}
          </option>
        ))}
        {canManage && projectId && <option value={NEW_GROUP_VALUE}>+ Nieuwe task group…</option>}
      </select>
      {canManage && selectedGroup && (
        <>
          <button type="button" className="icon-button" title="Groepsnaam wijzigen" onClick={startEdit}>
            <IconEdit />
          </button>
          <button type="button" className="icon-button" title="Groep verwijderen" onClick={handleDelete}>
            <IconTrash />
          </button>
        </>
      )}
    </div>
  );
}
