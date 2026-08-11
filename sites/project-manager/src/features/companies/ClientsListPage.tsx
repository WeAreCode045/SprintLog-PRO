import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trans, useLingui } from '@lingui/react/macro';
import { IconTrash } from '../../components/icons';
import { PageHeader } from '../../components/PageHeader';
import { PageBreadcrumb } from '../../components/PageBreadcrumb';
import { useAllCompanies, useDeleteCompany } from './hooks';
import { NewClientDialog } from './NewClientDialog';

export function ClientsListPage() {
  const { t } = useLingui();
  const { data: clients = [], isLoading } = useAllCompanies(true);
  const deleteClient = useDeleteCompany();
  const [showNewClient, setShowNewClient] = useState(false);
  const navigate = useNavigate();

  return (
    <div className="content-card">
      <div className="content-inner">
        <PageHeader
          title={<Trans>Klantenbeheer</Trans>}
          description={<Trans>Alle klanten en hun uurtarief.</Trans>}
          breadcrumb={
            <PageBreadcrumb
              items={[{ label: t`Dashboard`, to: '/app/dashboard' }, { label: t`Klantenbeheer` }]}
            />
          }
        />

        <div className="pane-header">
          <h2><Trans>Alle klanten</Trans></h2>
          <button type="button" className="btn-accent" onClick={() => setShowNewClient(true)}>
            <Trans>+ Nieuwe klant</Trans>
          </button>
        </div>

        {isLoading && <p><Trans>Laden…</Trans></p>}
        {!isLoading && clients.length === 0 && <p className="empty-state"><Trans>Nog geen klanten.</Trans></p>}

        {!isLoading && clients.length > 0 && (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="data-table-col-wide"><Trans>Naam</Trans></th>
                  <th><Trans>E-mail</Trans></th>
                  <th className="data-table-num"><Trans>Uurtarief</Trans></th>
                </tr>
              </thead>
              <tbody>
                {clients.map((client) => (
                  <tr key={client.$id}>
                    <td>
                      <button
                        type="button"
                        className="data-table-title-button"
                        onClick={() => navigate(`/app/manage/${client.$id}`)}
                      >
                        {client.name}
                      </button>
                    </td>
                    <td className="data-table-muted">{client.email || '—'}</td>
                    <td className="data-table-num">
                      {client.hourlyRate != null ? `€ ${client.hourlyRate.toFixed(2)}` : '—'}
                      <div className="data-table-actions">
                        <button
                          type="button"
                          className="icon-button"
                          title={t`Klant verwijderen`}
                          onClick={() => {
                            if (confirm(t`Klant "${client.name}" en alle bijbehorende data verwijderen?`)) {
                              void deleteClient.mutateAsync(client.$id);
                            }
                          }}
                        >
                          <IconTrash />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showNewClient && (
        <NewClientDialog
          onClose={() => setShowNewClient(false)}
          onCreated={(companyId) => {
            setShowNewClient(false);
            navigate(`/app/manage/${companyId}`);
          }}
        />
      )}
    </div>
  );
}
