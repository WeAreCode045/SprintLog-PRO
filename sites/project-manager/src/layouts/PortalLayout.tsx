import { Outlet } from 'react-router-dom';
import { useLingui } from '@lingui/react';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import {
  BarChart3,
  Building2,
  FolderKanban,
  LayoutDashboard,
  MessageSquare,
  Receipt,
  Settings,
  Users,
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import {
  CompanyScopeProvider,
  useCompanyScope,
  type PortalContext,
} from '../features/companies/CompanyScopeContext';
import { AppShell, type AppShellNavSection } from './AppShell';

export type { PortalContext };

function PortalShell() {
  const { user, logout } = useAuth();
  const scope = useCompanyScope();
  useLingui();

  if (!user) {
    return <div className="page-loading"><Trans>Laden…</Trans></div>;
  }

  if (!scope.scopeReady) {
    return <div className="page-loading"><Trans>Laden…</Trans></div>;
  }

  if (scope.availableCompanies.length === 0) {
    return <div className="page"><Trans>Geen toegang tot een klant.</Trans></div>;
  }

  const coreSection: AppShellNavSection = {
    items: [
      { to: '/app/dashboard', label: t`Dashboard`, icon: <LayoutDashboard size={18} /> },
      { to: '/app/projects', label: t`Projecten`, icon: <FolderKanban size={18} /> },
      { to: '/app/discussions', label: t`Discussies`, icon: <MessageSquare size={18} /> },
      { to: '/app/reports', label: t`Urenregistratie`, icon: <BarChart3 size={18} /> },
    ],
  };

  const sections: AppShellNavSection[] = [coreSection];
  if (scope.isStaff) {
    sections.push({
      title: t`Beheer`,
      items: [
        { to: '/clients', label: t`Klanten`, icon: <Building2 size={18} />, end: true },
        { to: '/clients/users', label: t`Gebruikers`, icon: <Users size={18} /> },
        ...(scope.role === 'admin'
          ? [{ to: '/app/invoices', label: t`Facturen`, icon: <Receipt size={18} /> }]
          : []),
      ],
    });
  }
  if (scope.role === 'client') {
    sections.push({
      title: t`Bedrijf`,
      items: [
        { to: '/app/my-invoices', label: t`Facturen`, icon: <Receipt size={18} /> },
        { to: '/app/company-settings', label: t`Bedrijfsgegevens`, icon: <Settings size={18} /> },
      ],
    });
  }

  return (
    <AppShell
      navSections={sections}
      userEmail={user.email}
      userName={user.name || user.email}
      onLogout={() => void logout()}
    >
      <Outlet context={scope satisfies PortalContext} />
    </AppShell>
  );
}

export function PortalLayout() {
  return (
    <CompanyScopeProvider>
      <PortalShell />
    </CompanyScopeProvider>
  );
}
