import { useMemo, useState } from 'react';
import { Trans, useLingui } from '@lingui/react/macro';
import {
  MAX_TASK_NEST_DEPTH,
  TASK_TYPE_LABELS,
  TASK_TYPES,
  type CompanyRow,
  type TaskAudience,
  type TaskRow,
  type TaskStatus,
  type TaskType,
} from '../../appwrite/types';
import { ProjectSelect } from '../projects/ProjectSelect';
import { taskNestDepth } from './api';
import { useCreateTask, useTasksByProject, useUpdateOpenTask } from './hooks';

export interface TaskFormProps {
  companyId: string;
  teamId: string;
  userId: string;
  canManageProjects: boolean;
  task?: TaskRow;
  parentTask?: TaskRow;
  defaultProjectId?: string;
  defaultAudience?: TaskAudience;
  defaultStatus?: TaskStatus;
  lockAudience?: boolean;
  availableCompanies?: CompanyRow[];
  onCompanyChange?: (companyId: string) => void;
  onClose: () => void;
}

function collectDescendantIds(rootId: string, tasks: TaskRow[]): Set<string> {
  const excluded = new Set<string>([rootId]);
  const queue = [rootId];
  while (queue.length > 0) {
    const currentId = queue.pop()!;
    for (const row of tasks) {
      if (row.parentTaskId === currentId && !excluded.has(row.$id)) {
        excluded.add(row.$id);
        queue.push(row.$id);
      }
    }
  }
  return excluded;
}

/** The task add/edit form body, shared between the modal (add, add-subtask) and the
 * inline content-body view (edit) — callers decide how to frame it. */
export function TaskForm({
  companyId,
  teamId,
  userId,
  canManageProjects,
  task,
  parentTask,
  defaultProjectId,
  defaultAudience = 'internal',
  defaultStatus = 'open',
  lockAudience = false,
  availableCompanies,
  onCompanyChange,
  onClose,
}: TaskFormProps) {
  const { t } = useLingui();
  const [title, setTitle] = useState(task?.title ?? '');
  const [description, setDescription] = useState(task?.description ?? '');
  const [projectId, setProjectId] = useState(
    task?.projectId ?? parentTask?.projectId ?? defaultProjectId ?? '',
  );
  const [parentTaskId, setParentTaskId] = useState(
    task?.parentTaskId ?? parentTask?.$id ?? '',
  );
  const [audience, setAudience] = useState<TaskAudience>(
    task?.audience ?? parentTask?.audience ?? defaultAudience,
  );
  const [requiresFileUpload, setRequiresFileUpload] = useState(Boolean(task?.requiresFileUpload));
  const [taskType, setTaskType] = useState<TaskType>(
    (task?.taskType ?? parentTask?.taskType ?? 'development') as TaskType,
  );
  const [error, setError] = useState<string | null>(null);

  const { data: projectTasks = [] } = useTasksByProject(projectId || undefined);
  const createTask = useCreateTask(companyId);
  const updateTask = useUpdateOpenTask(companyId);

  const isEditing = Boolean(task);
  const pending = createTask.isPending || updateTask.isPending;

  const parentOptions = useMemo(() => {
    const byId = new Map(projectTasks.map((row) => [row.$id, row]));
    const excluded = task ? collectDescendantIds(task.$id, projectTasks) : new Set<string>();

    return projectTasks
      .filter((row) => !excluded.has(row.$id))
      .filter((row) => taskNestDepth(row, byId) < MAX_TASK_NEST_DEPTH - 1)
      .slice()
      .sort((a, b) => {
        const depthDiff = taskNestDepth(a, byId) - taskNestDepth(b, byId);
        if (depthDiff !== 0) return depthDiff;
        return a.title.localeCompare(b.title, 'nl');
      });
  }, [projectTasks, task]);

  const parentOptionById = useMemo(
    () => new Map(parentOptions.map((row) => [row.$id, row])),
    [parentOptions],
  );

  function handleProjectChange(next: string) {
    setProjectId(next);
    setParentTaskId('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!title.trim() || !projectId) {
      setError(t`Vul titel en project in.`);
      return;
    }
    if (parentTaskId && !parentOptionById.has(parentTaskId)) {
      setError(t`Kies een geldige bovenliggende taak.`);
      return;
    }

    const nextParentId = parentTaskId || null;

    try {
      if (task) {
        await updateTask.mutateAsync({
          taskId: task.$id,
          data: {
            title: title.trim(),
            description: description.trim() || null,
            projectId,
            parentTaskId: nextParentId,
            audience,
            requiresFileUpload: audience === 'client' ? requiresFileUpload : false,
            taskType,
          },
          access: {
            teamId,
            companyId,
            createdBy: task.createdBy,
            assigneeIds: task.assigneeIds,
          },
        });
      } else {
        await createTask.mutateAsync({
          companyId,
          teamId,
          projectId,
          title: title.trim(),
          description: description.trim() || undefined,
          userId,
          parentTaskId: nextParentId,
          audience,
          status: defaultStatus,
          requiresFileUpload: audience === 'client' ? requiresFileUpload : false,
          taskType,
        });
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : t`Opslaan mislukt.`);
    }
  }

  const showAudienceSelect = !lockAudience && !parentTask;
  const byId = useMemo(
    () => new Map(projectTasks.map((row) => [row.$id, row])),
    [projectTasks],
  );

  return (
    <form className="form" onSubmit={(event) => void handleSubmit(event)}>
      {defaultStatus === 'requested' && !isEditing && (
        <p className="text-muted">
          <Trans>
            Deze taak wordt als aanvraag ingediend. Een developer moet hem accepteren voordat hij
            in Projecttaken staat.
          </Trans>
        </p>
      )}
      <label>
        <Trans>Titel</Trans>
        <input autoFocus type="text" value={title} onChange={(e) => setTitle(e.target.value)} required />
      </label>
      <label>
        <Trans>Beschrijving</Trans>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
      </label>
      {availableCompanies && availableCompanies.length > 1 && !task && !parentTask && (
        <label>
          <Trans>Bedrijf</Trans>
          <select
            value={companyId}
            onChange={(event) => {
              onCompanyChange?.(event.target.value);
              setProjectId('');
              setParentTaskId('');
            }}
          >
            {availableCompanies.map((company) => (
              <option key={company.$id} value={company.$id}>
                {company.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="form-row">
        <label>
          <Trans>Taaktype</Trans>
          <select value={taskType} onChange={(e) => setTaskType(e.target.value as TaskType)}>
            {TASK_TYPES.map((option) => (
              <option key={option} value={option}>
                {TASK_TYPE_LABELS[option]}
              </option>
            ))}
          </select>
        </label>
        {showAudienceSelect && (
          <label>
            <Trans>Doelgroep</Trans>
            <select
              value={audience}
              onChange={(e) => setAudience(e.target.value as TaskAudience)}
              disabled={Boolean(parentTask) || Boolean(task)}
            >
              <option value="internal">{t`Projecttaak (urenregistratie)`}</option>
              <option value="client">{t`Klanttaak (geen uren)`}</option>
            </select>
          </label>
        )}
      </div>
      {audience === 'client' && (
        <>
          <p className="text-muted">
            <Trans>Klanttaken worden door de klant uitgevoerd en tellen niet mee in urenrapportages.</Trans>
          </p>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={requiresFileUpload}
              onChange={(e) => setRequiresFileUpload(e.target.checked)}
            />
            <Trans>Bestandsaanlevering vereist</Trans>
          </label>
        </>
      )}
      <div className="form-row">
        <label>
          <Trans>Project</Trans>
          <ProjectSelect
            companyId={companyId}
            teamId={teamId}
            value={projectId}
            onChange={handleProjectChange}
            canManage={canManageProjects}
          />
        </label>
        <label>
          <Trans>Bovenliggende taak (optioneel)</Trans>
          <select
            value={parentTaskId}
            onChange={(e) => setParentTaskId(e.target.value)}
            disabled={!projectId}
          >
            <option value="">{t`Geen (hoofdtaak)`}</option>
            {parentOptions.map((row) => {
              const depth = taskNestDepth(row, byId);
              const prefix = depth > 0 ? `${'—'.repeat(depth)} ` : '';
              return (
                <option key={row.$id} value={row.$id}>
                  {prefix}
                  {row.title}
                </option>
              );
            })}
          </select>
        </label>
      </div>
      {error && <p className="form-error">{error}</p>}
      <div className="form-actions">
        <button
          type="submit"
          className="btn-accent"
          disabled={pending || !title.trim() || !projectId}
        >
          {isEditing ? <Trans>Opslaan</Trans> : <Trans>Toevoegen</Trans>}
        </button>
        <button type="button" onClick={onClose}>
          <Trans>Annuleren</Trans>
        </button>
      </div>
    </form>
  );
}
