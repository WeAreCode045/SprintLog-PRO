import { useOutletContext } from 'react-router-dom';
import { Trans } from '@lingui/react/macro';
import { useAuth } from '../auth/AuthContext';
import { CompanyScopeControl } from '../features/companies/CompanyScopeControl';
import { DashboardPageView } from '../features/dashboard/DashboardPageView';
import { useDashboardPageData } from '../features/dashboard/useDashboardPageData';
import { useUserProfiles } from '../features/profiles/hooks';
import { PageHeader } from '../components/PageHeader';
import type { PortalContext } from '../layouts/PortalLayout';

export function DashboardPage() {
  const { role, enabledCompanyIds, companyById, isMultiCompany } = useOutletContext<PortalContext>();
  const { user } = useAuth();
  const { data: profiles = [] } = useUserProfiles(true);
  const userId = user?.$id ?? '';
  const data = useDashboardPageData(enabledCompanyIds, role, userId);

  const profile = profiles.find((entry) => entry.userId === userId);
  const displayName = profile?.displayName || user?.name || user?.email || 'gebruiker';

  if (enabledCompanyIds.length === 0) {
    return (
      <div className="content-card">
        <div className="content-inner">
          <p className="empty-state"><Trans>Geen bedrijven geselecteerd.</Trans></p>
        </div>
      </div>
    );
  }

  return (
    <div className="content-card dashboard-v2-page">
      <div className="content-inner dashboard-v2-page-inner">
        <PageHeader
          title={<Trans>Dashboard</Trans>}
          actions={<CompanyScopeControl />}
          description={<Trans>Overzicht van alle Projecten, Taken en gewerkte Uren.</Trans>}
        />

        {data.loading && <p><Trans>Laden…</Trans></p>}

        {!data.loading && user && (
          <DashboardPageView
            role={role}
            displayName={displayName}
            userId={userId}
            data={data}
            companyById={companyById}
            isMultiCompany={isMultiCompany}
          />
        )}
      </div>
    </div>
  );
}
