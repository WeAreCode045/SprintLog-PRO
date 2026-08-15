import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trans, useLingui } from '@lingui/react/macro';
import {
  MAX_TASK_NEST_DEPTH,
  TASK_TYPES,
  TASK_TYPE_LABELS,
  type ResolvedRole,
  type TaskRow,
  type TaskStatus,
  type TaskType,
} from '../../appwrite/types';
import { CheckboxFilterDropdown } from '../../components/CheckboxFilterDropdown';
import { isStaffRole } from '../../auth/RequireStaff';
import { useProjectsForCompanies } from '../projects/hooks';
import {
  useAcceptRequestedTask,
  useDeleteTask,
  useReopenTask,
  useTasks,
  useTasksByProject,
  useTasksForCompanies,
} from './hooks';
import { canDeleteTaskRow } from './taskDeleteAccess';
import { MarkFinishedDialog } from './MarkFinishedDialog';
import { TaskFormDialog } from './TaskFormDialog';
import { TaskEditView } from './TaskEditView';
import { DeveloperTasksTable } from './DeveloperTasksTable';
import { TaskViewTabs } from './TaskViewTabs';
import { taskNestDepth, includeTaskAncestors } from './api';
import { useTaskIdsWithInvoicedHours } from '../timeEntries/hooks';
import {
  countTasksByViewTab,
  clientTasksTabLabel,
  defaultTaskViewTab,
  type TaskViewTab,
} from './taskViewTabUtils';

interface ProjectTasksPanelProps {
  companyId: string;
  teamId: string;
  /** When omitted, loads tasks for the whole company (dashboard). */
  projectId?: string;
  /** When set (dashboard multi-company), loads across these company ids. */
  companyIds?: string[];
  userId: string;
  role: ResolvedRole;
  projectNameById?: Map<string, string>;
  companyName?: (companyId: string) => string;
}

export function ProjectTasksPanel({
  companyId,
  teamId,
  projectId,
  companyIds,
  userId,
  role,
  projectNameById,
  companyName,
}: ProjectTasksPanelProps) {
  const { t } = useLingui();
  const navigate = useNavigate();
  const companyWide = !projectId;
  const multiIds = companyIds && companyIds.length > 0 ? companyIds : [companyId];
  const projectTasksQuery = useTasksByProject(projectId);
  const companyTasksQuery = useTasks(companyWide && multiIds.length === 1 ? companyId : '', 'all');
  const multiCompanyQuery = useTasksForCompanies(
    companyWide && multiIds.length > 1 ? multiIds : [],
    'all',
  );
  const { data: tasks = [], isLoading } = !companyWide
    ? projectTasksQuery
    : multiIds.length > 1
      ? multiCompanyQuery
      : companyTasksQuery;
  const staff = isStaffRole(role);
  const reopenTask = useReopenTask(companyId);
  const acceptRequested = useAcceptRequestedTask(companyId);
  const deleteTask = useDeleteTask(companyId);
  const taskIds = useMemo(() => tasks.map((task) => task.$id), [tasks]);
  const { data: invoicedTaskIds = new Set<string>() } = useTaskIdsWithInvoicedHours(taskIds);
  const [showAdd, setShowAdd] = useState(false);
  const [addAudience, setAddAudience] = useState<'internal' | 'client'>('internal');
  const [editingTask, setEditingTask] = useState<TaskRow | null>(null);
  const [finishingTask, setFinishingTask] = useState<TaskRow | null>(null);
  const [parentForSubtask, setParentForSubtask] = useState<TaskRow | null>(null);
  const [activeTab, setActiveTab] = useState<TaskViewTab>(() => defaultTaskViewTab(role));
  const [excludedStatuses, setExcludedStatuses] = useState<Set<TaskStatus>>(
    new Set<TaskStatus>(['requested', 'archived']),
  );
  const [excludedTypes, setExcludedTypes] = useState<Set<TaskType>>(new Set());
  const [excludedCompanyIds, setExcludedCompanyIds] = useState<Set<string>>(new Set());

  const { data: companyWideProjects = [] } = useProjectsForCompanies(companyWide ? multiIds : []);
  const resolvedProjectNameById = useMemo(() => {
    if (projectNameById) return projectNameById;
    return new Map(companyWideProjects.map((project) => [project.$id, project.name]));
  }, [projectNameById, companyWideProjects]);

  const uniqueCompanyIds = useMemo(() => [...new Set(tasks.map((t) => t.companyId))], [tasks]);

  const TASK_STATUS_OPTIONS: { id: TaskStatus; label: string }[] = useMemo(
    () => [
      { id: 'open', label: t`Open` },
      { id: 'finished', label: t`Afgerond` },
      { id: 'requested', label: t`Aangevraagd` },
      { id: 'archived', label: t`Gearchiveerd` },
    ],
    [t],
  );

  const TASK_TYPE_OPTIONS = useMemo(
    () =>
      TASK_TYPES.map((type) => ({
        id: type,
        label: TASK_TYPE_LABELS[type],
      })),
    [],
  );

  const taskStatuses = useMemo(() => new Set(tasks.map((t) => t.status)), [tasks]);
  const statusFilterOptions = useMemo(
    () => TASK_STATUS_OPTIONS.filter((o) => taskStatuses.has(o.id)),
    [TASK_STATUS_OPTIONS, taskStatuses],
  );

  const taskTypes = useMemo(() => new Set(tasks.map((t) => t.taskType)), [tasks]);
  const typeFilterOptions = useMemo(
    () => TASK_TYPE_OPTIONS.filter((o) => taskTypes.has(o.id)),
    [TASK_TYPE_OPTIONS, taskTypes],
  );

  const companyOptions = useMemo(
    () =>
      uniqueCompanyIds.map((id) => ({
        id,
        label: companyName?.(id) ?? id,
      })),
    [uniqueCompanyIds, companyName],
  );

  const visibleTasks = useMemo(() => {
    return tasks
      .filter(() => {
        if (staff) return true;
        if (role === 'client') return true;
        const _exhaustive: never = role;
        return _exhaustive;
      })
      .slice()
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }, [tasks, role, staff]);

  const requestedTasks = useMemo(
    () =>
      visibleTasks.filter(
        (task) => task.status === 'requested' && (task.audience ?? 'internal') === 'internal',
      ),
    [visibleTasks],
  );

  const developerTasks = useMemo(() => {
    const base = visibleTasks.filter((task) => {
      if ((task.audience ?? 'internal') !== 'internal') return false;
      return task.status !== 'requested';
    });
    // Keep parent rows in the tree even when filters/role hide them from the base set.
    return includeTaskAncestors(base, tasks);
  }, [visibleTasks, tasks]);

  const yourTasks = useMemo(() => {
    return visibleTasks.filter(
      (task) =>
        (task.audience ?? 'internal') === 'client' && !excludedStatuses.has(task.status),
    );
  }, [visibleTasks, excludedStatuses]);

  const tabCounts = useMemo(() => countTasksByViewTab(visibleTasks), [visibleTasks]);
  const clientTabLabel = clientTasksTabLabel(role);

  const canAddInternal = role === 'admin' || role === 'developer' || role === 'client';
  const canAddClient = role === 'admin' || role === 'developer' || role === 'client';
  const clientCreatesRequested = role === 'client';

  function projectLabel(taskProjectId: string) {
    return resolvedProjectNameById.get(taskProjectId) ?? '—';
  }

  function canEdit(task: TaskRow) {
    if (staff) return true;
    if (role === 'client') {
      return task.status === 'open' || task.status === 'requested';
    }
    const _exhaustive: never = role;
    return _exhaustive;
  }

  function canDelete(task: TaskRow) {
    return canDeleteTaskRow(task, role, userId, invoicedTaskIds);
  }

  async function handleDeleteTask(task: TaskRow) {
    if (!confirm(t`Taak verwijderen?`)) return;
    await deleteTask.mutateAsync(task.$id);
  }

  function openTaskDetail(task: TaskRow) {
    const params = new URLSearchParams();
    if (projectId) {
      params.set('from', 'project');
      params.set('projectId', projectId);
    }
    const query = params.toString();
    navigate(`/app/tasks/${task.$id}${query ? `?${query}` : ''}`);
  }

  function canAddSubtask(task: TaskRow) {
    if (task.status !== 'open' && task.status !== 'requested') return false;
    const byId = new Map(visibleTasks.map((row) => [row.$id, row]));
    if (taskNestDepth(task, byId) >= MAX_TASK_NEST_DEPTH - 1) return false;
    if (staff) return true;
    if (role === 'client') return canEdit(task);
    const _exhaustive: never = role;
    return _exhaustive;
  }

  function canFinish(task: TaskRow) {
    if (task.status !== 'open') return false;
    if (staff) return true;
    if (role === 'client') {
      return (task.audience ?? 'internal') === 'client';
    }
    const _exhaustive: never = role;
    return _exhaustive;
  }

  function canAccept(task: TaskRow) {
    if (task.status !== 'requested') return false;
    return staff;
  }

  if (isLoading) return <p><Trans>Laden…</Trans></p>;

  const canAddOnActiveTab =
    (activeTab === 'developer' && canAddInternal && !clientCreatesRequested) ||
    (activeTab === 'client' && canAddClient) ||
    (activeTab === 'requested' && clientCreatesRequested);

  return (
    <div className="project-tasks-panel">
      {editingTask ? (
        <TaskEditView
          companyId={companyId}
          teamId={teamId}
          userId={userId}
          canManageProjects={staff}
          task={editingTask}
          onBack={() => setEditingTask(null)}
        />
      ) : (
        <>
      <TaskViewTabs
        activeTab={activeTab}
        onTabChange={setActiveTab}
        counts={tabCounts}
        role={role}
        filters={
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            {statusFilterOptions.length > 1 && (
              <CheckboxFilterDropdown
                options={statusFilterOptions}
                excludedIds={excludedStatuses}
                onToggle={(id) =>
                  setExcludedStatuses((prev) => {
                    const next = new Set(prev);
                    if (next.has(id)) next.delete(id);
                    else next.add(id);
                    return next;
                  })
                }
                onSelectAll={() => setExcludedStatuses(new Set())}
                onSelectNone={() => setExcludedStatuses(new Set(statusFilterOptions.map((o) => o.id)))}
                labelPlural={t`statussen`}
              />
            )}
            {typeFilterOptions.length > 1 && (
              <CheckboxFilterDropdown
                options={typeFilterOptions}
                excludedIds={excludedTypes}
                onToggle={(id) =>
                  setExcludedTypes((prev) => {
                    const next = new Set(prev);
                    if (next.has(id)) next.delete(id);
                    else next.add(id);
                    return next;
                  })
                }
                onSelectAll={() => setExcludedTypes(new Set())}
                onSelectNone={() => setExcludedTypes(new Set(typeFilterOptions.map((o) => o.id)))}
                labelPlural={t`typen`}
              />
            )}
            {companyWide && uniqueCompanyIds.length > 1 && (
              <CheckboxFilterDropdown
                options={companyOptions}
                excludedIds={excludedCompanyIds}
                onToggle={(id) =>
                  setExcludedCompanyIds((prev) => {
                    const next = new Set(prev);
                    if (next.has(id)) next.delete(id);
                    else next.add(id);
                    return next;
                  })
                }
                onSelectAll={() => setExcludedCompanyIds(new Set())}
                onSelectNone={() => setExcludedCompanyIds(new Set(uniqueCompanyIds))}
                labelPlural={t`bedrijven`}
              />
            )}
          </div>
        }
        endAction={
          canAddOnActiveTab ? (
            <button
              type="button"
              className="btn-accent"
              onClick={() => {
                setAddAudience(activeTab === 'client' ? 'client' : 'internal');
                setShowAdd(true);
              }}
            >
              {activeTab === 'client'
                ? role === 'client'
                  ? t`+ Taak toevoegen`
                  : t`+ Klanttaak`
                : activeTab === 'requested'
                  ? t`+ Taak aanvragen`
                  : t`+ Taak`}
            </button>
          ) : null
        }
      />

      <div className="project-tasks-panel-body">
        {activeTab === 'developer' && (
          <DeveloperTasksTable
            companyId={companyId}
            teamId={teamId}
            userId={userId}
            role={role}
            tasks={developerTasks}
            showProjectColumn={companyWide}
            projectName={companyWide ? projectLabel : undefined}
            canFinish={canFinish}
            canAccept={canAccept}
            canEdit={canEdit}
            canAddSubtask={canAddSubtask}
            onFinish={setFinishingTask}
            onReopen={(task) =>
              void reopenTask.mutateAsync({
                taskId: task.$id,
                teamId,
                companyId,
                projectId: task.projectId,
                createdBy: task.createdBy,
                assigneeIds: task.assigneeIds,
              })
            }
            onAccept={(task) =>
              void acceptRequested.mutateAsync({
                taskId: task.$id,
                teamId,
                companyId,
                createdBy: task.createdBy,
                assigneeIds: task.assigneeIds,
              })
            }
            onView={openTaskDetail}
            onAddSubtask={setParentForSubtask}
            canDelete={canDelete}
            onDelete={(task) => void handleDeleteTask(task)}
            excludedStatuses={excludedStatuses}
            excludedTypes={excludedTypes}
            excludedCompanyIds={excludedCompanyIds}
          />
        )}

        {activeTab === 'requested' &&
          (requestedTasks.length === 0 ? (
            <p className="empty-state">
              {role === 'client' ? <Trans>Nog geen aanvragen.</Trans> : <Trans>Geen openstaande aanvragen.</Trans>}
            </p>
          ) : (
            <DeveloperTasksTable
              companyId={companyId}
              teamId={teamId}
              userId={userId}
              role={role}
              tasks={requestedTasks}
              showProjectColumn={companyWide}
              projectName={companyWide ? projectLabel : undefined}
              canFinish={canFinish}
              canAccept={canAccept}
              canEdit={canEdit}
              canAddSubtask={canAddSubtask}
              onFinish={setFinishingTask}
              onReopen={(task) =>
                void reopenTask.mutateAsync({
                  taskId: task.$id,
                  teamId,
                  companyId,
                  projectId: task.projectId,
                  createdBy: task.createdBy,
                  assigneeIds: task.assigneeIds,
                })
              }
              onAccept={(task) =>
                void acceptRequested.mutateAsync({
                  taskId: task.$id,
                  teamId,
                  companyId,
                  createdBy: task.createdBy,
                  assigneeIds: task.assigneeIds,
                })
              }
              onView={openTaskDetail}
              onAddSubtask={setParentForSubtask}
              canDelete={canDelete}
              onDelete={(task) => void handleDeleteTask(task)}
              statusFilter="requested"
              excludedTypes={excludedTypes}
              excludedCompanyIds={excludedCompanyIds}
            />
          ))}

        {activeTab === 'client' &&
          (yourTasks.length === 0 ? (
            <p className="empty-state">
              {role === 'client' ? (
                <Trans>Geen taken.</Trans>
              ) : (
                t`Geen ${clientTabLabel.toLowerCase()}.`
              )}
            </p>
          ) : (
            <DeveloperTasksTable
              companyId={companyId}
              teamId={teamId}
              userId={userId}
              role={role}
              tasks={yourTasks}
              showProjectColumn={companyWide}
              projectName={companyWide ? projectLabel : undefined}
              canFinish={canFinish}
              canAccept={canAccept}
              canEdit={canEdit}
              canAddSubtask={canAddSubtask}
              onFinish={setFinishingTask}
              onReopen={(task) =>
                void reopenTask.mutateAsync({
                  taskId: task.$id,
                  teamId,
                  companyId,
                  projectId: task.projectId,
                  createdBy: task.createdBy,
                  assigneeIds: task.assigneeIds,
                })
              }
              onAccept={(task) =>
                void acceptRequested.mutateAsync({
                  taskId: task.$id,
                  teamId,
                  companyId,
                  createdBy: task.createdBy,
                  assigneeIds: task.assigneeIds,
                })
              }
              onView={openTaskDetail}
              onAddSubtask={setParentForSubtask}
              canDelete={canDelete}
              onDelete={(task) => void handleDeleteTask(task)}
              excludedStatuses={excludedStatuses}
              excludedTypes={excludedTypes}
              excludedCompanyIds={excludedCompanyIds}
            />
          ))}
      </div>
        </>
      )}

      {showAdd && (
        <TaskFormDialog
          companyId={companyId}
          teamId={teamId}
          userId={userId}
          canManageProjects={staff}
          defaultProjectId={projectId}
          defaultAudience={addAudience}
          defaultStatus={
            addAudience === 'internal' && (clientCreatesRequested || activeTab === 'requested')
              ? 'requested'
              : 'open'
          }
          lockAudience
          onClose={() => setShowAdd(false)}
        />
      )}
      {parentForSubtask && (
        <TaskFormDialog
          companyId={companyId}
          teamId={teamId}
          userId={userId}
          canManageProjects={staff}
          parentTask={parentForSubtask}
          defaultAudience={parentForSubtask.audience ?? 'internal'}
          defaultStatus={
            role === 'client' && (parentForSubtask.audience ?? 'internal') === 'internal'
              ? 'requested'
              : 'open'
          }
          lockAudience
          onClose={() => setParentForSubtask(null)}
        />
      )}
      {finishingTask && (
        <MarkFinishedDialog
          task={finishingTask}
          teamId={teamId}
          companyId={companyId}
          onClose={() => setFinishingTask(null)}
        />
      )}
    </div>
  );
}
