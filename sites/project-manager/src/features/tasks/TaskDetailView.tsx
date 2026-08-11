import dayjs from 'dayjs';
import { Trans, useLingui } from '@lingui/react/macro';
import { t as staticT } from '@lingui/core/macro';
import { ArrowLeft } from 'lucide-react';
import { TASK_TYPE_LABELS, type TaskRow, type TaskType } from '../../appwrite/types';
import { useProjectAssignments } from '../assignments/hooks';
import { useDeveloperProfiles } from '../profiles/hooks';
import { useProjects } from '../projects/hooks';
import { effectiveTaskAssigneeIds } from './api';
import { useTasksByProject } from './hooks';
import { formatHours } from '../../lib/formatHours';

interface TaskDetailViewProps {
  companyId: string;
  task: TaskRow;
  canEdit: boolean;
  canDelete: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onBack: () => void;
}

function statusLabel(status: TaskRow['status']) {
  switch (status) {
    case 'requested':
      return staticT`Aangevraagd`;
    case 'open':
      return staticT`Open`;
    case 'finished':
      return staticT`Afgerond`;
    case 'archived':
      return staticT`Gearchiveerd`;
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

/** Inline replacement for the task list/table within the same content card — the caller
 * swaps its list rendering for this view rather than layering it in a Modal. */
export function TaskDetailView({
  companyId,
  task,
  canEdit,
  canDelete,
  onEdit,
  onDelete,
  onBack,
}: TaskDetailViewProps) {
  const { t } = useLingui();
  const { data: projects = [] } = useProjects(companyId);
  const { data: projectTasks = [] } = useTasksByProject(task.projectId);
  const { data: projectAssignments = [] } = useProjectAssignments(task.projectId);
  const { data: developers = [] } = useDeveloperProfiles(true);

  const projectName = projects.find((project) => project.$id === task.projectId)?.name ?? '—';
  const parentName = task.parentTaskId
    ? (projectTasks.find((row) => row.$id === task.parentTaskId)?.title ?? '—')
    : '—';
  const taskType = (task.taskType ?? 'development') as TaskType;
  const projectAssigneesByProjectId = new Map<string, string[]>([
    [
      task.projectId,
      [...new Set(projectAssignments.map((row) => row.userId).filter(Boolean))],
    ],
  ]);
  const assigneeNames =
    effectiveTaskAssigneeIds(task, projectAssigneesByProjectId)
      .map((id) => developers.find((profile) => profile.userId === id)?.displayName ?? id)
      .join(', ') || '—';
  const audienceLabel =
    (task.audience ?? 'internal') === 'client' ? t`Jouw taak (klant)` : t`Developer taak`;

  return (
    <div className="task-detail-view">
      <button type="button" className="btn-link task-detail-back" onClick={onBack}>
        <ArrowLeft size={16} aria-hidden /> <Trans>Terug naar taken</Trans>
      </button>

      <div className="task-detail-title-row">
        <div className="task-detail-field">
          <span className="task-detail-label"><Trans>Titel</Trans></span>
          <span className="task-detail-value task-detail-value--title">{task.title}</span>
        </div>
        <div className="task-detail-title-badges">
          <span className={`badge badge-status badge-status--${task.status}`}>
            {statusLabel(task.status)}
          </span>
          <span className="badge">{TASK_TYPE_LABELS[taskType]}</span>
        </div>
      </div>

      <div className="task-detail-field">
        <span className="task-detail-label"><Trans>Omschrijving</Trans></span>
        <span className="task-detail-value task-detail-value--body">
          {task.description?.trim() || '—'}
        </span>
      </div>

      <div className="task-detail-grid">
        <div className="task-detail-field">
          <span className="task-detail-label"><Trans>Doelgroep</Trans></span>
          <span className="task-detail-value">{audienceLabel}</span>
        </div>
        <div className="task-detail-field">
          <span className="task-detail-label"><Trans>Project</Trans></span>
          <span className="task-detail-value">{projectName}</span>
        </div>
        <div className="task-detail-field">
          <span className="task-detail-label"><Trans>Bovenliggende taak</Trans></span>
          <span className="task-detail-value">{parentName}</span>
        </div>
        <div className="task-detail-field">
          <span className="task-detail-label"><Trans>Developer(s)</Trans></span>
          <span className="task-detail-value">{assigneeNames}</span>
        </div>
        <div className="task-detail-field">
          <span className="task-detail-label"><Trans>Uren</Trans></span>
          <span className="task-detail-value">{formatHours(task.hours)}</span>
        </div>
        {task.dueDate && (
          <div className="task-detail-field">
            <span className="task-detail-label"><Trans>Vervaldatum</Trans></span>
            <span className="task-detail-value">
              {dayjs(task.dueDate).format('D MMM YYYY')}
            </span>
          </div>
        )}
        {task.completedDate && (
          <div className="task-detail-field">
            <span className="task-detail-label"><Trans>Afgerond op</Trans></span>
            <span className="task-detail-value">
              {dayjs(task.completedDate).format('D MMM YYYY')}
            </span>
          </div>
        )}
        {(task.audience ?? 'internal') === 'client' && (
          <div className="task-detail-field">
            <span className="task-detail-label"><Trans>Bestand uploaden</Trans></span>
            <span className="task-detail-value">
              {task.requiresFileUpload ? <Trans>Verplicht</Trans> : <Trans>Niet verplicht</Trans>}
            </span>
          </div>
        )}
      </div>

      <div className="form-actions">
        {canEdit && (
          <button type="button" className="btn-accent" onClick={onEdit}>
            <Trans>Bewerken</Trans>
          </button>
        )}
        {canDelete && (
          <button type="button" onClick={onDelete}>
            <Trans>Verwijderen</Trans>
          </button>
        )}
      </div>
    </div>
  );
}
