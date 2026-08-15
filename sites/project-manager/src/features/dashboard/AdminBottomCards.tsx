import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Trans } from '@lingui/react/macro';
import {
  Check,
  FileUp,
  Receipt,
  Building2,
  Clock,
  Sparkles,
  ArrowUpRight,
} from 'lucide-react';
import type { TaskRow, TimeEntryRow, CompanyRow, ProjectRow } from '../../appwrite/types';
import { useAcceptRequestedTask } from '../tasks/hooks';
import { formatHours } from '../../lib/formatHours';

interface AdminBottomCardsProps {
  tasks: TaskRow[];
  entries: TimeEntryRow[];
  projects: ProjectRow[];
  companyById: (companyId: string) => CompanyRow | undefined;
  primaryCompanyId: string;
}

export function AdminBottomCards({
  tasks,
  entries,
  projects,
  companyById,
  primaryCompanyId,
}: AdminBottomCardsProps) {
  const acceptTaskMutation = useAcceptRequestedTask(primaryCompanyId);
  const [approvingTaskId, setApprovingTaskId] = useState<string | null>(null);

  const projectNameById = useMemo(
    () => new Map(projects.map((p) => [p.$id, p.name])),
    [projects],
  );

  // 1. Follow up Actions: Task requests to approve
  const requestedTasks = useMemo(() => {
    return tasks.filter((t) => t.status === 'requested');
  }, [tasks]);

  // 2. File requests
  const fileRequestTasks = useMemo(() => {
    return tasks.filter((t) => t.requiresFileUpload && t.status !== 'finished');
  }, [tasks]);

  // 3. Approved Hours to invoice (unbilled approved hours)
  const unbilledHoursByCompany = useMemo(() => {
    const map = new Map<string, { hours: number; entryCount: number }>();
    for (const entry of entries) {
      if (entry.approved && !entry.freeOfCharge && !entry.invoiced) {
        const current = map.get(entry.companyId) ?? { hours: 0, entryCount: 0 };
        current.hours += entry.hours ?? 0;
        current.entryCount += 1;
        map.set(entry.companyId, current);
      }
    }
    return [...map.entries()].map(([companyId, data]) => ({
      companyId,
      companyName: companyById(companyId)?.name || 'Klant',
      hours: Math.round(data.hours * 100) / 100,
      entryCount: data.entryCount,
      rate: Number(companyById(companyId)?.hourlyRate) || 85,
    }));
  }, [entries, companyById]);

  const totalUnbilledHours = useMemo(() => {
    return unbilledHoursByCompany.reduce((sum, item) => sum + item.hours, 0);
  }, [unbilledHoursByCompany]);

  async function handleApprove(e: React.MouseEvent, task: TaskRow) {
    e.preventDefault();
    e.stopPropagation();
    setApprovingTaskId(task.$id);
    try {
      const comp = companyById(task.companyId);
      const teamId = comp?.teamId || '';
      await acceptTaskMutation.mutateAsync({
        taskId: task.$id,
        teamId,
        companyId: task.companyId,
        createdBy: task.createdBy,
        assigneeIds: task.assigneeIds,
      });
    } catch {
      // ignore
    } finally {
      setApprovingTaskId(null);
    }
  }

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
                const isApproving = approvingTaskId === task.$id;
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
                      <button
                        type="button"
                        className="admin-approve-btn"
                        onClick={(e) => void handleApprove(e, task)}
                        disabled={isApproving}
                      >
                        <Check size={13} />
                        {isApproving ? <Trans>Goedkeuren…</Trans> : <Trans>Goedkeuren</Trans>}
                      </button>
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

      {/* 3. Approved Hours to Invoice */}
      <div className="admin-bottom-card admin-action-block">
        <div className="admin-bottom-card-header admin-action-block-header">
          <div className="admin-action-title">
            <span className="admin-action-badge-icon admin-action-badge--accent">
              <Receipt size={15} />
            </span>
            <h4><Trans>Goedgekeurd ter facturatie</Trans></h4>
          </div>
          {totalUnbilledHours > 0 && (
            <span className="admin-action-count-pill accent">
              {formatHours(totalUnbilledHours)}
            </span>
          )}
        </div>

        <div className="admin-bottom-card-body admin-action-block-body">
          {unbilledHoursByCompany.length === 0 ? (
            <p className="admin-action-empty">
              <Trans>Geen goedgekeurde uren te factureren.</Trans>
            </p>
          ) : (
            <div className="admin-action-list">
              {unbilledHoursByCompany.map((item) => (
                <div key={item.companyId} className="admin-action-billing-row">
                  <div className="admin-billing-info">
                    <span className="admin-billing-company">{item.companyName}</span>
                    <span className="admin-billing-hours">
                      <Clock size={11} /> {formatHours(item.hours)} · {item.entryCount} {item.entryCount === 1 ? 'registratie' : 'registraties'}
                    </span>
                  </div>
                  <div className="admin-billing-actions">
                    <span className="admin-billing-val">
                      € {Math.round(item.hours * item.rate).toLocaleString('nl-NL')}
                    </span>
                    <Link
                      to={`/app/invoices/new?companyId=${item.companyId}`}
                      className="admin-billing-btn"
                      title="Nieuwe factuur aanmaken"
                    >
                      <Trans>Factureren</Trans>
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
