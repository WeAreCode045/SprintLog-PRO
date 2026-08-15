import { useMemo } from 'react';
import dayjs from 'dayjs';
import { Info } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Trans } from '@lingui/react/macro';
import { t as staticT } from '@lingui/core/macro';
import { TASK_TYPE_LABELS, type TaskRow, type TaskType } from '../../appwrite/types';
import { useProjectAssignments } from '../assignments/hooks';
import { useDeveloperProfiles, useUserProfiles } from '../profiles/hooks';
import { useProjects } from '../projects/hooks';
import { effectiveTaskAssigneeIds } from './api';
import { useTasksByProject } from './hooks';
import { formatHours } from '../../lib/formatHours';

interface TaskInfoSidebarProps {
  companyId: string;
  task: TaskRow;
  canEdit: boolean;
  onEdit: () => void;
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

export function TaskInfoSidebar({
  companyId,
  task,
  canEdit,
  onEdit,
}: TaskInfoSidebarProps) {
  const { data: projects = [] } = useProjects(companyId);
  const { data: projectTasks = [] } = useTasksByProject(task.projectId);
  const { data: projectAssignments = [] } = useProjectAssignments(task.projectId);
  const { data: developers = [] } = useDeveloperProfiles(true);
  const { data: userProfiles = [] } = useUserProfiles(true);

  const nameByUserId = useMemo(() => {
    const map = new Map<string, string>();
    for (const profile of userProfiles) map.set(profile.userId, profile.displayName);
    for (const profile of developers) map.set(profile.userId, profile.displayName);
    return map;
  }, [userProfiles, developers]);

  const project = projects.find((row) => row.$id === task.projectId);
  const parentTask = task.parentTaskId
    ? projectTasks.find((row) => row.$id === task.parentTaskId)
    : null;
  const taskType = (task.taskType ?? 'development') as TaskType;
  const projectAssigneesByProjectId = new Map<string, string[]>([
    [
      task.projectId,
      [...new Set(projectAssignments.map((row) => row.userId).filter(Boolean))],
    ],
  ]);
  const assigneeNames = effectiveTaskAssigneeIds(task, projectAssigneesByProjectId)
    .map((id) => nameByUserId.get(id) ?? id);

  return (
    <aside className="client-dashboard-side project-detail-sidebar">
      <section className="report-card project-info-card task-info-card">
        <div className="report-card-header">
          <h3>
            <Info size={16} /> <Trans>Taak info</Trans>
          </h3>
        </div>
        <div className="project-info-body">
          <div className="project-info-top">
            <h4 className="project-info-name">{task.title}</h4>
            <span className={`badge badge-status badge-status--${task.status}`}>
              {statusLabel(task.status)}
            </span>
          </div>

          <div className="project-info-meta">
            <div className="project-info-meta-item">
              <span className="project-info-meta-label"><Trans>Uren</Trans></span>
              <span>{formatHours(task.hours)}</span>
            </div>
            <div className="project-info-meta-item">
              <span className="project-info-meta-label"><Trans>Type</Trans></span>
              <span>{TASK_TYPE_LABELS[taskType]}</span>
            </div>
            <div className="project-info-meta-item">
              <span className="project-info-meta-label"><Trans>Project</Trans></span>
              {project ? (
                <Link className="project-info-link" to={`/app/projects/${project.$id}`}>
                  {project.name}
                </Link>
              ) : (
                <span>—</span>
              )}
            </div>
            <div className="project-info-meta-item">
              <span className="project-info-meta-label"><Trans>Bovenliggende taak</Trans></span>
              {parentTask ? (
                <Link className="project-info-link" to={`/app/tasks/${parentTask.$id}`}>
                  {parentTask.title}
                </Link>
              ) : (
                <span>—</span>
              )}
            </div>
            <div className="project-info-meta-row project-info-meta-row--pair">
              <div className="project-info-meta-item">
                <span className="project-info-meta-label"><Trans>Aangemaakt</Trans></span>
                <span>{dayjs(task.$createdAt).format('D MMM YYYY')}</span>
              </div>
              <div className="project-info-meta-item">
                <span className="project-info-meta-label"><Trans>Developers</Trans></span>
                {assigneeNames.length === 0 ? (
                  <span className="data-table-muted"><Trans>Nog geen developers toegewezen.</Trans></span>
                ) : (
                  <span className="task-info-developer-names">{assigneeNames.join(', ')}</span>
                )}
              </div>
            </div>
            {task.dueDate ? (
              <div className="project-info-meta-item">
                <span className="project-info-meta-label"><Trans>Vervaldatum</Trans></span>
                <span>{dayjs(task.dueDate).format('D MMM YYYY')}</span>
              </div>
            ) : null}
            {task.completedDate ? (
              <div className="project-info-meta-item">
                <span className="project-info-meta-label"><Trans>Afgerond op</Trans></span>
                <span>{dayjs(task.completedDate).format('D MMM YYYY')}</span>
              </div>
            ) : null}
            {(task.audience ?? 'internal') === 'client' ? (
              <div className="project-info-meta-item">
                <span className="project-info-meta-label"><Trans>Bestand uploaden</Trans></span>
                <span>
                  {task.requiresFileUpload ? <Trans>Verplicht</Trans> : <Trans>Niet verplicht</Trans>}
                </span>
              </div>
            ) : null}
          </div>

          {canEdit ? (
            <div className="task-info-actions">
              <button type="button" className="btn-accent" onClick={onEdit}>
                <Trans>Taak bewerken</Trans>
              </button>
            </div>
          ) : null}
        </div>
      </section>
    </aside>
  );
}
