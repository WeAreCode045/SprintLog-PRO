import { useMemo } from 'react';
import type { CompanyRow, ResolvedRole } from '../../appwrite/types';
import { invoiceAmount, type DashboardPageData } from './useDashboardPageData';
import { AdminBookedHoursChart } from './AdminBookedHoursChart';
import { AdminRevenueChart } from './AdminRevenueChart';
import { AdminStatCards } from './AdminStatCards';
import { AdminBottomCards } from './AdminBottomCards';
import { AdminActionSidebar } from './AdminActionSidebar';

interface AdminDashboardViewProps {
  role: ResolvedRole;
  displayName: string;
  userId: string;
  data: DashboardPageData;
  companyById: (companyId: string) => CompanyRow | undefined;
  isMultiCompany: boolean;
}

export function AdminDashboardView({
  data,
  companyById,
}: AdminDashboardViewProps) {
  const {
    overview,
    allTasks,
    allEntries,
    scopedInvoices,
    enabledCompanyIds,
  } = data;

  const companies = useMemo(() => {
    return enabledCompanyIds.map((id) => companyById(id)).filter(Boolean) as CompanyRow[];
  }, [enabledCompanyIds, companyById]);

  const companyRateMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of companies) {
      map.set(c.$id, Number(c.hourlyRate) || 85);
    }
    return map;
  }, [companies]);

  const totalUnbilledAmount = useMemo(() => {
    let sum = 0;
    for (const entry of allEntries) {
      if (entry.approved && !entry.freeOfCharge && !entry.invoiced) {
        const rate = companyRateMap.get(entry.companyId) ?? (Number(companyById(entry.companyId)?.hourlyRate) || 85);
        sum += (entry.hours ?? 0) * rate;
      }
    }
    return Math.round(sum * 100) / 100;
  }, [allEntries, companyRateMap, companyById]);

  const totalInvoicedAmount = useMemo(() => {
    return scopedInvoices
      .filter((inv) => inv.status !== 'void' || Boolean(inv.creditedByInvoiceId))
      .reduce((sum, inv) => sum + invoiceAmount(inv), 0);
  }, [scopedInvoices]);

  const grandTotalRevenue = totalInvoicedAmount + totalUnbilledAmount;

  const projects = useMemo(() => {
    return overview.projects || [];
  }, [overview.projects]);

  const primaryCompanyId = enabledCompanyIds[0] || '';

  return (
    <div className="admin-dashboard-layout">
      {/* LEFT SECTION: 3/4 OF CONTENT */}
      <main className="admin-dashboard-main">
        {/* Top Section: 5 Stat Cards */}
        <section className="admin-stats-section">
          <AdminStatCards
            projects={projects}
            tasks={allTasks}
            entries={allEntries}
            totalRevenue={grandTotalRevenue}
          />
        </section>

        {/* Middle Charts Row: Booked Hours (3/5) + Revenue (2/5) */}
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
            <AdminRevenueChart
              invoices={scopedInvoices}
              entries={allEntries}
              companies={companies}
            />
          </div>
        </section>

        {/* Bottom Section: 3 Action Cards */}
        <section className="admin-bottom-section">
          <AdminBottomCards
            tasks={allTasks}
            entries={allEntries}
            projects={projects}
            companyById={companyById}
            primaryCompanyId={primaryCompanyId}
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
