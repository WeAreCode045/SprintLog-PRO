import { useMemo, useState, type ReactNode } from 'react';
import { Trans, useLingui } from '@lingui/react/macro';
import { IconCheck, IconChevronDown, IconChevronRight, IconLockOpen } from '../../components/icons';
import { CheckboxFilterDropdown } from '../../components/CheckboxFilterDropdown';
import { ProjectFilterDropdown } from '../../components/ProjectFilterDropdown';
import { PageHeader } from '../../components/PageHeader';
import { PageBreadcrumb } from '../../components/PageBreadcrumb';
import { isStaffRole } from '../../auth/RequireStaff';
import { useProjectsForCompanies } from '../projects/hooks';
import {
  useAcceptRequestedTask,
  useDeleteTask,
  useReopenTask,
  useTasksForCompanies,
} from './hooks';
import { TaskFormDialog } from './TaskFormDialog';
import { TaskDetailView } from './TaskDetailView';
import { TaskEditView } from './TaskEditView';
import { MarkFinishedDialog } from './MarkFinishedDialog';
import { DeveloperTasksTable } from './DeveloperTasksTable';
import { TaskViewTabs } from './TaskViewTabs';
import { SortableTodoList } from './SortableTodoList';
import type { CompanyRow, TaskRow, ResolvedRole, TaskStatus } from '../../appwrite/types';
import { hasOpenSubtasks, includeTaskAncestors } from './api';
import {
  countTasksByViewTab,
  defaultTaskViewTab,
  splitTasksByViewTab,
  type TaskViewTab,
} from './taskViewTabUtils';
import { formatHours } from '../../lib/formatHours';

interface TaskListProps {
  companyIds: string[];
  companyById: (id: string) => CompanyRow | undefined;
  isMultiCompany: boolean;
  userId: string;
  role: ResolvedRole;
}

function byOrder(a: { order?: number | null; $createdAt: string }, b: { order?: number | null; $createdAt: string }) {
  const ao = a.order ?? Number.MAX_SAFE_INTEGER;
  const bo = b.order ?? Number.MAX_SAFE_INTEGER;
  if (ao !== bo) return ao - bo;
  return a.$createdAt.localeCompare(b.$createdAt);
}

interface TaskRowActions {
  projectName: (projectId: string) => string;
  companyName?: (companyId: string) => string;
  showCompany?: boolean;
  isDescriptionOpen: (taskId: string) => boolean;
  onToggleDescription: (taskId: string) => void;
  canFinish: (task: TaskRow) => boolean;
  onFinish: (task: TaskRow) => void;
  canReopen: (task: TaskRow) => boolean;
  onReopen: (task: TaskRow) => void;
  canAccept: (task: TaskRow) => boolean;
  onAccept: (task: TaskRow) => void;
  onView: (task: TaskRow) => void;
  canEdit: (task: TaskRow) => boolean;
  onAddSubtask: (task: TaskRow) => void;
  canAddSubtask: (task: TaskRow) => boolean;
}

function TaskRowContent({
  task,
  actions,
  dragHandle,
}: {
  task: TaskRow;
  actions: TaskRowActions;
  dragHandle?: ReactNode;
}) {
  const { t } = useLingui();
  const hasDescription = Boolean(task.description);
  const descriptionOpen = hasDescription && actions.isDescriptionOpen(task.$id);
  return (
    <>
      <div
        className={`todo-item-header ${hasDescription ? 'todo-item-header--clickable' : ''}`}
        onClick={hasDescription ? () => actions.onToggleDescription(task.$id) : undefined}
      >
        {dragHandle}
        {hasDescription && (
          <span className="todo-item-toggle">{descriptionOpen ? <IconChevronDown /> : <IconChevronRight />}</span>
        )}
        <button
          type="button"
          className="todo-item-title-button"
          onClick={(e) => {
            e.stopPropagation();
            actions.onView(task);
          }}
        >
          {task.title}
        </button>
        {task.status === 'requested' && <span className="badge badge-requested"><Trans>Aangevraagd</Trans></span>}
        {task.audience === 'client' && <span className="badge badge-client"><Trans>Klanttaak</Trans></span>}
        {task.parentTaskId && <span className="badge badge-subtask"><Trans>Subtaak</Trans></span>}
        <span className="todo-item-project">{actions.projectName(task.projectId)}</span>
        {actions.showCompany && actions.companyName && (
          <span className="todo-item-project">{actions.companyName(task.companyId)}</span>
        )}
        {task.status === 'finished' && (
          <span className="todo-item-finished-meta">
            {task.hours != null && formatHours(task.hours)}
            {task.completedDate && ` · ${new Date(task.completedDate).toLocaleDateString('nl-NL')}`}
          </span>
        )}
        <div className="todo-item-actions" onClick={(e) => e.stopPropagation()}>
          {actions.canAccept(task) && (
            <button type="button" className="btn-link" title={t`Accepteren`} onClick={() => actions.onAccept(task)}>
              <Trans>Accepteren</Trans>
            </button>
          )}
          {actions.canAddSubtask(task) && (
            <button type="button" className="btn-link" title={t`Subtaak toevoegen`} onClick={() => actions.onAddSubtask(task)}>
              <Trans>+ Sub</Trans>
            </button>
          )}
          {task.status === 'open' && actions.canFinish(task) && (
            <button type="button" className="icon-button" title={t`Afronden`} onClick={() => actions.onFinish(task)}>
              <IconCheck />
            </button>
          )}
          {task.status === 'finished' && actions.canReopen(task) && (
            <button
              type="button"
              className="icon-button"
              title={t`Heropenen`}
              onClick={() => actions.onReopen(task)}
            >
              <IconLockOpen />
            </button>
          )}
        </div>
      </div>
      {descriptionOpen && (
        <div className="todo-item-body">
          <div className="todo-item-main">
            <div className="todo-item-description">{task.description}</div>
          </div>
        </div>
      )}
    </>
  );
}

export function TaskList({
  companyIds,
  companyById,
  isMultiCompany,
  userId,
  role,
}: TaskListProps) {
  const { t } = useLingui();
  const primaryCompanyId = companyIds[0] ?? '';
  const primaryCompany = companyById(primaryCompanyId);
  const { data: allTasks = [], isLoading } = useTasksForCompanies(companyIds, 'all');
  const { data: projects = [] } = useProjectsForCompanies(companyIds);
  const deleteTask = useDeleteTask(primaryCompanyId);
  const reopenTask = useReopenTask(primaryCompanyId);
  const acceptRequested = useAcceptRequestedTask(primaryCompanyId);

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskRow | null>(null);
  const [viewingTask, setViewingTask] = useState<TaskRow | null>(null);
  const [parentForSubtask, setParentForSubtask] = useState<TaskRow | null>(null);
  const [finishingTask, setFinishingTask] = useState<TaskRow | null>(null);
  const [collapsedTasks, setCollapsedTasks] = useState<Set<string>>(new Set());

  const taskCompanyIds = useMemo(() => new Set(allTasks.map((t) => t.companyId)), [allTasks]);
  const companyFilterOptions = useMemo(
    () =>
      companyIds
        .filter((id) => taskCompanyIds.has(id))
        .map((id) => ({ id, label: companyName(id) })),
    [companyIds, taskCompanyIds, companyName],
  );

  const taskProjectIds = useMemo(() => new Set(allTasks.map((t) => t.projectId)), [allTasks]);
  const projectFilterOptions = useMemo(
    () => projects.filter((project) => taskProjectIds.has(project.$id)),
    [projects, taskProjectIds],
  );
  const [excludedProjectIds, setExcludedProjectIds] = useState<Set<string>>(new Set());
  const [excludedCompanyIds, setExcludedCompanyIds] = useState<Set<string>>(new Set());
  const [excludedStatuses, setExcludedStatuses] = useState<Set<TaskStatus>>(
    new Set<TaskStatus>(['finished', 'requested', 'archived']),
  );
  const [groupByProject, setGroupByProject] = useState(false);
  const [activeTab, setActiveTab] = useState<TaskViewTab>(() => defaultTaskViewTab(role));
  const [formCompanyId, setFormCompanyId] = useState(primaryCompanyId);

  const TASK_STATUS_OPTIONS: { id: TaskStatus; label: string }[] = useMemo(
    () => [
      { id: 'open', label: t`Open` },
      { id: 'finished', label: t`Afgerond` },
      { id: 'requested', label: t`Aangevraagd` },
      { id: 'archived', label: t`Gearchiveerd` },
    ],
    [t],
  );

  const taskStatuses = useMemo(() => new Set(allTasks.map((t) => t.status)), [allTasks]);
  const statusFilterOptions = useMemo(
    () => TASK_STATUS_OPTIONS.filter((o) => taskStatuses.has(o.id)),
    [TASK_STATUS_OPTIONS, taskStatuses],
  );

  const canAdd = role === 'admin' || role === 'developer' || role === 'client';
  const staff = isStaffRole(role);

  const tasks = useMemo(() => {
    if (!isMultiCompany) return allTasks;
    return allTasks.filter((task) => !excludedCompanyIds.has(task.companyId));
  }, [allTasks, excludedCompanyIds, isMultiCompany]);

  const filteredProjects = useMemo(() => {
    if (!isMultiCompany) return projects;
    return projects.filter((project) => !excludedCompanyIds.has(project.companyId));
  }, [projects, excludedCompanyIds, isMultiCompany]);

  const visibleTasks = useMemo(
    () =>
      tasks.filter((task) => {
        if (excludedProjectIds.has(task.projectId)) return false;
        return true;
      }),
    [tasks, excludedProjectIds],
  );

  function resolveTeamId(companyId: string) {
    return companyById(companyId)?.teamId ?? primaryCompany?.teamId ?? '';
  }

  function companyName(companyId: string) {
    return companyById(companyId)?.name ?? '—';
  }

  const taskBuckets = useMemo(() => {
    const split = splitTasksByViewTab(visibleTasks);
    return {
      developer: includeTaskAncestors(split.developer, tasks).slice().sort(byOrder),
      client: split.client.slice().sort(byOrder),
      requested: split.requested.slice().sort(byOrder),
    };
  }, [visibleTasks, tasks]);

  const developerTasks = taskBuckets.developer;
  const clientTasks = useMemo(
    () => taskBuckets.client.filter((task) => !excludedStatuses.has(task.status)),
    [taskBuckets.client, excludedStatuses],
  );
  const requestedTasks = taskBuckets.requested;
  const tabCounts = useMemo(() => countTasksByViewTab(visibleTasks), [visibleTasks]);

  const tasksByProject = useMemo(() => {
    const map = new Map<string, TaskRow[]>();
    for (const t of developerTasks) {
      const list = map.get(t.projectId) ?? [];
      list.push(t);
      map.set(t.projectId, list);
    }
    for (const list of map.values()) list.sort(byOrder);
    return map;
  }, [developerTasks]);

  function canEditTask(task: TaskRow) {
    if (staff) return true;
    if (role === 'client') {
      return task.status === 'open' || task.status === 'requested';
    }
    return false;
  }

  function canFinishTask(task: TaskRow) {
    if (task.status !== 'open') return false;
    if (staff) return true;
    if (role === 'client') {
      return task.audience === 'client';
    }
    return false;
  }

  function canAcceptTask(task: TaskRow) {
    if (task.status !== 'requested') return false;
    return staff;
  }

  function canDeleteTask(task: TaskRow) {
    if (staff) return true;
    if (role === 'client' && task.status === 'requested' && task.createdBy === userId) return true;
    return false;
  }

  function canAddSubtask(task: TaskRow) {
    if (task.status !== 'open' && task.status !== 'requested') return false;
    if (staff) return true;
    if (role === 'client') return canEditTask(task);
    return false;
  }

  const clientCreatesRequested = role === 'client' && activeTab === 'requested';

  function toggleTaskDescription(taskId: string) {
    setCollapsedTasks((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  }

  const actions: TaskRowActions = {
    projectName: (projectId) => projects.find((p) => p.$id === projectId)?.name ?? '—',
    companyName,
    showCompany: isMultiCompany,
    isDescriptionOpen: (taskId) => !collapsedTasks.has(taskId),
    onToggleDescription: toggleTaskDescription,
    canFinish: canFinishTask,
    onFinish: (task) => {
      if (hasOpenSubtasks(task.$id, tasks)) {
        alert(t`Rond eerst alle open subtaken af.`);
        return;
      }
      setFinishingTask(task);
    },
    canReopen: (task) => staff && task.status === 'finished',
    onReopen: (task) => {
      void reopenTask.mutateAsync({
        taskId: task.$id,
        teamId: resolveTeamId(task.companyId),
        companyId: task.companyId,
        projectId: task.projectId,
        createdBy: task.createdBy,
        assigneeIds: task.assigneeIds,
      });
    },
    canAccept: canAcceptTask,
    onAccept: (task) => {
      void acceptRequested.mutateAsync({
        taskId: task.$id,
        teamId: resolveTeamId(task.companyId),
        companyId: task.companyId,
        createdBy: task.createdBy,
        assigneeIds: task.assigneeIds,
      });
    },
    onView: setViewingTask,
    canEdit: canEditTask,
    onAddSubtask: setParentForSubtask,
    canAddSubtask,
  };

  const pageTitle = role === 'client' ? t`Jouw taken` : t`Taken`;
  const canAddOnActiveTab =
    canAdd &&
    (activeTab === 'client' ||
      (activeTab === 'developer' && role !== 'client') ||
      (activeTab === 'requested' && role === 'client'));

  function canReorderTask(task: TaskRow) {
    if (task.status === 'finished') return false;
    if (role === 'client') return task.status === 'open' || task.status === 'requested';
    return canEditTask(task);
  }

  function renderListTaskRow(task: TaskRow, dragHandle?: ReactNode) {
    return <TaskRowContent task={task} actions={actions} dragHandle={dragHandle} />;
  }

  return (
    <div className="open-todo-list content-card">
      <div className="content-inner">
      <PageHeader
        title={pageTitle}
        description={
          role === 'client'
            ? t`Developer taken, client taken en aanvragen.`
            : t`Developer taken, client taken en aanvragen per tab.`
        }
        breadcrumb={
          <PageBreadcrumb
            items={[{ label: t`Dashboard`, to: '/app/dashboard' }, { label: pageTitle }]}
          />
        }
      />

      {viewingTask ? (
        <TaskDetailView
          companyId={viewingTask.companyId}
          task={viewingTask}
          canEdit={canEditTask(viewingTask)}
          canDelete={canDeleteTask(viewingTask)}
          onEdit={() => {
            const task = viewingTask;
            setViewingTask(null);
            setEditingTask(task);
          }}
          onDelete={() => {
            if (confirm(t`Taak "${viewingTask.title}" verwijderen?`)) {
              void deleteTask.mutateAsync(viewingTask.$id);
              setViewingTask(null);
            }
          }}
          onBack={() => setViewingTask(null)}
        />
      ) : editingTask ? (
        <TaskEditView
          companyId={editingTask.companyId}
          teamId={resolveTeamId(editingTask.companyId)}
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
            {companyFilterOptions.length > 1 && (
              <CheckboxFilterDropdown
                options={companyFilterOptions}
                excludedIds={excludedCompanyIds}
                onToggle={(id) => {
                  setExcludedCompanyIds((prev) => {
                    const next = new Set(prev);
                    if (next.has(id)) next.delete(id);
                    else next.add(id);
                    return next;
                  });
                  setExcludedProjectIds(new Set());
                }}
                onSelectAll={() => {
                  setExcludedCompanyIds(new Set());
                  setExcludedProjectIds(new Set());
                }}
                onSelectNone={() => {
                  setExcludedCompanyIds(new Set(companyFilterOptions.map((c) => c.id)));
                  setExcludedProjectIds(new Set());
                }}
                labelPlural={t`bedrijven`}
              />
            )}
            {projectFilterOptions.length > 1 && (
              <ProjectFilterDropdown
                projects={projectFilterOptions}
                excludedIds={excludedProjectIds}
                onToggle={(projectId) =>
                  setExcludedProjectIds((prev) => {
                    const next = new Set(prev);
                    if (next.has(projectId)) next.delete(projectId);
                    else next.add(projectId);
                    return next;
                  })
                }
                onSelectAll={() => setExcludedProjectIds(new Set())}
                onSelectNone={() => setExcludedProjectIds(new Set(projectFilterOptions.map((p) => p.$id)))}
              />
            )}
            {activeTab === 'developer' && (
              <div className="view-toggle" style={{ marginLeft: 'auto' }}>
                <button type="button" className={groupByProject ? 'active' : ''} onClick={() => setGroupByProject((v) => !v)}>
                  <Trans>Per project</Trans>
                </button>
              </div>
            )}
          </div>
        }
        endAction={
          canAddOnActiveTab ? (
            <button
              type="button"
              className="btn-accent"
              onClick={() => setShowAddDialog(true)}
            >
              {activeTab === 'client'
                ? role === 'client'
                  ? t`+ Taak toevoegen`
                  : t`+ Klanttaak`
                : activeTab === 'requested'
                  ? t`+ Taak aanvragen`
                  : t`+ Nieuwe taak`}
            </button>
          ) : null
        }
      />

      {isLoading && <p><Trans>Laden…</Trans></p>}

      {!isLoading && activeTab === 'requested' && (
        requestedTasks.length === 0 ? (
          <p className="empty-state">
            {role === 'client' ? t`Nog geen aanvragen. Dien een nieuwe taak in.` : t`Geen openstaande aanvragen.`}
          </p>
        ) : (
          <SortableTodoList
            companyId={primaryCompanyId}
            tasks={requestedTasks}
            canDrag={canReorderTask}
            renderItem={renderListTaskRow}
          />
        )
      )}

      {!isLoading && activeTab === 'client' && (
        clientTasks.length === 0 ? (
          <p className="empty-state">
            {role === 'client' ? t`Geen taken.` : t`Geen klanttaken.`}
          </p>
        ) : groupByProject ? (
          <div className="project-sections">
            {filteredProjects
              .filter((p) => !excludedProjectIds.has(p.$id) && clientTasks.some((t) => t.projectId === p.$id))
              .map((project) => (
                <div key={project.$id} className="project-section">
                  <h3 className="project-section-header">
                    {project.name}
                    {isMultiCompany ? ` · ${companyName(project.companyId)}` : ''}
                  </h3>
                  <SortableTodoList
                    companyId={project.companyId}
                    tasks={clientTasks.filter((task) => task.projectId === project.$id)}
                    canDrag={canReorderTask}
                    renderItem={renderListTaskRow}
                  />
                </div>
              ))}
          </div>
        ) : (
          <SortableTodoList
            companyId={primaryCompanyId}
            tasks={clientTasks}
            canDrag={canReorderTask}
            renderItem={renderListTaskRow}
          />
        )
      )}

      {!isLoading && activeTab === 'developer' && developerTasks.length === 0 && (
        <p className="empty-state"><Trans>Geen projecttaken.</Trans></p>
      )}

      {!isLoading && activeTab === 'developer' && developerTasks.length > 0 && (
        groupByProject ? (
          <div className="project-sections">
            {filteredProjects
              .filter((p) => !excludedProjectIds.has(p.$id) && (tasksByProject.get(p.$id)?.length ?? 0) > 0)
              .map((project) => (
                <div key={project.$id} className="project-section">
                  <h3 className="project-section-header">
                    {project.name}
                    {isMultiCompany ? ` · ${companyName(project.companyId)}` : ''}
                  </h3>
                  <DeveloperTasksTable
                    companyId={project.companyId}
                    teamId={resolveTeamId(project.companyId)}
                    userId={userId}
                    role={role}
                    tasks={tasksByProject.get(project.$id) ?? []}
                    companyName={isMultiCompany ? companyName : undefined}
                    showCompanyColumn={isMultiCompany}
                    canFinish={canFinishTask}
                    canAccept={canAcceptTask}
                    canEdit={canEditTask}
                    canAddSubtask={canAddSubtask}
                    onFinish={actions.onFinish}
                    onReopen={actions.onReopen}
                    onAccept={actions.onAccept}
                    onView={actions.onView}
                    onAddSubtask={actions.onAddSubtask}
                    excludedStatuses={excludedStatuses}
                  />
                </div>
              ))}
          </div>
        ) : (
          <DeveloperTasksTable
            companyId={primaryCompanyId}
            teamId={primaryCompany?.teamId ?? ''}
            userId={userId}
            role={role}
            tasks={developerTasks}
            showProjectColumn
            projectName={actions.projectName}
            companyName={isMultiCompany ? companyName : undefined}
            showCompanyColumn={isMultiCompany}
            canFinish={canFinishTask}
            canAccept={canAcceptTask}
            canEdit={canEditTask}
            canAddSubtask={canAddSubtask}
            onFinish={actions.onFinish}
            onReopen={actions.onReopen}
            onAccept={actions.onAccept}
            onView={actions.onView}
            onAddSubtask={actions.onAddSubtask}
            excludedStatuses={excludedStatuses}
          />
        )
      )}
        </>
      )}
      </div>

      {showAddDialog && primaryCompany && (
        <TaskFormDialog
          companyId={formCompanyId || primaryCompanyId}
          teamId={resolveTeamId(formCompanyId || primaryCompanyId)}
          userId={userId}
          canManageProjects={staff}
          availableCompanies={
            isMultiCompany
              ? companyIds
                  .map((id) => companyById(id))
                  .filter((company): company is CompanyRow => Boolean(company))
              : undefined
          }
          onCompanyChange={setFormCompanyId}
          defaultAudience={activeTab === 'client' ? 'client' : 'internal'}
          defaultStatus={clientCreatesRequested ? 'requested' : 'open'}
          lockAudience={clientCreatesRequested || activeTab === 'client'}
          onClose={() => setShowAddDialog(false)}
        />
      )}
      {parentForSubtask && (
        <TaskFormDialog
          companyId={parentForSubtask.companyId}
          teamId={resolveTeamId(parentForSubtask.companyId)}
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
          companyId={finishingTask.companyId}
          teamId={resolveTeamId(finishingTask.companyId)}
          task={finishingTask}
          onClose={() => setFinishingTask(null)}
        />
      )}
    </div>
  );
}
