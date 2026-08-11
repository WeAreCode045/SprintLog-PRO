import { useEffect, useMemo, useState } from 'react';
import {
  Clock,
  FolderOpen,
  LayoutDashboard,
  ListTodo,
  MessageSquare,
  type LucideIcon,
} from 'lucide-react';
import { useOutletContext, useParams } from 'react-router-dom';
import { Trans, useLingui } from '@lingui/react/macro';
import type { PortalContext } from '../../layouts/PortalLayout';
import type { TimeEntryRow } from '../../appwrite/types';
import { IconEdit } from '../../components/icons';
import { PageBreadcrumb } from '../../components/PageBreadcrumb';
import { PageHeader } from '../../components/PageHeader';
import { useAuth } from '../../auth/AuthContext';
import { isStaffRole } from '../../auth/RequireStaff';
import { useProjectAssignments } from '../assignments/hooks';
import { DiscussionBoard } from '../discussions/DiscussionBoard';
import { useDiscussions } from '../discussions/hooks';
import { ProjectFileManager } from '../files/ProjectFileManager';
import { useProjectFiles } from '../files/hooks';
import { ProjectTasksPanel } from '../tasks/ProjectTasksPanel';
import { useTasksByProject } from '../tasks/hooks';
import { LogHoursDialog } from '../timeEntries/LogHoursDialog';
import { useTimeEntriesByProject } from '../timeEntries/hooks';
import { useDeveloperProfiles } from '../profiles/hooks';
import { ProjectSidebar } from './ProjectSidebar';
import { markProjectLastVisit } from './projectLastVisit';
import { useCompany } from '../companies/hooks';
import { useProject } from './hooks';

function formatHours(hours: number) {
  return hours % 1 === 0 ? `${hours}` : hours.toFixed(2);
}

type DetailTab = 'overview' | 'hours' | 'discussion' | 'files';

const TAB_KEYS: Array<{ key: DetailTab; icon: LucideIcon }> = [
  { key: 'overview', icon: LayoutDashboard },
  { key: 'hours', icon: Clock },
  { key: 'discussion', icon: MessageSquare },
  { key: 'files', icon: FolderOpen },
];

export function ProjectDetailPage() {
  const { t } = useLingui();
  const { projectId } = useParams<{ projectId: string }>();
  const { role, companyById } = useOutletContext<PortalContext>();
  const { user } = useAuth();
  const { data: project, isLoading } = useProject(projectId);
  const { data: loadedCompany } = useCompany(project?.companyId);
  const company = (project ? companyById(project.companyId) : undefined) ?? loadedCompany;
  const { data: tasks = [] } = useTasksByProject(projectId);
  const { data: timeEntries = [] } = useTimeEntriesByProject(projectId);
  const { data: discussions = [] } = useDiscussions(projectId);
  const { data: files = [] } = useProjectFiles(projectId);
  const { data: developers = [] } = useDeveloperProfiles(true);
  const { data: assignments = [] } = useProjectAssignments(projectId);
  const [activeTab, setActiveTab] = useState<DetailTab>('overview');
  const [editingEntry, setEditingEntry] = useState<TimeEntryRow | null>(null);

  const assigneeUserIds = useMemo(() => assignments.map((row) => row.userId), [assignments]);
  const taskTitleById = useMemo(() => new Map(tasks.map((task) => [task.$id, task.title])), [tasks]);
  const taskById = useMemo(() => new Map(tasks.map((task) => [task.$id, task])), [tasks]);
  const developerById = useMemo(
    () => new Map(developers.map((profile) => [profile.userId, profile])),
    [developers],
  );
  function tabLabel(key: DetailTab) {
    switch (key) {
      case 'overview':
        return t`Overzicht`;
      case 'hours':
        return t`Uren`;
      case 'discussion':
        return t`Discussie`;
      case 'files':
        return t`Bestanden`;
      default: {
        const _exhaustive: never = key;
        return _exhaustive;
      }
    }
  }

  const activeTabConfig = TAB_KEYS.find((tab) => tab.key === activeTab) ?? TAB_KEYS[0];
  const ActiveTabIcon = activeTabConfig.icon;

  const hoursTotal = useMemo(
    () => timeEntries.reduce((sum, entry) => sum + (entry.hours ?? 0), 0),
    [timeEntries],
  );

  const taskHoursTotal = useMemo(
    () =>
      tasks
        .filter((task) => (task.audience ?? 'internal') === 'internal')
        .reduce((sum, task) => sum + (task.hours ?? 0), 0),
    [tasks],
  );

  const workedHours = useMemo(
    () => (hoursTotal > 0 ? hoursTotal : taskHoursTotal),
    [hoursTotal, taskHoursTotal],
  );

  const taskStats = useMemo(() => {
    const total = tasks.length;
    const open = tasks.filter((task) => task.status === 'open' || task.status === 'requested').length;
    const completed = tasks.filter((task) => task.status === 'finished').length;
    return { total, open, completed };
  }, [tasks]);

  function canEditEntry(_entry: TimeEntryRow) {
    return isStaffRole(role);
  }

  useEffect(() => {
    if (!user || !projectId) return;
    if (activeTab !== 'overview' && activeTab !== 'discussion') return;
    return () => {
      markProjectLastVisit(user.$id, projectId);
    };
  }, [activeTab, user, projectId]);

  if (!user || !projectId) return null;
  if (isLoading || !project || !company) {
    return (
      <div className="content-card">
        <div className="content-inner"><Trans>Laden…</Trans></div>
      </div>
    );
  }

  return (
    <div className="content-card">
      <div className="content-inner">
        <PageHeader
          title={project.name}
          description={company?.name}
          breadcrumb={
            <PageBreadcrumb
              items={[
                { label: t`Dashboard`, to: '/app/dashboard' },
                { label: t`Projecten`, to: '/app/projects' },
                { label: project.name },
              ]}
            />
          }
          tabs={
            <div className="task-view-tabs" role="tablist" aria-label={t`Projectonderdelen`}>
              {TAB_KEYS.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.key;

                return (
                  <button
                    key={tab.key}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    className={`task-view-tab${isActive ? ' active' : ''}`}
                    onClick={() => setActiveTab(tab.key)}
                  >
                    <Icon className="task-view-tab-icon" size={16} aria-hidden />
                    <span>{tabLabel(tab.key)}</span>
                  </button>
                );
              })}
            </div>
          }
        />

        <div className="developer-tasks-with-companion project-detail-layout">
          <div className="developer-tasks-with-companion-main project-detail-main">
            <div className="stat-tiles project-overview-stats">
              <div className="stat-tile">
                <span className="stat-tile-icon" aria-hidden>
                  <Clock size={20} />
                </span>
                <div>
                  <div className="stat-tile-value">{formatHours(workedHours)}</div>
                  <div className="stat-tile-label"><Trans>Gewerkte uren</Trans></div>
                </div>
              </div>
              <div className="stat-tile">
                <span className="stat-tile-icon" aria-hidden>
                  <ListTodo size={20} />
                </span>
                <div>
                  <div className="stat-tile-value">{taskStats.total}</div>
                  <div className="stat-tile-label">
                    <Trans>
                      Taken · {taskStats.open} open · {taskStats.completed} afgerond
                    </Trans>
                  </div>
                </div>
              </div>
              <div className="stat-tile">
                <span className="stat-tile-icon" aria-hidden>
                  <MessageSquare size={20} />
                </span>
                <div>
                  <div className="stat-tile-value">{discussions.length}</div>
                  <div className="stat-tile-label"><Trans>Discussies</Trans></div>
                </div>
              </div>
              <div className="stat-tile">
                <span className="stat-tile-icon" aria-hidden>
                  <FolderOpen size={20} />
                </span>
                <div>
                  <div className="stat-tile-value">{files.length}</div>
                  <div className="stat-tile-label"><Trans>Bestanden</Trans></div>
                </div>
              </div>
            </div>

            <div className="project-tab-title">
              <ActiveTabIcon size={20} aria-hidden />
              <h2>{tabLabel(activeTabConfig.key)}</h2>
            </div>

            {activeTab === 'overview' && (
              <ProjectTasksPanel
                companyId={company.$id}
                teamId={company.teamId}
                projectId={project.$id}
                userId={user.$id}
                role={role}
                companyName={(id) => (company?.$id === id ? company.name : id)}
              />
            )}

            {activeTab === 'hours' && (
              <section>
                {timeEntries.length === 0 ? (
                  <p className="empty-state">
                    {workedHours > 0 ? (
                      <Trans>Nog geen losse urenregels; totaal komt uit afgeronde taken.</Trans>
                    ) : (
                      <Trans>Nog geen uren geboekt op dit project.</Trans>
                    )}
                  </p>
                ) : (
                  <div className="data-table-wrap">
                    <table className="data-table project-hours-table">
                      <thead>
                        <tr>
                          <th className="data-table-col-date"><Trans>Datum</Trans></th>
                          <th className="data-table-col-task"><Trans>Taak</Trans></th>
                          <th className="data-table-col-comment data-table-muted"><Trans>Toelichting</Trans></th>
                          <th className="data-table-col-developer"><Trans>Developer</Trans></th>
                          <th className="data-table-num"><Trans>Uren</Trans></th>
                        </tr>
                      </thead>
                      <tbody>
                        {timeEntries.map((entry) => (
                          <tr key={entry.$id}>
                            <td>{entry.workedDate.slice(0, 10)}</td>
                            <td>{taskTitleById.get(entry.taskId) ?? entry.taskId}</td>
                            <td className="data-table-muted">{entry.comment?.trim() || '—'}</td>
                            <td>{developerById.get(entry.userId)?.displayName ?? entry.userId}</td>
                            <td className="data-table-num">
                              {(entry.hours ?? 0) % 1 === 0
                                ? entry.hours
                                : (entry.hours ?? 0).toFixed(2)}{' '}
                              u
                              {canEditEntry(entry) && (
                                <div className="data-table-actions">
                                  <button
                                    type="button"
                                    className="icon-button"
                                    title={t`Uren bewerken`}
                                    onClick={() => setEditingEntry(entry)}
                                  >
                                    <IconEdit />
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="data-table-total">
                          <td colSpan={4}><Trans>Totaal</Trans></td>
                          <td className="data-table-num">
                            {workedHours % 1 === 0 ? workedHours : workedHours.toFixed(2)} u
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </section>
            )}

            {activeTab === 'discussion' && (
              <DiscussionBoard
                companyId={company.$id}
                projectId={project.$id}
                teamId={company.teamId}
                role={role}
                assigneeUserIds={assigneeUserIds}
              />
            )}

            {activeTab === 'files' && (
              <ProjectFileManager
                companyId={company.$id}
                projectId={project.$id}
                teamId={company.teamId}
                canDelete={role === 'admin' || role === 'developer'}
              />
            )}
          </div>

          <ProjectSidebar
            companyId={company.$id}
            teamId={company.teamId}
            userId={user.$id}
            project={project}
            role={role}
            onOpenDiscussionTab={() => setActiveTab('discussion')}
            onOpenFilesTab={() => setActiveTab('files')}
          />
        </div>
      </div>

      {editingEntry && taskById.get(editingEntry.taskId) && (
        <LogHoursDialog
          companyId={company.$id}
          teamId={company.teamId}
          task={taskById.get(editingEntry.taskId)!}
          entry={editingEntry}
          onClose={() => setEditingEntry(null)}
        />
      )}
    </div>
  );
}
