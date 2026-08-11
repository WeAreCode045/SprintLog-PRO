import { useMemo, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { Download, Receipt } from 'lucide-react';
import { Trans, useLingui } from '@lingui/react/macro';
import { t as staticT } from '@lingui/core/macro';
import { getDateRange, type DateRangePreset } from '../../lib/dateRanges';
import { CheckboxFilterDropdown } from '../../components/CheckboxFilterDropdown';
import { ProjectFilterDropdown } from '../../components/ProjectFilterDropdown';
import { IconEdit } from '../../components/icons';
import { isStaffRole } from '../../auth/RequireStaff';
import { useProjectsForCompanies } from '../projects/hooks';
import { useTasksForCompanies } from '../tasks/hooks';
import { LogHoursDialog } from '../timeEntries/LogHoursDialog';
import { UnlockTimeEntriesDialog } from '../timeEntries/UnlockTimeEntriesDialog';
import { useTimeEntriesForCompanies } from '../timeEntries/hooks';
import { useDeveloperProfiles } from '../profiles/hooks';
import type { ResolvedRole, ProjectRow, TimeEntryRow } from '../../appwrite/types';
import type { PortalContext } from '../../layouts/PortalLayout';
import { formatHours } from '../../lib/formatHours';

/** Where an approved/invoiced hour's status icon should link to, by role — straight to the
 * specific invoice it was billed on, not just the overview list. Developers have no
 * invoices view at all, so they get a static indicator only. */
function invoiceLinkFor(role: ResolvedRole, invoiceId: string | null | undefined) {
  if (!invoiceId) return null;
  if (role === 'admin') return `/app/invoices/${invoiceId}`;
  if (role === 'client') return `/app/my-invoices/${invoiceId}`;
  return null;
}

const PRESETS: DateRangePreset[] = ['today', 'thisWeek', 'thisMonth', 'pastMonth', 'custom'];

function dateRangeLabel(preset: DateRangePreset) {
  switch (preset) {
    case 'today':
      return staticT`Vandaag`;
    case 'thisWeek':
      return staticT`Deze week`;
    case 'thisMonth':
      return staticT`Deze maand`;
    case 'pastMonth':
      return staticT`Vorige maand`;
    case 'custom':
      return staticT`Aangepast`;
    default: {
      const _exhaustive: never = preset;
      return _exhaustive;
    }
  }
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function escapeCsvCell(value: string) {
  if (value.includes('"') || value.includes(',') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function downloadCsv(filename: string, rows: string[][]) {
  const content = rows.map((row) => row.map(escapeCsvCell).join(',')).join('\n');
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function ProjectEntriesCard({
  project,
  role,
  entries,
  taskTitle,
  developerName,
  canEditEntry,
  onEditEntry,
  onUnlockEntry,
}: {
  project: ProjectRow;
  role: ResolvedRole;
  entries: TimeEntryRow[];
  taskTitle: (taskId: string) => string;
  developerName: (userId: string) => string;
  canEditEntry: (entry: TimeEntryRow) => boolean;
  onEditEntry: (entry: TimeEntryRow) => void;
  onUnlockEntry: (entry: TimeEntryRow) => void;
}) {
  const { t } = useLingui();
  const projectTotal = entries.reduce((sum, entry) => sum + (entry.hours ?? 0), 0);

  const sortedEntries = useMemo(
    () => entries.slice().sort((a, b) => a.workedDate.localeCompare(b.workedDate)),
    [entries],
  );

  function renderEntryActions(entry: TimeEntryRow) {
    return (
      <>
        {canEditEntry(entry) && (
          <button
            type="button"
            className="icon-button"
            title={t`Uren bewerken`}
            onClick={() => onEditEntry(entry)}
          >
            <IconEdit />
          </button>
        )}
        {entry.approved &&
          (() => {
            if (entry.invoiced) {
              const href = invoiceLinkFor(role, entry.invoiceId);
              return href ? (
                <Link className="icon-button" title={t`Gefactureerd — bekijk factuur`} to={href}>
                  <Receipt size={16} />
                </Link>
              ) : (
                <span className="icon-button icon-button--static" title={t`Gefactureerd`}>
                  <Receipt size={16} />
                </span>
              );
            }
            return role === 'admin' ? (
              <button
                type="button"
                className="icon-button"
                title={t`Goedgekeurd — klik om te deblokkeren`}
                onClick={() => onUnlockEntry(entry)}
              >
                <Receipt size={16} />
              </button>
            ) : (
              <span className="icon-button icon-button--static" title={t`Goedgekeurd`}>
                <Receipt size={16} />
              </span>
            );
          })()}
      </>
    );
  }

  return (
    <div className="report-card">
      <div className="report-card-header">
        <h3>{project.name}</h3>
        <span className="report-card-total">{formatHours(projectTotal)}</span>
      </div>

      {entries.length === 0 ? (
        <p className="empty-state"><Trans>Geen uren in deze periode.</Trans></p>
      ) : (
        <div className="data-table-wrap">
          <table className="data-table report-hours-table">
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
              {sortedEntries.map((entry) => (
                <tr key={entry.$id}>
                  <td>{entry.workedDate.slice(0, 10)}</td>
                  <td>{taskTitle(entry.taskId)}</td>
                  <td className="data-table-muted">{entry.comment?.trim() || '—'}</td>
                  <td>{developerName(entry.userId)}</td>
                  <td className="data-table-num">
                    {formatHours(entry.hours ?? 0)}
                    <div className="data-table-actions">{renderEntryActions(entry)}</div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="data-table-total">
                <td colSpan={4}><Trans>Project totaal</Trans></td>
                <td className="data-table-num">{formatHours(projectTotal)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

export function ReportsTabPanel() {
  const { t } = useLingui();
  const { role, enabledCompanyIds, companyById, isMultiCompany } =
    useOutletContext<PortalContext>();

  const [preset, setPreset] = useState<DateRangePreset>('thisMonth');
  const [customRange, setCustomRange] = useState({ start: todayIsoDate(), end: todayIsoDate() });
  const [excludedProjectIds, setExcludedProjectIds] = useState<Set<string>>(new Set());
  const [excludedCompanyIds, setExcludedCompanyIds] = useState<Set<string>>(new Set());
  const [excludedAssigneeIds, setExcludedAssigneeIds] = useState<Set<string>>(new Set());
  const [editingEntry, setEditingEntry] = useState<TimeEntryRow | null>(null);
  const [unlockingEntry, setUnlockingEntry] = useState<TimeEntryRow | null>(null);

  const range = useMemo(() => getDateRange(preset, customRange), [preset, customRange]);

  const { data: allProjects = [] } = useProjectsForCompanies(enabledCompanyIds);
  const { data: tasks = [] } = useTasksForCompanies(enabledCompanyIds, 'all');
  const { data: developers = [] } = useDeveloperProfiles(true);
  const taskTitleById = useMemo(() => new Map(tasks.map((task) => [task.$id, task.title])), [tasks]);
  const taskById = useMemo(() => new Map(tasks.map((task) => [task.$id, task])), [tasks]);
  const developerById = useMemo(
    () => new Map(developers.map((profile) => [profile.userId, profile])),
    [developers],
  );

  const projects = useMemo(() => {
    if (!isMultiCompany) return allProjects;
    return allProjects.filter((project) => !excludedCompanyIds.has(project.companyId));
  }, [allProjects, excludedCompanyIds, isMultiCompany]);

  function canEditEntry(entry: TimeEntryRow) {
    return isStaffRole(role) && !entry.approved;
  }

  const { data: entries = [], isLoading } = useTimeEntriesForCompanies(enabledCompanyIds, {
    start: range.start,
    end: range.end,
  });

  const entryCompanyIds = useMemo(() => new Set(entries.map((e) => e.companyId)), [entries]);
  const entryProjectIds = useMemo(() => new Set(entries.map((e) => e.projectId)), [entries]);
  const entryDeveloperIds = useMemo(() => new Set(entries.map((e) => e.userId)), [entries]);

  const companyFilterOptions = useMemo(
    () =>
      enabledCompanyIds
        .filter((id) => entryCompanyIds.has(id))
        .map((id) => ({ id, label: companyById(id)?.name ?? id })),
    [enabledCompanyIds, entryCompanyIds, companyById],
  );

  const projectFilterOptions = useMemo(
    () => projects.filter((project) => entryProjectIds.has(project.$id)),
    [projects, entryProjectIds],
  );

  const developerFilterOptions = useMemo(
    () =>
      developers
        .filter((profile) => entryDeveloperIds.has(profile.userId))
        .map((profile) => ({ id: profile.userId, label: profile.displayName })),
    [developers, entryDeveloperIds],
  );

  const filteredEntries = useMemo(
    () =>
      entries.filter((entry) => {
        if (excludedProjectIds.has(entry.projectId)) return false;
        if (isMultiCompany && excludedCompanyIds.has(entry.companyId)) {
          return false;
        }
        if (excludedAssigneeIds.has(entry.userId)) return false;
        return true;
      }),
    [entries, excludedProjectIds, excludedCompanyIds, excludedAssigneeIds, isMultiCompany],
  );

  const entriesByProject = useMemo(() => {
    const map = new Map<string, TimeEntryRow[]>();
    for (const entry of filteredEntries) {
      const list = map.get(entry.projectId) ?? [];
      list.push(entry);
      map.set(entry.projectId, list);
    }
    return map;
  }, [filteredEntries]);

  function toggleProject(projectId: string) {
    setExcludedProjectIds((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) next.delete(projectId);
      else next.add(projectId);
      return next;
    });
  }

  const visibleProjects = useMemo(() => {
    return projects.filter((project) => {
      if (excludedProjectIds.has(project.$id)) return false;
      const projectEntries = entriesByProject.get(project.$id);
      return projectEntries && projectEntries.length > 0;
    });
  }, [projects, excludedProjectIds, entriesByProject]);
  const grandTotal = filteredEntries.reduce((sum, entry) => sum + (entry.hours ?? 0), 0);

  const taskTitle = useMemo(() => {
    return (taskId: string) => taskTitleById.get(taskId) ?? taskId;
  }, [taskTitleById]);

  function developerName(userId: string) {
    return developerById.get(userId)?.displayName ?? userId;
  }

  function handleExportCsv() {
    const rows: string[][] = [
      isMultiCompany
        ? [t`Bedrijf`, t`Project`, t`Datum`, t`Developer`, t`Taak`, t`Toelichting`, t`Uren`]
        : [t`Project`, t`Datum`, t`Developer`, t`Taak`, t`Toelichting`, t`Uren`],
    ];
    for (const project of visibleProjects) {
      const projectEntries = entriesByProject.get(project.$id) ?? [];
      for (const entry of projectEntries) {
        const base = [
          project.name,
          entry.workedDate.slice(0, 10),
          developerName(entry.userId),
          taskTitle(entry.taskId),
          entry.comment?.trim() ?? '',
          String(entry.hours ?? 0),
        ];
        rows.push(
          isMultiCompany
            ? [companyById(project.companyId)?.name ?? project.companyId, ...base]
            : base,
        );
      }
      const projectTotal = projectEntries.reduce((sum, entry) => sum + (entry.hours ?? 0), 0);
      if (projectEntries.length > 0) {
        rows.push(
          isMultiCompany
            ? [companyById(project.companyId)?.name ?? '', project.name, '', '', '', t`Totaal`, String(projectTotal)]
            : [project.name, '', '', '', t`Totaal`, String(projectTotal)],
        );
      }
    }
    rows.push(
      isMultiCompany
        ? ['', '', '', '', '', t`Eindtotaal`, String(grandTotal)]
        : ['', '', '', '', t`Eindtotaal`, String(grandTotal)],
    );
    downloadCsv('time-report.csv', rows);
  }

  return (
    <>
      <div className="filter-bar">
        <div className="filter-group">
          {companyFilterOptions.length > 1 && (
            <label>
              <span><Trans>Bedrijf</Trans></span>
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
            </label>
          )}
          {projectFilterOptions.length > 1 && (
            <label>
              <span><Trans>Project</Trans></span>
              <ProjectFilterDropdown
                projects={projectFilterOptions}
                excludedIds={excludedProjectIds}
                onToggle={toggleProject}
                onSelectAll={() => setExcludedProjectIds(new Set())}
                onSelectNone={() => setExcludedProjectIds(new Set(projectFilterOptions.map((p) => p.$id)))}
              />
            </label>
          )}
          {developerFilterOptions.length > 1 && (
            <label>
              <span><Trans>Developer</Trans></span>
              <CheckboxFilterDropdown
                options={developerFilterOptions}
                excludedIds={excludedAssigneeIds}
                onToggle={(id) =>
                  setExcludedAssigneeIds((prev) => {
                    const next = new Set(prev);
                    if (next.has(id)) next.delete(id);
                    else next.add(id);
                    return next;
                  })
                }
                onSelectAll={() => setExcludedAssigneeIds(new Set())}
                onSelectNone={() => setExcludedAssigneeIds(new Set(developerFilterOptions.map((d) => d.id)))}
                labelPlural={t`developers`}
              />
            </label>
          )}
        </div>

        <div className="filter-group filter-group--end filter-group--export-above">
          <button
            type="button"
            className="btn-accent"
            onClick={handleExportCsv}
            disabled={isLoading}
          >
            <Download size={16} /> <Trans>CSV exporteren</Trans>
          </button>
          <div className="filter-group">
            <div className="filter-group view-toggle">
              {PRESETS.map((p) => (
                <button key={p} type="button" className={preset === p ? 'active' : ''} onClick={() => setPreset(p)}>
                  {dateRangeLabel(p)}
                </button>
              ))}
            </div>
            {preset === 'custom' && (
              <>
                <label>
                  <Trans>Van</Trans>
                  <input
                    type="date"
                    value={customRange.start}
                    onChange={(e) => setCustomRange({ ...customRange, start: e.target.value })}
                  />
                </label>
                <label>
                  <Trans>Tot</Trans>
                  <input
                    type="date"
                    value={customRange.end}
                    onChange={(e) => setCustomRange({ ...customRange, end: e.target.value })}
                  />
                </label>
              </>
            )}
          </div>
        </div>
      </div>

      {isLoading ? (
        <p><Trans>Laden…</Trans></p>
      ) : (
        <>
          <div className="report-cards time-reporting-cards">
            {visibleProjects.map((project) => (
              <ProjectEntriesCard
                key={project.$id}
                project={project}
                role={role}
                entries={entriesByProject.get(project.$id) ?? []}
                taskTitle={taskTitle}
                developerName={developerName}
                canEditEntry={canEditEntry}
                onEditEntry={setEditingEntry}
                onUnlockEntry={setUnlockingEntry}
              />
            ))}
            {visibleProjects.length === 0 && <p className="empty-state"><Trans>Geen projecten geselecteerd.</Trans></p>}
          </div>

          <div className="summary-bar report-grand-total">
            <span className="summary-label"><Trans>Totaal:</Trans></span>
            <span className="summary-value">{formatHours(grandTotal)}</span>
          </div>
        </>
      )}

      {editingEntry && taskById.get(editingEntry.taskId) && (
        <LogHoursDialog
          companyId={editingEntry.companyId}
          teamId={companyById(editingEntry.companyId)?.teamId ?? ''}
          task={taskById.get(editingEntry.taskId)!}
          entry={editingEntry}
          onClose={() => setEditingEntry(null)}
        />
      )}

      {unlockingEntry && (
        <UnlockTimeEntriesDialog
          entryIds={[unlockingEntry.$id]}
          teamId={companyById(unlockingEntry.companyId)?.teamId ?? ''}
          onClose={() => setUnlockingEntry(null)}
        />
      )}
    </>
  );
}
