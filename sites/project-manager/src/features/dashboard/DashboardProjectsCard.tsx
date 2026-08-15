import { Link } from 'react-router-dom';
import { Clock3, FolderKanban, ListTodo, ArrowRight } from 'lucide-react';
import { Trans, useLingui } from '@lingui/react/macro';
import type { CompanyRow } from '../../appwrite/types';
import type { DashboardOverview } from './useDashboardOverview';
import { formatHours } from '../../lib/formatHours';

interface DashboardProjectsCardProps {
  projectStats: DashboardOverview['projectStats'];
  isMultiCompany: boolean;
  companyById: (companyId: string) => CompanyRow | undefined;
  reportsPath?: string;
}

export function DashboardProjectsCard({
  projectStats,
  isMultiCompany,
  companyById,
  reportsPath = '/app/reports',
}: DashboardProjectsCardProps) {
  const { t } = useLingui();

  return (
    <article className="dashboard-v2-card">
      <header className="dashboard-v2-card-header">
        <Trans>Jouw Projecten</Trans>
      </header>
      <div className="dashboard-v2-card-body">
        <section className="dashboard-v2-card-section">
          <header className="dashboard-v2-card-section-header">
            <FolderKanban size={14} aria-hidden />
            <Trans>Actieve Projecten</Trans>
          </header>
          <p className="dashboard-v2-card-description">
            <Trans>Overzicht van je lopende projecten met open taken en geregistreerde uren.</Trans>
          </p>
        </section>
        {projectStats.length === 0 ? (
          <p className="dashboard-v2-empty"><Trans>Geen lopende projecten.</Trans></p>
        ) : (
          <>
            <div className="dashboard-v2-projects-list-header">
              <span><Trans>Project</Trans></span>
              <div className="dashboard-v2-projects-list-header-stats">
                <span className="dashboard-v2-projects-list-header-stat"><Trans>Open taken</Trans></span>
                <span className="dashboard-v2-projects-list-header-stat"><Trans>Uren</Trans></span>
              </div>
            </div>
            <ul className="dashboard-v2-projects-list">
            {projectStats.map(({ project, openCount, hours }) => (
              <li key={project.$id} className="dashboard-v2-projects-item">
                <Link to={`/app/projects/${project.$id}`} className="dashboard-v2-projects-name">
                  {project.name}
                  {isMultiCompany ? ` · ${companyById(project.companyId)?.name ?? ''}` : ''}
                </Link>
                <span className="dashboard-v2-projects-stats">
                  <span className="dashboard-v2-projects-stat">
                    <ListTodo size={12} aria-hidden />
                    {openCount}
                  </span>
                  <Link
                    to={reportsPath}
                    className="dashboard-v2-projects-stat dashboard-v2-projects-hours-link"
                    title={t`Urenregistratie / rapportages`}
                  >
                    <Clock3 size={12} aria-hidden />
                    {formatHours(hours)}
                  </Link>
                </span>
              </li>
            ))}
          </ul>
          </>
        )}
        <Link to="/app/projects" className="dashboard-v2-card-action">
          <Trans>Bekijk projecten</Trans>
          <ArrowRight size={14} />
        </Link>
      </div>
    </article>
  );
}
