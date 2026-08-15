import { Trans } from '@lingui/react/macro';
import type { CompanyRow, ResolvedRole } from '../../appwrite/types';
import { isStaffRole } from '../../auth/RequireStaff';
import { DashboardStatsCards } from './DashboardStatsCards';
import { DashboardNotificationsCard } from './DashboardNotificationsCard';
import { DashboardProjectsCard } from './DashboardProjectsCard';
import { DashboardTimeEntriesCard } from './DashboardTimeEntriesCard';
import { DashboardFinancialCard } from './DashboardFinancialCard';
import { DashboardDiscussionsCard } from './DashboardDiscussionsCard';
import type { DashboardPageData } from './useDashboardPageData';

interface DashboardPageViewProps {
  role: ResolvedRole;
  displayName: string;
  userId: string;
  data: DashboardPageData;
  companyById: (companyId: string) => CompanyRow | undefined;
  isMultiCompany: boolean;
}

export function DashboardPageView({
  role,
  displayName,
  userId,
  data,
  companyById,
  isMultiCompany,
}: DashboardPageViewProps) {
  const {
    timeEntryLists,
    financialStats,
    overview,
    recentNotifications,
  } = data;
  const staff = isStaffRole(role);

  return (
    <div className="dashboard-v2">
      <section className="dashboard-v2-section dashboard-v2-section--top">
        <div className="dashboard-v2-welcome">
          <h2 className="dashboard-v2-welcome-title">
            <Trans>Welkom terug, {displayName}!</Trans>
          </h2>
          <p className="dashboard-v2-welcome-text">
            <Trans>Hier is een overzicht van alle Projecten, Taken en Gewerkte uren.</Trans>
          </p>
        </div>

        <DashboardNotificationsCard notifications={recentNotifications} userId={userId} />

        <div className="dashboard-v2-stats-cards">
          <DashboardStatsCards stats={overview.currentStats} columns={2} />
        </div>
      </section>

      <section className="dashboard-v2-section dashboard-v2-section--middle">
        <DashboardProjectsCard
          projectStats={overview.projectStats}
          isMultiCompany={isMultiCompany}
          companyById={companyById}
        />

        <DashboardTimeEntriesCard timeEntryLists={timeEntryLists} showPendingInvoice={staff} />

        {staff ? (
          <DashboardFinancialCard
            role={role}
            financialStats={financialStats}
            companyById={companyById}
          />
        ) : (
          <DashboardDiscussionsCard discussionFeed={overview.discussionFeed} />
        )}
      </section>
    </div>
  );
}
