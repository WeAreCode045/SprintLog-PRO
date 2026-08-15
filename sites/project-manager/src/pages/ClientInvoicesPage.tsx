import { useState } from 'react';
import { Link, Navigate, useOutletContext, useSearchParams } from 'react-router-dom';
import dayjs from 'dayjs';
import { Download } from 'lucide-react';
import { Trans, useLingui } from '@lingui/react/macro';
import { t as staticT } from '@lingui/core/macro';
import type { PortalContext } from '../layouts/PortalLayout';
import { CompanyScopeControl } from '../features/companies/CompanyScopeControl';
import { IconChevronDown } from '../components/icons';
import { getInvoicePdfUrl } from '../features/invoices/api';
import { useInvoices } from '../features/invoices/hooks';
import { formatHours } from '../lib/formatHours';
import { PageHeader } from '../components/PageHeader';
import { PageBreadcrumb, type BreadcrumbItem } from '../components/PageBreadcrumb';

function formatAmount(amount: number, currency: string) {
  return `${currency} ${amount.toFixed(2)}`;
}

function statusLabel(status: string) {
  return status === 'sent' ? staticT`Verzonden` : staticT`Vervallen`;
}

/** Mirrors InvoicesAdminPage#statusBadgeClass — clients never see 'draft' (filtered below and
 * unreachable via row permissions), so only sent/void map here. */
function statusBadgeClass(status: string) {
  return status === 'sent' ? 'open' : 'finished';
}

export function ClientInvoicesPage() {
  const { t } = useLingui();
  const { role, availableCompanies, enabledCompanyIds, companyById } = useOutletContext<PortalContext>();
  const { data: invoices = [], isLoading } = useInvoices();
  const [searchParams, setSearchParams] = useSearchParams();
  const [expandedRowIds, setExpandedRowIds] = useState<Set<string>>(new Set());

  if (role !== 'client') {
    return <Navigate to="/app/dashboard" replace />;
  }

  function toggleRowExpanded(invoiceId: string) {
    setExpandedRowIds((prev) => {
      const next = new Set(prev);
      if (next.has(invoiceId)) next.delete(invoiceId);
      else next.add(invoiceId);
      return next;
    });
  }

  const isMultiCompany = availableCompanies.length > 1;
  const selectedCompanyId = isMultiCompany ? searchParams.get('company') : null;
  const showCompanyPicker = isMultiCompany && !selectedCompanyId;

  // Drafts are also excluded at the row-permission level (see draftInvoicePermissions), this
  // is belt-and-suspenders in case a query ever returns one.
  const companyIdsToShow = selectedCompanyId ? [selectedCompanyId] : enabledCompanyIds;
  const ownInvoices = invoices.filter(
    (invoice) => companyIdsToShow.includes(invoice.companyId) && invoice.status !== 'draft',
  );

  const selectedCompany = selectedCompanyId ? companyById(selectedCompanyId) : undefined;

  const breadcrumbItems: BreadcrumbItem[] = [{ label: t`Dashboard`, to: '/app/dashboard' }];
  if (isMultiCompany && selectedCompany) {
    breadcrumbItems.push({ label: t`Facturen`, to: '/app/my-invoices' });
    breadcrumbItems.push({ label: selectedCompany.name });
  } else {
    breadcrumbItems.push({ label: t`Facturen` });
  }

  return (
    <div className="content-card">
      <div className="content-inner">
        <PageHeader
          title={selectedCompany ? selectedCompany.name : <Trans>Facturen</Trans>}
          description={
            showCompanyPicker ? (
              <Trans>Kies een bedrijf om de facturen te bekijken.</Trans>
            ) : (
              <Trans>Al je facturen op een rij.</Trans>
            )
          }
          breadcrumb={<PageBreadcrumb items={breadcrumbItems} />}
          actions={!isMultiCompany ? <CompanyScopeControl /> : undefined}
        />

        {showCompanyPicker ? (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="data-table-col-wide"><Trans>Bedrijf</Trans></th>
                </tr>
              </thead>
              <tbody>
                {availableCompanies.map((company) => (
                  <tr key={company.$id}>
                    <td>
                      <button
                        type="button"
                        className="data-table-title-button"
                        onClick={() => setSearchParams({ company: company.$id })}
                      >
                        {company.name}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : isLoading ? (
          <p><Trans>Laden…</Trans></p>
        ) : ownInvoices.length === 0 ? (
          <p className="empty-state"><Trans>Nog geen facturen.</Trans></p>
        ) : (
          <div className="data-table-wrap">
            <table className="data-table data-table--collapsible">
              <thead>
                <tr>
                  <th className="data-table-col-wide"><Trans>Factuur</Trans></th>
                  <th><Trans>Periode</Trans></th>
                  <th className="data-table-num"><Trans>Uren</Trans></th>
                  <th className="data-table-num"><Trans>Bedrag</Trans></th>
                  <th><Trans>Status</Trans></th>
                </tr>
              </thead>
              <tbody>
                {ownInvoices.map((invoice) => {
                  const expanded = expandedRowIds.has(invoice.$id);
                  return (
                    <tr key={invoice.$id} className={expanded ? 'data-table-row--expanded' : ''}>
                      <td>
                        <div className="data-table-title-cell">
                          <Link className="data-table-title-button" to={`/app/my-invoices/${invoice.$id}`}>
                            {invoice.invoiceNumber}
                          </Link>
                          <button
                            type="button"
                            className="data-table-expand-toggle"
                            title={expanded ? t`Minder tonen` : t`Meer tonen`}
                            aria-label={expanded ? t`Minder tonen` : t`Meer tonen`}
                            onClick={() => toggleRowExpanded(invoice.$id)}
                          >
                            <IconChevronDown />
                          </button>
                        </div>
                      </td>
                      <td data-label={t`Periode`}>
                        {invoice.periodStart && invoice.periodEnd ? (
                          <>
                            {dayjs(invoice.periodStart).format('D MMM')} –{' '}
                            {dayjs(invoice.periodEnd).subtract(1, 'day').format('D MMM YYYY')}
                          </>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="data-table-num" data-label={t`Uren`}>{formatHours(invoice.totalHours)}</td>
                      <td className="data-table-num" data-label={t`Bedrag`}>
                        {formatAmount(invoice.totalWithVat ?? invoice.totalAmount, invoice.currency)}
                      </td>
                      <td data-label={t`Status`}>
                        <span className={`badge badge-status--${statusBadgeClass(invoice.status)}`}>
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
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
