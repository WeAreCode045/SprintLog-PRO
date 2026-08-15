import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trans, useLingui } from '@lingui/react/macro';
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
import { TaskEditView } from './TaskEditView';
import { MarkFinishedDialog } from './MarkFinishedDialog';
import { DeveloperTasksTable } from './DeveloperTasksTable';
import { TaskViewTabs } from './TaskViewTabs';
import type { CompanyRow, TaskRow, ResolvedRole, TaskStatus } from '../../appwrite/types';
import { hasOpenSubtasks, includeTaskAncestors } from './api';
import {
  countTasksByViewTab,
  defaultTaskViewTab,
  splitTasksByViewTab,
  type TaskViewTab,
} from './taskViewTabUtils';
import { canDeleteTaskRow } from './taskDeleteAccess';
import { useTaskIdsWithInvoicedHours } from '../timeEntries/hooks';

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
  onFinish: (task: TaskRow) => void;
  onReopen: (task: TaskRow) => void;
  onAccept: (task: TaskRow) => void;
  onView: (task: TaskRow) => void;
  onAddSubtask: (task: TaskRow) => void;
}

export function TaskList({
  companyIds,
  companyById,
  isMultiCompany,
  userId,
  role,
}: TaskListProps) {
  const { t } = useLingui();
  const navigate = useNavigate();
  const primaryCompanyId = companyIds[0] ?? '';
  const primaryCompany = companyById(primaryCompanyId);
  const { data: allTasks = [], isLoading } = useTasksForCompanies(companyIds, 'all');
  const { data: projects = [] } = useProjectsForCompanies(companyIds);
  const deleteTask = useDeleteTask(primaryCompanyId);
  const reopenTask = useReopenTask(primaryCompanyId);
  const acceptRequested = useAcceptRequestedTask(primaryCompanyId);
  const taskIds = useMemo(() => allTasks.map((task) => task.$id), [allTasks]);
  const { data: invoicedTaskIds = new Set<string>() } = useTaskIdsWithInvoicedHours(taskIds);

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskRow | null>(null);
  const [parentForSubtask, setParentForSubtask] = useState<TaskRow | null>(null);
  const [finishingTask, setFinishingTask] = useState<TaskRow | null>(null);

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
    new Set<TaskStatus>(['requested', 'archived']),
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
    return canDeleteTaskRow(task, role, userId, invoicedTaskIds);
  }

  async function handleDeleteTask(task: TaskRow) {
    if (!confirm(t`Taak verwijderen?`)) return;
    await deleteTask.mutateAsync(task.$id);
  }

  function canAddSubtask(task: TaskRow) {
    if (task.status !== 'open' && task.status !== 'requested') return false;
    if (staff) return true;
    if (role === 'client') return canEditTask(task);
    return false;
  }

  const clientCreatesRequested = role === 'client' && activeTab === 'requested';

  const actions: TaskRowActions = {
    projectName: (projectId) => projects.find((p) => p.$id === projectId)?.name ?? '—',
    onFinish: (task) => {
      if (hasOpenSubtasks(task.$id, tasks)) {
        alert(t`Rond eerst alle open subtaken af.`);
        return;
      }
      setFinishingTask(task);
    },
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
    onAccept: (task) => {
      void acceptRequested.mutateAsync({
        taskId: task.$id,
        teamId: resolveTeamId(task.companyId),
        companyId: task.companyId,
        createdBy: task.createdBy,
        assigneeIds: task.assigneeIds,
      });
    },
    onView: (task) => navigate(`/app/tasks/${task.$id}`),
    onAddSubtask: setParentForSubtask,
  };

  const pageTitle = role === 'client' ? t`Jouw taken` : t`Taken`;
  const canAddOnActiveTab =
    canAdd &&
    (activeTab === 'client' ||
      (activeTab === 'developer' && role !== 'client') ||
      (activeTab === 'requested' && role === 'client'));

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

      {editingTask ? (
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
          <DeveloperTasksTable
            companyId={primaryCompanyId}
            teamId={primaryCompany?.teamId ?? ''}
            resolveTeamId={resolveTeamId}
            userId={userId}
            role={role}
            tasks={requestedTasks}
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
            canDelete={canDeleteTask}
            onDelete={(task) => void handleDeleteTask(task)}
            statusFilter="requested"
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
                  <DeveloperTasksTable
                    companyId={project.companyId}
                    teamId={resolveTeamId(project.companyId)}
                    resolveTeamId={resolveTeamId}
                    userId={userId}
                    role={role}
                    tasks={clientTasks.filter((task) => task.projectId === project.$id)}
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
                    canDelete={canDeleteTask}
                    onDelete={(task) => void handleDeleteTask(task)}
                    excludedStatuses={excludedStatuses}
                  />
                </div>
              ))}
          </div>
        ) : (
          <DeveloperTasksTable
            companyId={primaryCompanyId}
            teamId={primaryCompany?.teamId ?? ''}
            resolveTeamId={resolveTeamId}
            userId={userId}
            role={role}
            tasks={clientTasks}
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
            canDelete={canDeleteTask}
            onDelete={(task) => void handleDeleteTask(task)}
            excludedStatuses={excludedStatuses}
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
                    resolveTeamId={resolveTeamId}
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
                    canDelete={canDeleteTask}
                    onDelete={(task) => void handleDeleteTask(task)}
                    excludedStatuses={excludedStatuses}
                  />
                </div>
              ))}
          </div>
        ) : (
          <DeveloperTasksTable
            companyId={primaryCompanyId}
            teamId={primaryCompany?.teamId ?? ''}
            resolveTeamId={resolveTeamId}
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
            canDelete={canDeleteTask}
            onDelete={(task) => void handleDeleteTask(task)}
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
