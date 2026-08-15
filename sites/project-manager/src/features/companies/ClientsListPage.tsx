import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Trans, useLingui } from '@lingui/react/macro';
import { IconChevronDown, IconTrash, IconUsers } from '../../components/icons';
import { PageHeader } from '../../components/PageHeader';
import { PageBreadcrumb } from '../../components/PageBreadcrumb';
import { useInvoices } from '../invoices/hooks';
import { useAllCompanies, useDeleteCompany } from './hooks';
import { NewClientDialog } from './NewClientDialog';

function formatAmount(amount: number, currency: string) {
  return `${currency} ${amount.toFixed(2)}`;
}

export function ClientsListPage() {
  const { t } = useLingui();
  const { data: clients = [], isLoading } = useAllCompanies(true);
  const { data: allInvoices = [] } = useInvoices();
  const deleteClient = useDeleteCompany();
  const [showNewClient, setShowNewClient] = useState(false);
  const [expandedRowIds, setExpandedRowIds] = useState<Set<string>>(new Set());
  const navigate = useNavigate();

  function toggleRowExpanded(clientId: string) {
    setExpandedRowIds((prev) => {
      const next = new Set(prev);
      if (next.has(clientId)) next.delete(clientId);
      else next.add(clientId);
      return next;
    });
  }

  const openInvoicesByCompany = useMemo(() => {
    const map = new Map<string, { count: number; total: number; currency: string }>();
    const openInvoices = allInvoices.filter(
      (invoice) => invoice.status === 'sent' && !invoice.creditForInvoiceId && !invoice.creditedByInvoiceId,
    );
    for (const invoice of openInvoices) {
      const rawAmount = invoice.totalWithVat ?? invoice.totalAmount;
      const existing = map.get(invoice.companyId);
      if (existing) {
        existing.count += 1;
        existing.total += rawAmount;
      } else {
        map.set(invoice.companyId, { count: 1, total: rawAmount, currency: invoice.currency });
      }
    }
    return map;
  }, [allInvoices]);

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
            <table className="data-table data-table--collapsible">
              <thead>
                <tr>
                  <th className="data-table-col-wide"><Trans>Naam</Trans></th>
                  <th><Trans>E-mail</Trans></th>
                  <th className="data-table-num"><Trans>Uurtarief</Trans></th>
                  <th className="data-table-num"><Trans>Open facturen</Trans></th>
                </tr>
              </thead>
              <tbody>
                {clients.map((client) => {
                  const expanded = expandedRowIds.has(client.$id);
                  return (
                    <tr key={client.$id} className={expanded ? 'data-table-row--expanded' : ''}>
                      <td>
                        <div className="data-table-title-cell">
                          <button
                            type="button"
                            className="data-table-title-button"
                            onClick={() => navigate(`/app/manage/${client.$id}`)}
                          >
                            {client.name}
                          </button>
                          <button
                            type="button"
                            className="data-table-expand-toggle"
                            title={expanded ? t`Minder tonen` : t`Meer tonen`}
                            aria-label={expanded ? t`Minder tonen` : t`Meer tonen`}
                            onClick={() => toggleRowExpanded(client.$id)}
                          >
                            <IconChevronDown />
                          </button>
                        </div>
                      </td>
                      <td className="data-table-muted" data-label={t`E-mail`}>{client.email || '—'}</td>
                      <td className="data-table-num" data-label={t`Uurtarief`}>
                        {client.hourlyRate != null ? `€ ${client.hourlyRate.toFixed(2)}` : '—'}
                        <div className="data-table-actions">
                          <Link
                            className="icon-button"
                            title={t`Accounts`}
                            to={`/app/manage/${client.$id}?tab=accounts`}
                          >
                            <IconUsers />
                          </Link>
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
                      <td className="data-table-num" data-label={t`Open facturen`}>
                        {openInvoicesByCompany.has(client.$id) ? (
                          <Link className="data-table-title-button" to={`/app/invoices?company=${client.$id}`}>
                            {openInvoicesByCompany.get(client.$id)!.count}
                            {' · '}
                            {formatAmount(
                              openInvoicesByCompany.get(client.$id)!.total,
                              openInvoicesByCompany.get(client.$id)!.currency,
                            )}
                          </Link>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  );
                })}
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
