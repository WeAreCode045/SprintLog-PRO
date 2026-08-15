import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Trans } from '@lingui/react/macro';
import {
  FileUp,
  Building2,
  Clock,
  ClockAlert,
  Sparkles,
  ArrowUpRight,
} from 'lucide-react';
import type { TaskRow, TimeEntryRow, CompanyRow, ProjectRow } from '../../appwrite/types';
import { entryNeedsApproval } from '../timeEntries/timeEntryBilling';
import { formatHours } from '../../lib/formatHours';

interface ClientBottomCardsProps {
  tasks: TaskRow[];
  entries: TimeEntryRow[];
  projects: ProjectRow[];
  companyById: (companyId: string) => CompanyRow | undefined;
}

export function ClientBottomCards({
  tasks,
  entries,
  projects,
  companyById,
}: ClientBottomCardsProps) {
  const projectNameById = useMemo(
    () => new Map(projects.map((p) => [p.$id, p.name])),
    [projects],
  );

  // 1. Follow up Actions: Task requests
  const requestedTasks = useMemo(() => {
    return tasks.filter((t) => t.status === 'requested');
  }, [tasks]);

  // 2. File requests
  const fileRequestTasks = useMemo(() => {
    return tasks.filter((t) => t.requiresFileUpload && t.status !== 'finished');
  }, [tasks]);

  // 3. Hours waiting for client approval
  const pendingHoursByProject = useMemo(() => {
    const map = new Map<string, { companyId: string; hours: number; entryCount: number }>();
    for (const entry of entries) {
      if (entryNeedsApproval(entry)) {
        const projectId = entry.projectId || 'other';
        const current = map.get(projectId) ?? { companyId: entry.companyId, hours: 0, entryCount: 0 };
        current.hours += entry.hours ?? 0;
        current.entryCount += 1;
        map.set(projectId, current);
      }
    }
    return [...map.entries()].map(([projectId, data]) => ({
      projectId,
      projectName: (projectId !== 'other' && projectNameById.get(projectId)) || 'Algemeen',
      companyName: companyById(data.companyId)?.name || 'Klant',
      hours: Math.round(data.hours * 100) / 100,
      entryCount: data.entryCount,
    }));
  }, [entries, projectNameById, companyById]);

  const totalPendingHours = useMemo(() => {
    return pendingHoursByProject.reduce((sum, item) => sum + item.hours, 0);
  }, [pendingHoursByProject]);

  return (
    <div className="admin-bottom-cards-grid">
      {/* 1. Actie Vereist (Task Requests) */}
      <div className="admin-bottom-card admin-action-block">
        <div className="admin-bottom-card-header admin-action-block-header">
          <div className="admin-action-title">
            <span className="admin-action-badge-icon admin-action-badge--accent">
              <Sparkles size={15} />
            </span>
            <h4><Trans>Actie Vereist</Trans></h4>
          </div>
          {requestedTasks.length > 0 && (
            <span className="admin-action-count-pill accent">
              {requestedTasks.length}
            </span>
          )}
        </div>

        <div className="admin-bottom-card-body admin-action-block-body">
          {requestedTasks.length === 0 ? (
            <p className="admin-action-empty">
              <Trans>Geen openstaande taakaanvragen.</Trans>
            </p>
          ) : (
            <div className="admin-action-list">
              {requestedTasks.map((task) => {
                const companyName = companyById(task.companyId)?.name;
                return (
                  <div key={task.$id} className="admin-action-card">
                    <div className="admin-action-card-header">
                      <Link to={`/app/tasks/${task.$id}`} className="admin-action-card-title">
                        {task.title}
                      </Link>
                    </div>
                    <div className="admin-action-card-meta">
                      {companyName && (
                        <span className="admin-meta-company">
                          <Building2 size={11} /> {companyName}
                        </span>
                      )}
                      <span className="admin-meta-project">
                        {projectNameById.get(task.projectId) || 'Project'}
                      </span>
                    </div>
                    <div className="admin-action-card-footer">
                      <span className="admin-compact-tag sidebar">
                        <Trans>In aanvraag</Trans>
                      </span>
                      <Link to={`/app/tasks/${task.$id}`} className="admin-details-link">
                        <Trans>Bekijken</Trans> <ArrowUpRight size={12} />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 2. File Requests */}
      <div className="admin-bottom-card admin-action-block">
        <div className="admin-bottom-card-header admin-action-block-header">
          <div className="admin-action-title">
            <span className="admin-action-badge-icon admin-action-badge--sidebar">
              <FileUp size={15} />
            </span>
            <h4><Trans>Bestandsaanvragen</Trans></h4>
          </div>
          {fileRequestTasks.length > 0 && (
            <span className="admin-action-count-pill sidebar">
              {fileRequestTasks.length}
            </span>
          )}
        </div>

        <div className="admin-bottom-card-body admin-action-block-body">
          {fileRequestTasks.length === 0 ? (
            <p className="admin-action-empty">
              <Trans>Geen openstaande bestandsaanvragen.</Trans>
            </p>
          ) : (
            <div className="admin-action-list">
              {fileRequestTasks.map((task) => (
                <Link
                  key={task.$id}
                  to={`/app/tasks/${task.$id}`}
                  className="admin-action-item-compact"
                >
                  <div className="admin-compact-info">
                    <span className="admin-compact-title">{task.title}</span>
                    <span className="admin-compact-sub">
                      {projectNameById.get(task.projectId) || 'Project'}
                    </span>
                  </div>
                  <span className="admin-compact-tag sidebar">
                    <Trans>Wacht op upload</Trans>
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 3. Hours Waiting for Approval (Replaces Goedgekeurd ter facturatie) */}
      <div className="admin-bottom-card admin-action-block">
        <div className="admin-bottom-card-header admin-action-block-header">
          <div className="admin-action-title">
            <span className="admin-action-badge-icon admin-action-badge--accent">
              <ClockAlert size={15} />
            </span>
            <h4><Trans>Wacht op goedkeuring</Trans></h4>
          </div>
          {totalPendingHours > 0 && (
            <span className="admin-action-count-pill accent">
              {formatHours(totalPendingHours)}
            </span>
          )}
        </div>

        <div className="admin-bottom-card-body admin-action-block-body">
          {pendingHoursByProject.length === 0 ? (
            <p className="admin-action-empty">
              <Trans>Geen uren die goedkeuring nodig hebben.</Trans>
            </p>
          ) : (
            <div className="admin-action-list">
              {pendingHoursByProject.map((item) => (
                <div key={item.projectId} className="admin-action-billing-row">
                  <div className="admin-billing-info">
                    <span className="admin-billing-company">{item.projectName}</span>
                    <span className="admin-billing-hours">
                      <Clock size={11} /> {formatHours(item.hours)} · {item.entryCount} {item.entryCount === 1 ? 'registratie' : 'registraties'}
                    </span>
                  </div>
                  <div className="admin-billing-actions">
                    <Link
                      to="/app/reports?tab=approvals"
                      className="admin-billing-btn"
                      title="Uren goedkeuren"
                    >
                      <Trans>Goedkeuren</Trans>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
