import { useMemo, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { Trans, useLingui } from '@lingui/react/macro';
import dayjs from 'dayjs';
import { isStaffRole } from '../../auth/RequireStaff';
import { ClockCheck, Plus } from 'lucide-react';
import { IconChevronDown, IconCheck, IconLockOpen } from '../../components/icons';
import { PageHeader } from '../../components/PageHeader';
import { PageBreadcrumb } from '../../components/PageBreadcrumb';
import type { PortalContext } from '../../layouts/PortalLayout';
import type { ProjectStatus } from '../../appwrite/types';
import { CompanyScopeControl } from '../companies/CompanyScopeControl';
import { useTasksForCompanies } from '../tasks/hooks';
import { useTimeEntriesForCompanies } from '../timeEntries/hooks';
import { formatHours } from '../../lib/formatHours';
import { CheckboxFilterDropdown } from '../../components/CheckboxFilterDropdown';
import { useProjectsForCompanies, useSetProjectStatus } from './hooks';
import { NewProjectDialog } from './NewProjectDialog';

type ProjectSortKey = 'name' | 'company' | 'status' | 'tasks' | 'hours' | 'date';
type SortDir = 'asc' | 'desc';

const PROJECT_STATUS_OPTIONS: ProjectStatus[] = ['active', 'on_hold', 'completed', 'archived'];

function SortableHeader({
  label,
  column,
  sortKey,
  sortDir,
  onSort,
  className,
}: {
  label: React.ReactNode;
  column: ProjectSortKey;
  sortKey: ProjectSortKey;
  sortDir: SortDir;
  onSort: (column: ProjectSortKey) => void;
  className?: string;
}) {
  const active = sortKey === column;
  return (
    <th className={className}>
      <button
        type="button"
        className={`data-table-sort ${active ? 'data-table-sort--active' : ''}`}
        onClick={() => onSort(column)}
      >
        <span>{label}</span>
        <span className="data-table-sort-indicator" aria-hidden>
          {active ? (sortDir === 'asc' ? '↑' : '↓') : ''}
        </span>
      </button>
    </th>
  );
}

/** No upper bound on how far back a project's hours/tasks can go — wide static window
 * stands in for "all time" (same approach as the Time Approvals tab). */
function allTimeRange() {
  const end = new Date();
  end.setDate(end.getDate() + 1);
  const start = new Date(end);
  start.setFullYear(start.getFullYear() - 3);
  return { start, end };
}

export function ProjectsListPage() {
  const { t } = useLingui();
  const { role, enabledCompanyIds, companyById, isMultiCompany } =
    useOutletContext<PortalContext>();
  const { data: projects = [], isLoading } = useProjectsForCompanies(enabledCompanyIds);
  const range = useMemo(allTimeRange, []);
  const { data: tasks = [] } = useTasksForCompanies(enabledCompanyIds, 'all');
  const { data: timeEntries = [] } = useTimeEntriesForCompanies(enabledCompanyIds, range);
  const [excludedCompanyIds, setExcludedCompanyIds] = useState<Set<string>>(new Set());
  const [excludedStatuses, setExcludedStatuses] = useState<Set<ProjectStatus>>(
    new Set<ProjectStatus>(['on_hold', 'archived']),
  );
  const [sortKey, setSortKey] = useState<ProjectSortKey>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);
  const [expandedRowIds, setExpandedRowIds] = useState<Set<string>>(new Set());

  function toggleRowExpanded(projectId: string) {
    setExpandedRowIds((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) next.delete(projectId);
      else next.add(projectId);
      return next;
    });
  }

  const setProjectStatus = useSetProjectStatus();

  const projectCompanyIds = useMemo(() => new Set(projects.map((p) => p.companyId)), [projects]);
  const companyFilterOptions = useMemo(
    () =>
      enabledCompanyIds
        .filter((id) => projectCompanyIds.has(id))
        .map((id) => ({ id, label: companyById(id)?.name ?? id })),
    [enabledCompanyIds, projectCompanyIds, companyById],
  );

  const projectStatuses = useMemo(() => new Set(projects.map((p) => p.status ?? 'active')), [projects]);
  const statusFilterOptions = useMemo(
    () =>
      PROJECT_STATUS_OPTIONS.filter((status) => projectStatuses.has(status)).map((status) => ({
        id: status,
        label: statusLabel(status),
      })),
    [projectStatuses, statusLabel],
  );

  const staff = isStaffRole(role);

  const statsByProjectId = useMemo(() => {
    const map = new Map<
      string,
      { openTasks: number; completedTasks: number; approvedHours: number; pendingHours: number }
    >();
    function statFor(projectId: string) {
      let entry = map.get(projectId);
      if (!entry) {
        entry = { openTasks: 0, completedTasks: 0, approvedHours: 0, pendingHours: 0 };
        map.set(projectId, entry);
      }
      return entry;
    }
    for (const task of tasks) {
      const stat = statFor(task.projectId);
      if (task.status === 'open' || task.status === 'requested') stat.openTasks += 1;
      else if (task.status === 'finished') stat.completedTasks += 1;
    }
    for (const entry of timeEntries) {
      const stat = statFor(entry.projectId);
      if (entry.freeOfCharge) continue;
      if (entry.approved) stat.approvedHours += entry.hours ?? 0;
      else stat.pendingHours += entry.hours ?? 0;
    }
    return map;
  }, [tasks, timeEntries]);

  function statsFor(projectId: string) {
    return statsByProjectId.get(projectId) ?? {
      openTasks: 0,
      completedTasks: 0,
      approvedHours: 0,
      pendingHours: 0,
    };
  }

  async function handleCloseProject(projectId: string) {
    await setProjectStatus.mutateAsync({ projectId, status: 'completed' });
  }

  async function handleReopenProject(projectId: string) {
    await setProjectStatus.mutateAsync({ projectId, status: 'active' });
  }

  function handleSort(column: ProjectSortKey) {
    if (sortKey !== column) {
      setSortKey(column);
      setSortDir(column === 'date' || column === 'hours' || column === 'tasks' ? 'desc' : 'asc');
      return;
    }
    setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
  }

  function statusLabel(status: ProjectStatus) {
    switch (status) {
      case 'active':
        return t`Actief`;
      case 'on_hold':
        return t`In de wacht`;
      case 'completed':
        return t`Voltooid`;
      case 'archived':
        return t`Gearchiveerd`;
      default: {
        const _exhaustive: never = status;
        return _exhaustive;
      }
    }
  }

  const sortedProjects = useMemo(() => {
    const filtered = projects.filter((project) => {
      if (excludedCompanyIds.has(project.companyId)) return false;
      if (excludedStatuses.has(project.status ?? 'active')) return false;
      return true;
    });

    return filtered.slice().sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'name':
          cmp = a.name.localeCompare(b.name, 'nl');
          break;
        case 'company':
          cmp = (companyById(a.companyId)?.name ?? a.companyId).localeCompare(
            companyById(b.companyId)?.name ?? b.companyId,
            'nl',
          );
          break;
        case 'status': {
          const statusA = a.status ?? 'active';
          const statusB = b.status ?? 'active';
          cmp = statusLabel(statusA).localeCompare(statusLabel(statusB), 'nl');
          break;
        }
        case 'tasks': {
          const statsA = statsFor(a.$id);
          const statsB = statsFor(b.$id);
          cmp = (statsA.openTasks + statsA.completedTasks) - (statsB.openTasks + statsB.completedTasks);
          break;
        }
        case 'hours': {
          const statsA = statsFor(a.$id);
          const statsB = statsFor(b.$id);
          cmp = (statsA.approvedHours + statsA.pendingHours) - (statsB.approvedHours + statsB.pendingHours);
          break;
        }
        case 'date':
          cmp = a.$createdAt.localeCompare(b.$createdAt);
          break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [projects, excludedCompanyIds, excludedStatuses, sortKey, sortDir, companyById, statsByProjectId]);

  return (
    <div className="content-card">
      <div className="content-inner">
        <PageHeader
          title={<Trans>Projecten</Trans>}
          description={<Trans>Alle projecten van je geselecteerde bedrijven.</Trans>}
          breadcrumb={
            <PageBreadcrumb
              items={[{ label: t`Dashboard`, to: '/app/dashboard' }, { label: t`Projecten` }]}
            />
          }
          actions={
            <>
              <CompanyScopeControl />
              {staff && (
                <button
                  type="button"
                  className="btn-accent"
                  onClick={() => setShowNewProjectModal(true)}
                >
                  <Plus size={16} /> <Trans>Nieuw project</Trans>
                </button>
              )}
            </>
          }
        />

        <div className="filter-bar">
          <div className="filter-group">
            {companyFilterOptions.length > 1 && (
              <label>
                <span><Trans>Bedrijf</Trans></span>
                <CheckboxFilterDropdown
                  options={companyFilterOptions}
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
                  onSelectNone={() => setExcludedCompanyIds(new Set(companyFilterOptions.map((c) => c.id)))}
                  labelPlural={t`bedrijven`}
                />
              </label>
            )}
            {statusFilterOptions.length > 1 && (
              <label>
                <span><Trans>Status</Trans></span>
                <CheckboxFilterDropdown
                  options={statusFilterOptions}
                  excludedIds={excludedStatuses}
                  onToggle={(status) =>
                    setExcludedStatuses((prev) => {
                      const next = new Set(prev);
                      if (next.has(status)) next.delete(status);
                      else next.add(status);
                      return next;
                    })
                  }
                  onSelectAll={() => setExcludedStatuses(new Set())}
                  onSelectNone={() => setExcludedStatuses(new Set(statusFilterOptions.map((s) => s.id)))}
                  labelPlural={t`statussen`}
                />
              </label>
            )}
          </div>
        </div>

        {isLoading && <p><Trans>Laden…</Trans></p>}
        {!isLoading && sortedProjects.length === 0 && <p className="empty-state"><Trans>Geen projecten.</Trans></p>}

        {!isLoading && sortedProjects.length > 0 && (
          <div className="data-table-wrap">
            <table className="data-table projects-list-table data-table--collapsible">
              <thead>
                <tr>
                  <SortableHeader
                    label={<Trans>Naam</Trans>}
                    column="name"
                    sortKey={sortKey}
                    sortDir={sortDir}
                    onSort={handleSort}
                    className="data-table-col-name"
                  />
                  {isMultiCompany && (
                    <SortableHeader
                      label={<Trans>Bedrijf</Trans>}
                      column="company"
                      sortKey={sortKey}
                      sortDir={sortDir}
                      onSort={handleSort}
                    />
                  )}
                  <SortableHeader
                    label={<Trans>Status</Trans>}
                    column="status"
                    sortKey={sortKey}
                    sortDir={sortDir}
                    onSort={handleSort}
                  />
                  <SortableHeader
                    label={<Trans>Taken</Trans>}
                    column="tasks"
                    sortKey={sortKey}
                    sortDir={sortDir}
                    onSort={handleSort}
                    className="data-table-muted"
                  />
                  <SortableHeader
                    label={<Trans>Uren</Trans>}
                    column="hours"
                    sortKey={sortKey}
                    sortDir={sortDir}
                    onSort={handleSort}
                    className="data-table-muted data-table-col-hours"
                  />
                  <SortableHeader
                    label={<Trans>Startdatum</Trans>}
                    column="date"
                    sortKey={sortKey}
                    sortDir={sortDir}
                    onSort={handleSort}
                  />
                </tr>
              </thead>
              <tbody>
                {sortedProjects.map((project) => {
                  const status = project.status ?? 'active';
                  const stats = statsFor(project.$id);
                  const expanded = expandedRowIds.has(project.$id);
                  return (
                    <tr key={project.$id} className={expanded ? 'data-table-row--expanded' : ''}>
                      <td>
                        <div className="data-table-title-cell">
                          <Link className="data-table-title-button" to={`/app/projects/${project.$id}`}>
                            {project.name}
                          </Link>
                          <button
                            type="button"
                            className="data-table-expand-toggle"
                            title={expanded ? t`Minder tonen` : t`Meer tonen`}
                            aria-label={expanded ? t`Minder tonen` : t`Meer tonen`}
                            onClick={() => toggleRowExpanded(project.$id)}
                          >
                            <IconChevronDown />
                          </button>
                        </div>
                      </td>
                      {isMultiCompany && (
                        <td className="data-table-muted" data-label={t`Bedrijf`}>{companyById(project.companyId)?.name ?? '—'}</td>
                      )}
                      <td data-label={t`Status`}>
                        <span className={`badge badge-status badge-status--${status}`}>
                          {statusLabel(status)}
                        </span>
                      </td>
                      <td className="data-table-muted" data-label={t`Taken`}>
                        <Link className="project-stat-link" to={`/app/projects/${project.$id}`}>
                          <Trans>
                            <span className="project-stat-figure">{stats.openTasks}</span> open ·{' '}
                            <span className="project-stat-figure">{stats.completedTasks}</span> voltooid
                          </Trans>
                        </Link>
                      </td>
                      <td className="data-table-muted data-table-col-hours" data-label={t`Uren`}>
                        <Link className="project-stat-link" to="/app/reports">
                          <span className="project-stat-figure">
                            {formatHours(stats.approvedHours + stats.pendingHours)}
                          </span>
                        </Link>
                      </td>
                      <td className="data-table-muted" data-label={t`Startdatum`}>
                        {dayjs(project.$createdAt).format('D MMM YYYY')}
                        {(staff || stats.pendingHours > 0) && (
                          <div className="data-table-actions">
                            {staff && (
                              status === 'completed' ? (
                                <button
                                  type="button"
                                  className="icon-button"
                                  title={t`Heropenen`}
                                  disabled={setProjectStatus.isPending}
                                  onClick={() => void handleReopenProject(project.$id)}
                                >
                                  <IconLockOpen />
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  className="icon-button"
                                  title={t`Project afsluiten`}
                                  disabled={setProjectStatus.isPending}
                                  onClick={() => void handleCloseProject(project.$id)}
                                >
                                  <IconCheck />
                                </button>
                              )
                            )}
                            {stats.pendingHours > 0 && (
                              <Link
                                className="icon-button project-hours-pending-icon"
                                to="/app/reports?tab=approvals"
                                title={t`Bevat niet-goedgekeurde uren`}
                                aria-label={t`Bevat niet-goedgekeurde uren`}
                              >
                                <ClockCheck size={16} />
                              </Link>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showNewProjectModal && (
        <NewProjectDialog
          enabledCompanyIds={enabledCompanyIds}
          companyById={companyById}
          onClose={() => setShowNewProjectModal(false)}
        />
      )}
    </div>
  );
}
