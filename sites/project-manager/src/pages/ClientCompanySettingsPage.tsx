import { Navigate, useNavigate, useOutletContext } from 'react-router-dom';
import { Trans, useLingui } from '@lingui/react/macro';
import { PageHeader } from '../components/PageHeader';
import { PageBreadcrumb } from '../components/PageBreadcrumb';
import type { PortalContext } from '../layouts/PortalLayout';

export function ClientCompanySettingsPage() {
  const { t } = useLingui();
  const navigate = useNavigate();
  const { role, availableCompanies } = useOutletContext<PortalContext>();

  if (role !== 'client') {
    return <Navigate to="/app/dashboard" replace />;
  }

  return (
    <div className="content-card">
      <div className="content-inner">
        <PageHeader
          title={<Trans>Bedrijfsgegevens</Trans>}
          description={<Trans>De bedrijven waar je toegang toe hebt.</Trans>}
          breadcrumb={
            <PageBreadcrumb
              items={[{ label: t`Dashboard`, to: '/app/dashboard' }, { label: t`Bedrijfsgegevens` }]}
            />
          }
        />

        {availableCompanies.length === 0 ? (
          <p className="empty-state"><Trans>Geen bedrijven gevonden.</Trans></p>
        ) : (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="data-table-col-wide"><Trans>Naam</Trans></th>
                </tr>
              </thead>
              <tbody>
                {availableCompanies.map((company) => (
                  <tr key={company.$id}>
                    <td>
                      <button
                        type="button"
                        className="data-table-title-button"
                        onClick={() => navigate(`/app/company-settings/${company.$id}`)}
                      >
                        {company.name}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
