import { Link } from 'react-router-dom';
import { ArrowRight, Receipt } from 'lucide-react';
import { Trans, useLingui } from '@lingui/react/macro';
import type { CompanyRow, InvoiceStatus, ResolvedRole } from '../../appwrite/types';
import type { DashboardFinancialStats } from './useDashboardPageData';

const MAX_INVOICES = 5;

interface DashboardFinancialCardProps {
  role: ResolvedRole;
  financialStats: DashboardFinancialStats;
  companyById: (companyId: string) => CompanyRow | undefined;
}

function formatCurrency(amount: number, currency = 'EUR') {
  return `${currency} ${amount.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function invoiceDetailPath(role: ResolvedRole, invoiceId: string) {
  return role === 'client' ? `/app/my-invoices/${invoiceId}` : `/app/invoices/${invoiceId}`;
}

function invoicesListPath(role: ResolvedRole) {
  return role === 'client' ? '/app/my-invoices' : '/app/invoices';
}

function invoiceStatusBadgeClass(status: InvoiceStatus): string {
  switch (status) {
    case 'draft':
      return 'on_hold';
    case 'sent':
      return 'open';
    case 'void':
      return 'finished';
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

export function DashboardFinancialCard({
  role,
  financialStats,
  companyById,
}: DashboardFinancialCardProps) {
  const { t } = useLingui();

  function statusLabel(status: InvoiceStatus) {
    switch (status) {
      case 'draft':
        return t`Concept`;
      case 'sent':
        return t`Verzonden`;
      case 'void':
        return t`Vervallen`;
      default: {
        const _exhaustive: never = status;
        return _exhaustive;
      }
    }
  }

  const invoices = financialStats.recentInvoices.slice(0, MAX_INVOICES);

  return (
    <article className="dashboard-v2-card">
      <header className="dashboard-v2-card-header">
        <Trans>Financieel overzicht</Trans>
      </header>
      <div className="dashboard-v2-card-body">
        <section className="dashboard-v2-card-section">
          <header className="dashboard-v2-card-section-header">
            <Receipt size={14} aria-hidden />
            <Trans>Nieuwste facturen</Trans>
          </header>
          <p className="dashboard-v2-card-description">
            <Trans>Recente facturen en totalen van openstaand en gefactureerd bedrag.</Trans>
          </p>
        </section>
        {invoices.length === 0 ? (
          <p className="dashboard-v2-empty"><Trans>Nog geen facturen.</Trans></p>
        ) : (
          <>
            <div className="dashboard-v2-invoice-list-header">
              <span><Trans>Factuurnummer</Trans></span>
              <span><Trans>Bedrijf</Trans></span>
              <span><Trans>Status</Trans></span>
              <span><Trans>Totaal</Trans></span>
            </div>
            <ul className="dashboard-v2-invoice-list">
              {invoices.map((invoice) => (
                <li key={invoice.id} className="dashboard-v2-invoice-row">
                  <Link
                    to={invoiceDetailPath(role, invoice.id)}
                    className="dashboard-v2-invoice-number"
                  >
                    {invoice.invoiceNumber}
                  </Link>
                  <span className="dashboard-v2-invoice-company">
                    {companyById(invoice.companyId)?.name ?? invoice.companyId}
                  </span>
                  <span
                    className={`badge badge-status--${invoiceStatusBadgeClass(invoice.status)} dashboard-v2-invoice-status`}
                  >
                    {statusLabel(invoice.status)}
                  </span>
                  <span className="dashboard-v2-invoice-amount">
                    {formatCurrency(invoice.totalAmount, invoice.currency)}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
        <div className="dashboard-v2-financial-totals">
          <span className="dashboard-v2-financial-total">
            <Trans>Openstaand:</Trans>
            <strong>{formatCurrency(financialStats.totalOutstanding, financialStats.currency)}</strong>
          </span>
          <span className="dashboard-v2-financial-total">
            <Trans>Gefactureerd:</Trans>
            <strong>{formatCurrency(financialStats.totalInvoiced, financialStats.currency)}</strong>
          </span>
        </div>
        <Link to={invoicesListPath(role)} className="dashboard-v2-card-action">
          <Trans>Bekijk facturen</Trans>
          <ArrowRight size={14} />
        </Link>
      </div>
    </article>
  );
}
