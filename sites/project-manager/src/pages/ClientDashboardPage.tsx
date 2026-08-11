import { useOutletContext } from 'react-router-dom';
import { Trans } from '@lingui/react/macro';
import { useAuth } from '../auth/AuthContext';
import { CompanyScopeControl } from '../features/companies/CompanyScopeControl';
import { ProjectTasksPanel } from '../features/tasks/ProjectTasksPanel';
import { DashboardStatsCards } from '../features/dashboard/DashboardStatsCards';
import { DashboardSidebar } from '../features/dashboard/DashboardSidebar';
import { useDashboardOverview } from '../features/dashboard/useDashboardOverview';
import { PageHeader } from '../components/PageHeader';
import type { PortalContext } from '../layouts/PortalLayout';

export function ClientDashboardPage() {
  const { role, enabledCompanyIds, companyById, isMultiCompany } =
    useOutletContext<PortalContext>();
  const { user } = useAuth();
  const primaryCompany = companyById(enabledCompanyIds[0] ?? '');
  const userId = user?.$id ?? '';
  const overview = useDashboardOverview(enabledCompanyIds, role);

  if (!primaryCompany) {
    return (
      <div className="content-card">
        <div className="content-inner">
          <p className="empty-state"><Trans>Geen bedrijven geselecteerd.</Trans></p>
        </div>
      </div>
    );
  }

  return (
    <div className="content-card">
      <div className="content-inner">
        <PageHeader
          title={<Trans>Dashboard</Trans>}
          actions={<CompanyScopeControl />}
          description={<Trans>Overzicht van je projecten, taken en meldingen.</Trans>}
        />

        {overview.loading && <p><Trans>Laden…</Trans></p>}

        {!overview.loading && user && (
          <div className="developer-tasks-with-companion client-dashboard-tasks">
            <div className="developer-tasks-with-companion-main">
              <DashboardStatsCards stats={overview.currentStats} />

              <ProjectTasksPanel
                companyId={primaryCompany.$id}
                teamId={primaryCompany.teamId}
                userId={userId}
                role={role}
                projectNameById={overview.projectNameById}
                companyIds={enabledCompanyIds}
                companyName={(id) => companyById(id)?.name ?? id}
              />
            </div>
            <DashboardSidebar
              role={role}
              overview={overview}
              isMultiCompany={isMultiCompany}
              companyById={companyById}
            />
          </div>
        )}
      </div>
    </div>
  );
}
