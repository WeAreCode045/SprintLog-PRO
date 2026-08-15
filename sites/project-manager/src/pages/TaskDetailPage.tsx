import { useMemo, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Link, Navigate, useNavigate, useOutletContext, useParams, useSearchParams } from 'react-router-dom';
import { Trans, useLingui } from '@lingui/react/macro';
import { useAuth } from '../auth/AuthContext';
import { isStaffRole } from '../auth/RequireStaff';
import { PageBreadcrumb } from '../components/PageBreadcrumb';
import { PageHeader } from '../components/PageHeader';
import type { PortalContext } from '../layouts/PortalLayout';
import { useDeveloperProfiles, useUserProfiles } from '../features/profiles/hooks';
import { TaskCommentsSection } from '../features/tasks/TaskCommentsSection';
import { TaskEditView } from '../features/tasks/TaskEditView';
import { TaskInfoSidebar } from '../features/tasks/TaskInfoSidebar';
import { useDeleteTask, useTask } from '../features/tasks/hooks';
import { canDeleteTaskRow } from '../features/tasks/taskDeleteAccess';
import { useTaskIdsWithInvoicedHours } from '../features/timeEntries/hooks';
import type { TaskRow } from '../appwrite/types';

function canEditTask(task: TaskRow, role: PortalContext['role']) {
  if (role === 'admin' || role === 'developer') return true;
  if (role === 'client') {
    return task.status === 'open' || task.status === 'requested';
  }
  const _exhaustive: never = role;
  return _exhaustive;
}

export function TaskDetailPage() {
  const { t } = useLingui();
  const { taskId } = useParams<{ taskId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { role, enabledCompanyIds, companyById } = useOutletContext<PortalContext>();
  const { data: task, isLoading } = useTask(taskId);
  const { data: invoicedTaskIds = new Set<string>() } = useTaskIdsWithInvoicedHours(
    taskId ? [taskId] : [],
  );
  const { data: profiles = [] } = useUserProfiles(true);
  const { data: developers = [] } = useDeveloperProfiles(true);
  const deleteTask = useDeleteTask(task?.companyId ?? '');
  const [editingTask, setEditingTask] = useState(false);

  const staff = isStaffRole(role);
  const userId = user?.$id ?? '';
  const fromProjectId = searchParams.get('projectId');
  const fromProject = searchParams.get('from') === 'project' && fromProjectId;

  const backHref = fromProject ? `/app/projects/${fromProjectId}` : '/app/tasks';
  const backLabel = fromProject ? t`Terug naar project` : t`Terug naar taken`;

  const nameByUserId = useMemo(() => {
    const map = new Map<string, string>();
    for (const profile of profiles) map.set(profile.userId, profile.displayName);
    for (const profile of developers) map.set(profile.userId, profile.displayName);
    if (user) map.set(user.$id, user.name || user.email || user.$id);
    return map;
  }, [profiles, developers, user]);

  function displayName(userId: string) {
    return nameByUserId.get(userId) ?? userId;
  }

  if (!taskId) {
    return <Navigate to="/app/tasks" replace />;
  }

  if (isLoading || !user) {
    return (
      <div className="content-card">
        <div className="content-inner">
          <p><Trans>Laden…</Trans></p>
        </div>
      </div>
    );
  }

  if (!task || !enabledCompanyIds.includes(task.companyId)) {
    return (
      <div className="content-card">
        <div className="content-inner">
          <p className="empty-state"><Trans>Taak niet gevonden.</Trans></p>
          <Link className="btn-link" to="/app/tasks">
            <Trans>Terug naar taken</Trans>
          </Link>
        </div>
      </div>
    );
  }

  const company = companyById(task.companyId);
  if (!company) {
    return (
      <div className="content-card">
        <div className="content-inner">
          <p className="empty-state"><Trans>Bedrijf niet gevonden.</Trans></p>
        </div>
      </div>
    );
  }

  if (editingTask) {
    return (
      <div className="content-card">
        <div className="content-inner">
          <TaskEditView
            companyId={task.companyId}
            teamId={company.teamId}
            userId={userId}
            canManageProjects={staff}
            task={task}
            onBack={() => setEditingTask(false)}
          />
        </div>
      </div>
    );
  }

  const canEdit = canEditTask(task, role);
  const canDelete = canDeleteTaskRow(task, role, userId, invoicedTaskIds);

  async function handleDelete() {
    if (!confirm(t`Taak verwijderen?`)) return;
    await deleteTask.mutateAsync(taskId!);
    navigate(backHref);
  }

  return (
    <div className="content-card">
      <div className="content-inner task-detail-page">
        <PageHeader
          title={task.title}
          description={null}
          breadcrumb={
            <PageBreadcrumb
              items={[
                { label: t`Taken`, to: '/app/tasks' },
                { label: task.title },
              ]}
            />
          }
        />

        <Link className="btn-link task-detail-back" to={backHref}>
          <ArrowLeft size={16} aria-hidden /> {backLabel}
        </Link>

        <div className="developer-tasks-with-companion project-detail-layout task-detail-layout">
          <div className="developer-tasks-with-companion-main task-detail-main">
            <h1 className="task-detail-page-title">{task.title}</h1>
            {task.description?.trim() ? (
              <p className="task-detail-page-description">{task.description}</p>
            ) : (
              <p className="task-detail-page-description task-detail-page-description--empty">
                <Trans>Geen omschrijving.</Trans>
              </p>
            )}

            <TaskCommentsSection
              task={task}
              companyId={task.companyId}
              teamId={company.teamId}
              role={role}
              displayName={displayName}
            />

            {canDelete ? (
              <div className="form-actions task-detail-client-actions">
                <button type="button" onClick={() => void handleDelete()}>
                  <Trans>Verwijderen</Trans>
                </button>
              </div>
            ) : null}
          </div>

          <TaskInfoSidebar
            companyId={task.companyId}
            task={task}
            canEdit={canEdit}
            onEdit={() => setEditingTask(true)}
          />
        </div>
      </div>
    </div>
  );
}
