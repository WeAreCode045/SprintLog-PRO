import type { CompanyRow, ResolvedRole } from '../../appwrite/types';
import { isStaffRole } from '../../auth/RequireStaff';
import { AdminDashboardView } from './AdminDashboardView';
import { ClientDashboardView } from './ClientDashboardView';
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
  const staff = isStaffRole(role);

  // For Admin and Developer/Staff roles, render the rich new Admin Dashboard
  if (staff) {
    return (
      <AdminDashboardView
        role={role}
        displayName={displayName}
        userId={userId}
        data={data}
        companyById={companyById}
        isMultiCompany={isMultiCompany}
      />
    );
  }

  // Client view with modern dashboard layout
  return (
    <ClientDashboardView
      role={role}
      displayName={displayName}
      userId={userId}
      data={data}
      companyById={companyById}
      isMultiCompany={isMultiCompany}
    />
  );
}
