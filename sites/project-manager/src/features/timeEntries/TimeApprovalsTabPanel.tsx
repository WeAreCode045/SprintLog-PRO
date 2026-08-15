import { useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Trans, useLingui } from '@lingui/react/macro';
import type { PortalContext } from '../../layouts/PortalLayout';
import type { TaskRow, TimeEntryRow } from '../../appwrite/types';
import { IconChevronDown, IconCheck } from '../../components/icons';
import { useDeveloperProfiles } from '../profiles/hooks';
import { useTasksForCompanies } from '../tasks/hooks';
import { useApproveTimeEntries, useTimeEntriesForCompanies } from './hooks';
import { entryNeedsApproval } from './timeEntryBilling';
import { formatHours } from '../../lib/formatHours';

/** No upper bound on how far back approvable hours can go — a task can run for months
 * before a client gets around to approving it. Wide static window stands in for "all time". */
function approvalsDateRange() {
  const end = new Date();
  end.setDate(end.getDate() + 1);
  const start = new Date(end);
  start.setFullYear(start.getFullYear() - 3);
  return { start, end };
}

export function TimeApprovalsTabPanel() {
  const { t } = useLingui();
  const { role, enabledCompanyIds, companyById } = useOutletContext<PortalContext>();
  const range = useMemo(approvalsDateRange, []);

  const { data: tasks = [] } = useTasksForCompanies(enabledCompanyIds, 'all');
  const { data: entries = [], isLoading } = useTimeEntriesForCompanies(enabledCompanyIds, range);
  const { data: developers = [] } = useDeveloperProfiles(true);
  const approveEntries = useApproveTimeEntries();
  const [expandedRowIds, setExpandedRowIds] = useState<Set<string>>(new Set());

  function toggleRowExpanded(entryId: string) {
    setExpandedRowIds((prev) => {
      const next = new Set(prev);
      if (next.has(entryId)) next.delete(entryId);
      else next.add(entryId);
      return next;
    });
  }

  const taskById = useMemo(() => new Map(tasks.map((task) => [task.$id, task])), [tasks]);
  const developerById = useMemo(
    () => new Map(developers.map((profile) => [profile.userId, profile])),
    [developers],
  );

  function developerName(userId: string) {
    return developerById.get(userId)?.displayName ?? userId;
  }

  function taskTitle(task: TaskRow | undefined, taskId: string) {
    return task?.title ?? taskId;
  }

  const pendingEntries = useMemo(
    () =>
      entries
        .filter((entry) => {
          if (!entryNeedsApproval(entry)) return false;
          const task = taskById.get(entry.taskId);
          return (task?.audience ?? 'internal') !== 'client';
        })
        .sort((a, b) => a.workedDate.localeCompare(b.workedDate)),
    [entries, taskById],
  );

  const pendingByCompany = useMemo(() => {
    const map = new Map<string, TimeEntryRow[]>();
    for (const entry of pendingEntries) {
      const list = map.get(entry.companyId) ?? [];
      list.push(entry);
      map.set(entry.companyId, list);
    }
    return map;
  }, [pendingEntries]);

  async function handleApprove(entryIds: string[], teamId: string) {
    await approveEntries.mutateAsync({ entryIds, teamId });
  }

  if (isLoading) {
    return <p><Trans>Laden…</Trans></p>;
  }

  const companiesWithActivity = enabledCompanyIds.filter(
    (companyId) => (pendingByCompany.get(companyId)?.length ?? 0) > 0,
  );

  if (companiesWithActivity.length === 0) {
    return <p className="empty-state"><Trans>Geen uren om te beoordelen.</Trans></p>;
  }

  return (
    <div className="report-cards time-reporting-cards">
      {companiesWithActivity.map((companyId) => {
        const company = companyById(companyId);
        const teamId = company?.teamId ?? '';
        const companyPending = pendingByCompany.get(companyId) ?? [];
        const canApprove = role === 'client';
        const allPendingIds = companyPending.map((entry) => entry.$id);

        return (
          <div className="report-card" key={companyId}>
            <div className="report-card-header">
              <h3>{company?.name ?? companyId}</h3>
              {canApprove && allPendingIds.length > 0 && (
                <button
                  type="button"
                  className="btn-accent"
                  disabled={approveEntries.isPending}
                  onClick={() => void handleApprove(allPendingIds, teamId)}
                >
                  <Trans>Alles goedkeuren</Trans>
                </button>
              )}
            </div>
            <div className="data-table-wrap">
              <table className="data-table report-hours-table data-table--collapsible">
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
                  {companyPending.map((entry) => {
                    const task = taskById.get(entry.taskId);
                    const expanded = expandedRowIds.has(entry.$id);
                    return (
                      <tr key={entry.$id} className={expanded ? 'data-table-row--expanded' : ''}>
                        <td>
                          <div className="data-table-title-cell">
                            <div className="data-table-title-row">
                              <span className="data-table-title-button">{entry.workedDate.slice(0, 10)}</span>
                              <span className="data-table-muted">{taskTitle(task, entry.taskId)}</span>
                            </div>
                            <button
                              type="button"
                              className="data-table-expand-toggle"
                              title={expanded ? t`Minder tonen` : t`Meer tonen`}
                              aria-label={expanded ? t`Minder tonen` : t`Meer tonen`}
                              onClick={() => toggleRowExpanded(entry.$id)}
                            >
                              <IconChevronDown />
                            </button>
                          </div>
                        </td>
                        <td data-label={t`Taak`}>{taskTitle(task, entry.taskId)}</td>
                        <td className="data-table-muted" data-label={t`Toelichting`}>{entry.comment?.trim() || '—'}</td>
                        <td data-label={t`Developer`}>{developerName(entry.userId)}</td>
                        <td className="data-table-num" data-label={t`Uren`}>
                          {formatHours(entry.hours ?? 0)}
                          {canApprove && (
                            <div className="data-table-actions">
                              <button
                                type="button"
                                className="icon-button"
                                title={t`Goedkeuren`}
                                disabled={approveEntries.isPending}
                                onClick={() => void handleApprove([entry.$id], teamId)}
                              >
                                <IconCheck />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}
