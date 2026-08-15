import { useOutletContext } from 'react-router-dom';
import { Trans } from '@lingui/react/macro';
import { useAuth } from '../auth/AuthContext';
import { CompanyScopeControl } from '../features/companies/CompanyScopeControl';
import { ProjectTasksPanel } from '../features/tasks/ProjectTasksPanel';
import { PageHeader } from '../components/PageHeader';
import type { PortalContext } from '../layouts/PortalLayout';

export function TaskPage() {
  const { role, enabledCompanyIds, companyById } = useOutletContext<PortalContext>();
  const { user } = useAuth();
  const primaryCompany = companyById(enabledCompanyIds[0] ?? '');
  const userId = user?.$id ?? '';

  if (!primaryCompany) {
    return (
      <div className="content-card">
        <div className="content-inner">
          <p className="empty-state"><Trans>Geen bedrijven geselecteerd.</Trans></p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="content-card">
        <div className="content-inner">
          <p><Trans>Laden…</Trans></p>
        </div>
      </div>
    );
  }

  return (
    <div className="content-card">
      <div className="content-inner">
        <PageHeader
          title={<Trans>Taken</Trans>}
          actions={<CompanyScopeControl />}
          description={<Trans>Beheer en volg al je taken per project.</Trans>}
        />

        <ProjectTasksPanel
          companyId={primaryCompany.$id}
          teamId={primaryCompany.teamId}
          userId={userId}
          role={role}
          companyIds={enabledCompanyIds}
          companyName={(id) => companyById(id)?.name ?? id}
        />
      </div>
    </div>
  );
}
