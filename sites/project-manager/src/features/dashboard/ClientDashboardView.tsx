import { useMemo } from 'react';
import type { CompanyRow, ResolvedRole } from '../../appwrite/types';
import type { DashboardPageData } from './useDashboardPageData';
import { entryNeedsApproval } from '../timeEntries/timeEntryBilling';
import { AdminBookedHoursChart } from './AdminBookedHoursChart';
import { ClientCompletedTasksChart } from './ClientCompletedTasksChart';
import { ClientStatCards } from './ClientStatCards';
import { ClientBottomCards } from './ClientBottomCards';
import { AdminActionSidebar } from './AdminActionSidebar';

interface ClientDashboardViewProps {
  role: ResolvedRole;
  displayName: string;
  userId: string;
  data: DashboardPageData;
  companyById: (companyId: string) => CompanyRow | undefined;
  isMultiCompany: boolean;
}

export function ClientDashboardView({
  data,
  companyById,
}: ClientDashboardViewProps) {
  const {
    overview,
    allTasks,
    allEntries,
    enabledCompanyIds,
  } = data;

  const companies = useMemo(() => {
    return enabledCompanyIds.map((id) => companyById(id)).filter(Boolean) as CompanyRow[];
  }, [enabledCompanyIds, companyById]);

  const projects = useMemo(() => {
    return overview.projects || [];
  }, [overview.projects]);

  const pendingApprovalHours = useMemo(() => {
    if (typeof overview.hoursToApprove === 'number' && overview.hoursToApprove > 0) {
      return overview.hoursToApprove;
    }
    return allEntries
      .filter((e) => entryNeedsApproval(e))
      .reduce((sum, e) => sum + (e.hours ?? 0), 0);
  }, [overview.hoursToApprove, allEntries]);

  return (
    <div className="admin-dashboard-layout">
      {/* LEFT SECTION: 3/4 OF CONTENT */}
      <main className="admin-dashboard-main">
        {/* Top Section: 5 Stat Cards */}
        <section className="admin-stats-section">
          <ClientStatCards
            projects={projects}
            tasks={allTasks}
            entries={allEntries}
            pendingApprovalHours={pendingApprovalHours}
          />
        </section>

        {/* Middle Charts Row: Booked Hours (3/5) + Completed Tasks (2/5) */}
        <section className="admin-charts-row">
          <div className="admin-chart-col admin-chart-col--hours">
            <AdminBookedHoursChart
              entries={allEntries}
              projects={projects}
              companies={companies}
              companyById={companyById}
            />
          </div>
          <div className="admin-chart-col admin-chart-col--revenue">
            <ClientCompletedTasksChart
              tasks={allTasks}
              projects={projects}
            />
          </div>
        </section>

        {/* Bottom Section: 3 Action Cards */}
        <section className="admin-bottom-section">
          <ClientBottomCards
            tasks={allTasks}
            entries={allEntries}
            projects={projects}
            companyById={companyById}
          />
        </section>
      </main>

      {/* RIGHT SECTION: 1/4 OF CONTENT */}
      <div className="admin-dashboard-sidebar-wrap">
        <AdminActionSidebar
          discussions={overview.discussions || []}
          discussionFeed={overview.discussionFeed || []}
          tasks={allTasks}
          projects={projects}
        />
      </div>
    </div>
  );
}
