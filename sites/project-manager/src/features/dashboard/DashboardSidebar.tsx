g import dayjs from 'dayjs';
import { Link } from 'react-router-dom';
import { AlertCircle, CalendarDays, Clock3, FolderKanban, ListTodo, MessageSquarePlus, MessagesSquare } from 'lucide-react';
import { Trans, useLingui } from '@lingui/react/macro';
import type { CompanyRow, ResolvedRole } from '../../appwrite/types';
import type { DashboardOverview } from './useDashboardOverview';
import { formatHours } from '../../lib/formatHours';

interface DashboardSidebarProps {
  role: ResolvedRole;
  overview: DashboardOverview;
  isMultiCompany: boolean;
  companyById: (companyId: string) => CompanyRow | undefined;
  reportsPath?: string;
}

/** The dark "right side box" companion — action-needed alerts, running projects, and
 * recent discussion activity. Shared by Dashboard, Projects, and Discussions so the app
 * chrome stays consistent across pages. */
export function DashboardSidebar({
  role,
  overview,
  isMultiCompany,
  companyById,
  reportsPath = '/app/reports',
}: DashboardSidebarProps) {
  const { t } = useLingui();
  const {
    staff,
    hoursToApprove,
    hoursToApproveByCompany,
    pendingRequestedTasks,
    projectStats,
    discussionFeed,
    weekHours,
    monthHours,
    projectNameById,
  } = overview;

  return (
    <aside className="client-dashboard-side">
      {role === 'client' && hoursToApprove > 0 && (
        <section className="report-card" style={{ background: 'var(--sidebar-bg)', color: '#fff', border: 'none', boxShadow: '0 4px 15px rgba(0,0,0,0.15)', overflow: 'hidden', borderRadius: '0.75rem' }}>
          <div className="report-card-header" style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-2))', borderBottom: 'none', color: '#fff', padding: '0.75rem 1rem' }}>
            <h3 style={{ color: '#fff', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0, fontSize: '0.85rem' }}>
              <AlertCircle size={15} /> <Trans>Actie vereist</Trans>
            </h3>
          </div>
          <div style={{ padding: '0.75rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <p style={{ margin: 0, color: 'color-mix(in srgb, #fff 90%, transparent)', fontSize: '0.75rem' }}>
              {hoursToApproveByCompany.size > 1 ? (
                <Trans>Je hebt uren die goedkeuring nodig hebben, per bedrijf:</Trans>
              ) : (
                <Trans>Je hebt uren die goedkeuring nodig hebben.</Trans>
              )}
            </p>
            {hoursToApproveByCompany.size > 1 ? (
              [...hoursToApproveByCompany.entries()].map(([companyId, hours]) => (
                <Link
                  key={companyId}
                  to="/app/reports?tab=approvals"
                  style={{ color: '#fff', textDecoration: 'none', fontSize: '0.78rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                >
                  <span>{companyById(companyId)?.name ?? companyId}</span>
                  <strong>{formatHours(hours)}</strong>
                </Link>
              ))
            ) : (
              <Link
                to="/app/reports?tab=approvals"
                style={{ color: '#fff', textDecoration: 'none', fontSize: '0.78rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              >
                <span><Trans>Uren ter goedkeuring</Trans></span>
                <strong>{formatHours(hoursToApprove)}</strong>
              </Link>
            )}
          </div>
        </section>
      )}

      {staff && pendingRequestedTasks.length > 0 && (
        <section className="report-card" style={{ background: 'var(--sidebar-bg)', color: '#fff', border: 'none', boxShadow: '0 4px 15px rgba(0,0,0,0.15)', overflow: 'hidden', borderRadius: '0.75rem' }}>
          <div className="report-card-header" style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-2))', borderBottom: 'none', color: '#fff', padding: '0.75rem 1rem' }}>
            <h3 style={{ color: '#fff', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0, fontSize: '0.85rem' }}>
              <AlertCircle size={15} /> <Trans>Taakaanvragen</Trans>
            </h3>
          </div>
          <p style={{ margin: '0.75rem 1rem 0', color: 'color-mix(in srgb, #fff 90%, transparent)', fontSize: '0.75rem' }}>
            <Trans>Er zijn taakaanvragen die je goedkeuring nodig hebben.</Trans>
          </p>
          <ul className="dashboard-list" style={{ listStyle: 'none', margin: 0, padding: '0.5rem 1rem' }}>
            {pendingRequestedTasks.slice(0, 8).map((task) => (
              <li key={task.$id} className="dashboard-list-item" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', padding: '0.5rem 0', borderTop: 'none' }}>
                <Link
                  to={`/app/projects/${task.projectId}`}
                  style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500, color: '#fff', textDecoration: 'none', fontSize: '0.75rem' }}
                >
                  {task.title}
                </Link>
                <span style={{ flexShrink: 0, marginLeft: '0.5rem', color: 'color-mix(in srgb, #fff 70%, transparent)', fontSize: '0.7rem' }}>
                  {projectNameById.get(task.projectId) ?? ''}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="report-card client-dashboard-projects" style={{ background: 'var(--sidebar-bg)', color: '#fff', border: 'none', boxShadow: '0 4px 15px rgba(0,0,0,0.15)', overflow: 'hidden', borderRadius: '0.75rem' }}>
        <div className="report-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'linear-gradient(135deg, var(--accent), var(--accent-2))', borderBottom: 'none', color: '#fff', padding: '0.75rem 1rem' }}>
          <h3 style={{ color: '#fff', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0, fontSize: '0.85rem' }}>
            <FolderKanban size={15} /> <Trans>Lopende projecten</Trans>
          </h3>
          <div style={{ display: 'flex', gap: '2rem', fontSize: '0.65rem', color: 'color-mix(in srgb, #fff 85%, transparent)', fontWeight: 600, textTransform: 'uppercase' }}>
            <span><Trans>Open taken</Trans></span>
            <span><Trans>Uren</Trans></span>
          </div>
        </div>

        {projectStats.length === 0 ? (
          <p className="empty-state" style={{ color: '#fff', padding: '1rem', fontSize: '0.75rem' }}><Trans>Geen lopende projecten.</Trans></p>
        ) : (
          <ul className="dashboard-list" style={{ listStyle: 'none', margin: 0, padding: '0.5rem 0' }}>
            {projectStats.map(({ project, openCount, hours }) => (
              <li key={project.$id} className="dashboard-list-item client-project-row" style={{ borderTop: 'none', padding: '0.5rem 1rem' }}>
                <div className="client-project-line" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', gap: '0.75rem', minWidth: 0 }}>
                  <Link className="client-project-name" to={`/app/projects/${project.$id}`} style={{ color: '#fff', textDecoration: 'none', fontWeight: 500, fontSize: '0.75rem', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {project.name}
                    {isMultiCompany ? ` · ${companyById(project.companyId)?.name ?? ''}` : ''}
                  </Link>
                  <span className="client-project-inline-meta" style={{ display: 'flex', gap: '2rem', alignItems: 'center', color: '#fff', fontSize: '0.72rem' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                      <ListTodo size={12} style={{ color: 'var(--accent)' }} /> {openCount}
                    </span>
                    <Link to={reportsPath} title={t`Urenregistratie / rapportages`} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', color: '#fff', textDecoration: 'none', fontSize: '0.72rem' }}>
                      <Clock3 size={12} style={{ color: 'var(--accent)' }} /> {formatHours(hours)}
                    </Link>
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="client-period-stats client-period-stats--below" style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-2))', color: '#fff', borderTop: 'none', padding: '0.75rem 1rem', display: 'flex', justifyContent: 'space-around' }}>
          <div className="client-period-stat client-period-stat--inline" style={{ color: '#fff', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Clock3 size={15} className="client-period-icon" style={{ color: '#fff' }} />
            <span className="client-period-stat-label" style={{ color: 'color-mix(in srgb, #fff 85%, transparent)' }}><Trans>Deze week</Trans></span>
            <span className="client-period-stat-value" style={{ color: '#fff', fontWeight: 700 }}>{formatHours(weekHours)}</span>
          </div>
          <div className="client-period-stat client-period-stat--inline" style={{ color: '#fff', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <CalendarDays size={15} className="client-period-icon" style={{ color: '#fff' }} />
            <span className="client-period-stat-label" style={{ color: 'color-mix(in srgb, #fff 85%, transparent)' }}><Trans>Deze maand</Trans></span>
            <span className="client-period-stat-value" style={{ color: '#fff', fontWeight: 700 }}>{formatHours(monthHours)}</span>
          </div>
        </div>
      </section>

      <section className="report-card" style={{ background: 'var(--sidebar-bg)', color: '#fff', border: 'none', boxShadow: '0 4px 15px rgba(0,0,0,0.15)', overflow: 'hidden', borderRadius: '0.75rem' }}>
        <div className="report-card-header" style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-2))', borderBottom: 'none', color: '#fff', padding: '0.75rem 1rem' }}>
          <h3 style={{ color: '#fff', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0, fontSize: '0.85rem' }}>
            <MessagesSquare size={15} /> <Trans>Discussies</Trans>
          </h3>
        </div>
        {discussionFeed.length === 0 ? (
          <p className="empty-state" style={{ color: '#fff', padding: '1rem', fontSize: '0.75rem' }}><Trans>Geen discussies.</Trans></p>
        ) : (
          <ul className="dashboard-list" style={{ listStyle: 'none', margin: 0, padding: '0.5rem 1rem' }}>
            {discussionFeed.map((item) => (
              <li key={item.id} className="dashboard-list-item" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', textAlign: 'left', padding: '0.5rem 0', borderTop: 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: 0 }}>
                  <span style={{ color: 'var(--accent)', display: 'inline-flex', alignItems: 'center', flexShrink: 0 }}>
                    {item.kind === 'topic' ? <MessageSquarePlus size={15} /> : <MessagesSquare size={15} />}
                  </span>
                  <Link to={item.href} style={{ textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500, color: '#fff', textDecoration: 'none', fontSize: '0.75rem' }}>
                    {item.title}
                  </Link>
                </div>
                <span className="dashboard-list-meta" style={{ flexShrink: 0, marginLeft: '0.5rem', color: 'color-mix(in srgb, #fff 70%, transparent)', fontSize: '0.7rem' }}>{dayjs(item.createdAt).format('D MMM HH:mm')}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </aside>
  );
}
