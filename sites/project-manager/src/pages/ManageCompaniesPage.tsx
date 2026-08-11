import { Link, useOutletContext } from 'react-router-dom';
import { Trans, useLingui } from '@lingui/react/macro';
import { PageHeader } from '../components/PageHeader';
import { PageBreadcrumb } from '../components/PageBreadcrumb';
import type { PortalContext } from '../layouts/PortalLayout';

/** Staff: pick a company before opening Client Manager. */
export function ManageCompaniesPage() {
  const { t } = useLingui();
  const { availableCompanies } = useOutletContext<PortalContext>();

  return (
    <div className="content-card">
      <div className="content-inner">
        <PageHeader
          title={<Trans>Beheren</Trans>}
          description={<Trans>Selecteer een klant om te beheren.</Trans>}
          breadcrumb={
            <PageBreadcrumb
              items={[{ label: t`Dashboard`, to: '/app/dashboard' }, { label: t`Beheren` }]}
            />
          }
        />

        {availableCompanies.length === 0 ? (
          <p className="empty-state"><Trans>Geen klanten gevonden.</Trans></p>
        ) : (
          <ul className="manage-company-list">
            {availableCompanies.map((company) => (
              <li key={company.$id}>
                <Link to={`/app/manage/${company.$id}`} className="manage-company-item">
                  {company.name}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
