import { Link, Navigate, useOutletContext } from 'react-router-dom';
import dayjs from 'dayjs';
import { Download } from 'lucide-react';
import { Trans, useLingui } from '@lingui/react/macro';
import { t as staticT } from '@lingui/core/macro';
import type { PortalContext } from '../layouts/PortalLayout';
import { CompanyScopeControl } from '../features/companies/CompanyScopeControl';
import { getInvoicePdfUrl } from '../features/invoices/api';
import { useInvoices } from '../features/invoices/hooks';
import { formatHours } from '../lib/formatHours';
import { PageHeader } from '../components/PageHeader';
import { PageBreadcrumb } from '../components/PageBreadcrumb';

function formatAmount(amount: number, currency: string) {
  return `${currency} ${amount.toFixed(2)}`;
}

function statusLabel(status: string) {
  return status === 'generated' ? staticT`Gegenereerd` : staticT`Vervallen`;
}

export function ClientInvoicesPage() {
  const { t } = useLingui();
  const { role, enabledCompanyIds, companyById } = useOutletContext<PortalContext>();
  const { data: invoices = [], isLoading } = useInvoices();

  if (role !== 'client') {
    return <Navigate to="/app/dashboard" replace />;
  }

  const ownInvoices = invoices.filter((invoice) => enabledCompanyIds.includes(invoice.companyId));

  return (
    <div className="content-card">
      <div className="content-inner">
        <PageHeader
          title={<Trans>Facturen</Trans>}
          description={<Trans>Al je facturen op een rij.</Trans>}
          breadcrumb={
            <PageBreadcrumb
              items={[{ label: t`Dashboard`, to: '/app/dashboard' }, { label: t`Facturen` }]}
            />
          }
          actions={<CompanyScopeControl />}
        />

        {isLoading ? (
          <p><Trans>Laden…</Trans></p>
        ) : ownInvoices.length === 0 ? (
          <p className="empty-state"><Trans>Nog geen facturen.</Trans></p>
        ) : (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="data-table-col-wide"><Trans>Factuur</Trans></th>
                  {enabledCompanyIds.length > 1 && <th><Trans>Bedrijf</Trans></th>}
                  <th><Trans>Periode</Trans></th>
                  <th className="data-table-num"><Trans>Uren</Trans></th>
                  <th className="data-table-num"><Trans>Bedrag</Trans></th>
                  <th><Trans>Status</Trans></th>
                </tr>
              </thead>
              <tbody>
                {ownInvoices.map((invoice) => (
                  <tr key={invoice.$id}>
                    <td>
                      <Link className="data-table-title-button" to={`/app/my-invoices/${invoice.$id}`}>
                        {invoice.invoiceNumber}
                      </Link>
                    </td>
                    {enabledCompanyIds.length > 1 && (
                      <td>{companyById(invoice.companyId)?.name ?? invoice.companyId}</td>
                    )}
                    <td>
                      {dayjs(invoice.periodStart).format('D MMM')} –{' '}
                      {dayjs(invoice.periodEnd).subtract(1, 'day').format('D MMM YYYY')}
                    </td>
                    <td className="data-table-num">{formatHours(invoice.totalHours)}</td>
                    <td className="data-table-num">
                      {formatAmount(invoice.totalWithVat ?? invoice.totalAmount, invoice.currency)}
                    </td>
                    <td>
                      <span className={`badge badge-status--${invoice.status === 'generated' ? 'open' : 'finished'}`}>
                        {statusLabel(invoice.status)}
                      </span>
                      {invoice.pdfFileId ? (
                        <div className="data-table-actions">
                          <a
                            className="icon-button"
                            title={t`PDF downloaden`}
                            href={getInvoicePdfUrl(invoice.pdfFileId)}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <Download size={16} />
                          </a>
                        </div>
                      ) : (
                        <span className="data-table-muted"> <Trans>PDF wordt gegenereerd…</Trans></span>
                      )}
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
