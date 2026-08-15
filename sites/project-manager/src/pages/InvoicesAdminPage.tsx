import { useMemo, useState } from 'react';
import { Link, useOutletContext, useSearchParams } from 'react-router-dom';
import { CheckboxFilterDropdown } from '../components/CheckboxFilterDropdown';
import dayjs from 'dayjs';
import { Download, Plus } from 'lucide-react';
import { Trans, useLingui } from '@lingui/react/macro';
import { t as staticT } from '@lingui/core/macro';
import type { PortalContext } from '../layouts/PortalLayout';
import type { InvoiceStatus } from '../appwrite/types';
import { CompanyScopeControl } from '../features/companies/CompanyScopeControl';
import { getInvoicePdfUrl } from '../features/invoices/api';
import { IconChevronDown } from '../components/icons';
import { useInvoices } from '../features/invoices/hooks';
import { formatHours } from '../lib/formatHours';
import { PageHeader } from '../components/PageHeader';
import { PageBreadcrumb } from '../components/PageBreadcrumb';

type InvoiceSortKey = 'issueDate' | 'invoiceNumber' | 'company' | 'period' | 'hours' | 'amount' | 'dueDate' | 'status';
type SortDir = 'asc' | 'desc';

function formatAmount(amount: number, currency: string) {
  return `${currency} ${amount.toFixed(2)}`;
}

function statusLabel(status: string) {
  switch (status) {
    case 'draft':
      return staticT`Concept`;
    case 'sent':
      return staticT`Verzonden`;
    default:
      return staticT`Vervallen`;
  }
}

/** draft mirrors the "in progress" amber used for on_hold projects; sent reuses the accent
 * "open" look invoices previously used for their normal (generated) state; void stays muted. */
function statusBadgeClass(status: string) {
  switch (status) {
    case 'draft':
      return 'on_hold';
    case 'sent':
      return 'open';
    default:
      return 'finished';
  }
}

function SortableHeader({
  label,
  column,
  sortKey,
  sortDir,
  onSort,
  className,
}: {
  label: React.ReactNode;
  column: InvoiceSortKey;
  sortKey: InvoiceSortKey;
  sortDir: SortDir;
  onSort: (column: InvoiceSortKey) => void;
  className?: string;
}) {
  const active = sortKey === column;
  return (
    <th className={className}>
      <button
        type="button"
        className={`data-table-sort ${active ? 'data-table-sort--active' : ''}`}
        onClick={() => onSort(column)}
      >
        <span>{label}</span>
        <span className="data-table-sort-indicator" aria-hidden>
          {active ? (sortDir === 'asc' ? '↑' : '↓') : ''}
        </span>
      </button>
    </th>
  );
}

export function InvoicesAdminPage() {
  const { t } = useLingui();
  const { availableCompanies, companyById } = useOutletContext<PortalContext>();
  const [searchParams] = useSearchParams();

  const paramCompany = searchParams.get('company');
  const [excludedCompanyIds, setExcludedCompanyIds] = useState<Set<string>>(() => {
    if (!paramCompany) return new Set();
    return new Set(availableCompanies.map((c) => c.$id).filter((id) => id !== paramCompany));
  });
  const [excludedStatuses, setExcludedStatuses] = useState<Set<InvoiceStatus>>(new Set());
  const [sortKey, setSortKey] = useState<InvoiceSortKey>('period');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [expandedRowIds, setExpandedRowIds] = useState<Set<string>>(new Set());

  function toggleRowExpanded(invoiceId: string) {
    setExpandedRowIds((prev) => {
      const next = new Set(prev);
      if (next.has(invoiceId)) next.delete(invoiceId);
      else next.add(invoiceId);
      return next;
    });
  }

  const { data: rawInvoices = [], isLoading } = useInvoices();

  const invoices = useMemo(
    () =>
      rawInvoices.filter((invoice) => {
        if (excludedCompanyIds.has(invoice.companyId)) return false;
        if (excludedStatuses.has(invoice.status)) return false;
        return true;
      }),
    [rawInvoices, excludedCompanyIds, excludedStatuses],
  );

  function handleSort(column: InvoiceSortKey) {
    if (sortKey !== column) {
      setSortKey(column);
      setSortDir(column === 'invoiceNumber' || column === 'company' || column === 'status' ? 'asc' : 'desc');
      return;
    }
    setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
  }

  const sortedInvoices = useMemo(() => {
    return invoices.slice().sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'issueDate':
          cmp = (a.issueDate ?? a.$createdAt).localeCompare(b.issueDate ?? b.$createdAt);
          break;
        case 'invoiceNumber':
          cmp = (a.invoiceNumber ?? '').localeCompare(b.invoiceNumber ?? '', 'nl');
          break;
        case 'company':
          cmp = (companyById(a.companyId)?.name ?? a.companyId).localeCompare(
            companyById(b.companyId)?.name ?? b.companyId,
            'nl',
          );
          break;
        case 'period':
          cmp = (a.periodStart ?? '').localeCompare(b.periodStart ?? '');
          break;
        case 'hours':
          cmp = a.totalHours - b.totalHours;
          break;
        case 'amount':
          cmp = (a.totalWithVat ?? a.totalAmount) - (b.totalWithVat ?? b.totalAmount);
          break;
        case 'dueDate':
          cmp = (a.dueDate ?? '').localeCompare(b.dueDate ?? '');
          break;
        case 'status':
          cmp = statusLabel(a.status).localeCompare(statusLabel(b.status), 'nl');
          break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [invoices, sortKey, sortDir, companyById]);

  const INVOICE_STATUS_OPTIONS: { id: InvoiceStatus; label: string }[] = useMemo(
    () => [
      { id: 'draft', label: t`Concept` },
      { id: 'sent', label: t`Verzonden` },
      { id: 'void', label: t`Vervallen` },
    ],
    [t],
  );

  const invoiceCompanyIds = useMemo(() => new Set(rawInvoices.map((inv) => inv.companyId)), [rawInvoices]);
  const companyFilterOptions = useMemo(
    () =>
      availableCompanies
        .filter((c) => invoiceCompanyIds.has(c.$id))
        .map((c) => ({ id: c.$id, label: c.name })),
    [availableCompanies, invoiceCompanyIds],
  );

  const invoiceStatuses = useMemo(() => new Set(rawInvoices.map((inv) => inv.status)), [rawInvoices]);
  const statusFilterOptions = useMemo(
    () => INVOICE_STATUS_OPTIONS.filter((opt) => invoiceStatuses.has(opt.id)),
    [INVOICE_STATUS_OPTIONS, invoiceStatuses],
  );

  return (
    <div className="content-card">
      <div className="content-inner">
        <PageHeader
          title={<Trans>Facturen</Trans>}
          description={<Trans>Alle facturen.</Trans>}
          breadcrumb={
            <PageBreadcrumb
              items={[{ label: t`Dashboard`, to: '/app/dashboard' }, { label: t`Facturen` }]}
            />
          }
          actions={<CompanyScopeControl />}
        />

        <div className="tab-panel-body">
                <div className="filter-bar">
                  <div className="filter-group">
                    {companyFilterOptions.length > 1 && (
                      <label>
                        <span><Trans>Bedrijf</Trans></span>
                        <CheckboxFilterDropdown
                          options={companyFilterOptions}
                          excludedIds={excludedCompanyIds}
                          onToggle={(id) =>
                            setExcludedCompanyIds((prev) => {
                              const next = new Set(prev);
                              if (next.has(id)) next.delete(id);
                              else next.add(id);
                              return next;
                            })
                          }
                          onSelectAll={() => setExcludedCompanyIds(new Set())}
                          onSelectNone={() => setExcludedCompanyIds(new Set(companyFilterOptions.map((c) => c.id)))}
                          labelPlural={t`bedrijven`}
                        />
                      </label>
                    )}
                    {statusFilterOptions.length > 1 && (
                      <label>
                        <span><Trans>Status</Trans></span>
                        <CheckboxFilterDropdown
                          options={statusFilterOptions}
                          excludedIds={excludedStatuses}
                          onToggle={(id) =>
                            setExcludedStatuses((prev) => {
                              const next = new Set(prev);
                              if (next.has(id)) next.delete(id);
                              else next.add(id);
                              return next;
                            })
                          }
                          onSelectAll={() => setExcludedStatuses(new Set())}
                          onSelectNone={() => setExcludedStatuses(new Set(statusFilterOptions.map((s) => s.id)))}
                          labelPlural={t`statussen`}
                        />
                      </label>
                    )}
                  </div>
                  <div className="filter-group filter-group--end">
                    <Link className="btn-accent" to="/app/invoices/new">
                      <Plus size={16} /> <Trans>Add New Invoice</Trans>
                    </Link>
                  </div>
                </div>

                {isLoading ? (
                  <p><Trans>Laden…</Trans></p>
                ) : invoices.length === 0 ? (
                  <p className="empty-state"><Trans>Nog geen facturen.</Trans></p>
                ) : (
                  <div className="data-table-wrap">
                    <table className="data-table invoices-table data-table--collapsible">
                      <thead>
                        <tr>
                          <SortableHeader
                            label={<Trans>Aangemaakt</Trans>}
                            column="issueDate"
                            sortKey={sortKey}
                            sortDir={sortDir}
                            onSort={handleSort}
                          />
                          <SortableHeader
                            label={<Trans>Factuur</Trans>}
                            column="invoiceNumber"
                            sortKey={sortKey}
                            sortDir={sortDir}
                            onSort={handleSort}
                            className="data-table-col-invoice-number"
                          />
                          <SortableHeader
                            label={<Trans>Bedrijf</Trans>}
                            column="company"
                            sortKey={sortKey}
                            sortDir={sortDir}
                            onSort={handleSort}
                          />
                          <SortableHeader
                            label={<Trans>Periode</Trans>}
                            column="period"
                            sortKey={sortKey}
                            sortDir={sortDir}
                            onSort={handleSort}
                          />
                          <SortableHeader
                            label={<Trans>Uren</Trans>}
                            column="hours"
                            sortKey={sortKey}
                            sortDir={sortDir}
                            onSort={handleSort}
                            className="data-table-num"
                          />
                          <SortableHeader
                            label={<Trans>Bedrag</Trans>}
                            column="amount"
                            sortKey={sortKey}
                            sortDir={sortDir}
                            onSort={handleSort}
                            className="data-table-num"
                          />
                          <SortableHeader
                            label={<Trans>Vervaldag</Trans>}
                            column="dueDate"
                            sortKey={sortKey}
                            sortDir={sortDir}
                            onSort={handleSort}
                          />
                          <SortableHeader
                            label={<Trans>Status</Trans>}
                            column="status"
                            sortKey={sortKey}
                            sortDir={sortDir}
                            onSort={handleSort}
                          />
                        </tr>
                      </thead>
                      <tbody>
                        {sortedInvoices.map((invoice) => {
                          const expanded = expandedRowIds.has(invoice.$id);
                          return (
                            <tr key={invoice.$id} className={expanded ? 'data-table-row--expanded' : ''}>
                              <td>
                                <div className="data-table-title-cell">
                                  <div className="data-table-title-row">
                                    <Link
                                      className="data-table-title-button"
                                      to={
                                        invoice.status === 'draft'
                                          ? `/app/invoices/${invoice.$id}/edit`
                                          : `/app/invoices/${invoice.$id}`
                                      }
                                    >
                                      {invoice.invoiceNumber ?? t`Concept`}
                                    </Link>
                                    {invoice.creditForInvoiceId && (
                                      <span className="badge badge-credit-note"><Trans>Creditnota</Trans></span>
                                    )}
                                    <span className="data-table-muted">
                                      {dayjs(invoice.issueDate ?? invoice.$createdAt).format('D MMM YYYY')}
                                    </span>
                                  </div>
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
                              <td data-label={t`Aangemaakt`} className="data-table-muted">
                                {dayjs(invoice.issueDate ?? invoice.$createdAt).format('D MMM YYYY')}
                              </td>
                              <td data-label={t`Bedrijf`}>{companyById(invoice.companyId)?.name ?? invoice.companyId}</td>
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
                              <td className="data-table-num" data-label={t`Uren`}>
                                {invoice.creditForInvoiceId ? '-' : ''}
                                {formatHours(invoice.totalHours)}
                              </td>
                              <td className="data-table-num" data-label={t`Bedrag`}>
                                {invoice.creditForInvoiceId ? '-' : ''}
                                {formatAmount(invoice.totalWithVat ?? invoice.totalAmount, invoice.currency)}
                              </td>
                              <td className="data-table-muted" data-label={t`Vervaldag`}>
                                {invoice.dueDate ? dayjs(invoice.dueDate).format('D MMM YYYY') : '—'}
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
    </div>
  );
}
