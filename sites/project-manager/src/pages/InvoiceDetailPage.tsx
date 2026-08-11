import { lazy, Suspense } from 'react';
import { Link, Navigate, useNavigate, useOutletContext, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import { Download, RefreshCw, Undo2 } from 'lucide-react';
import { Trans, useLingui } from '@lingui/react/macro';
import { t as staticT } from '@lingui/core/macro';
import type { PortalContext } from '../layouts/PortalLayout';
import { PageBreadcrumb } from '../components/PageBreadcrumb';
import { PageHeader } from '../components/PageHeader';
import { getInvoicePdfUrl } from '../features/invoices/api';
import { useCreateCreditInvoice, useInvoice, useRegenerateInvoice } from '../features/invoices/hooks';
import { formatHours } from '../lib/formatHours';

// react-pdf (pdf.js) is a large dependency — keep it out of the main bundle so only
// visitors who actually open an invoice detail page pay for it.
const InvoicePdfViewer = lazy(() =>
  import('../features/invoices/InvoicePdfViewer').then((m) => ({ default: m.InvoicePdfViewer })),
);

function formatAmount(amount: number, currency: string) {
  return `${currency} ${amount.toFixed(2)}`;
}

function statusLabel(status: string) {
  return status === 'generated' ? staticT`Gegenereerd` : staticT`Vervallen`;
}

export function InvoiceDetailPage() {
  const { t } = useLingui();
  const navigate = useNavigate();
  const { invoiceId } = useParams<{ invoiceId: string }>();
  const { role, enabledCompanyIds, companyById } = useOutletContext<PortalContext>();
  const { data: invoice, isLoading } = useInvoice(invoiceId);
  const { data: originalInvoice } = useInvoice(invoice?.creditForInvoiceId ?? undefined);
  const { data: creditInvoice } = useInvoice(invoice?.creditedByInvoiceId ?? undefined);
  const createCreditInvoice = useCreateCreditInvoice();
  const regenerateInvoice = useRegenerateInvoice();

  const listPath = role === 'admin' ? '/app/invoices' : '/app/my-invoices';

  if (role !== 'admin' && role !== 'client') {
    return <Navigate to="/app/dashboard" replace />;
  }

  if (isLoading) {
    return (
      <div className="content-card">
        <div className="content-inner"><Trans>Laden…</Trans></div>
      </div>
    );
  }

  if (!invoice || (role === 'client' && !enabledCompanyIds.includes(invoice.companyId))) {
    return <Navigate to={listPath} replace />;
  }

  const company = companyById(invoice.companyId);
  const subtotal = invoice.totalAmount;
  const vatAmount = invoice.vatAmount ?? null;
  const total = invoice.totalWithVat ?? invoice.totalAmount;
  const canCreateCredit =
    role === 'admin' && !invoice.creditForInvoiceId && !invoice.creditedByInvoiceId && invoice.status !== 'void';
  const canRegenerate =
    role === 'admin' && !invoice.creditForInvoiceId && invoice.status !== 'void';

  async function handleCreateCredit() {
    if (!invoice) return;
    if (
      !confirm(
        t`Creditnota maken voor ${invoice.invoiceNumber}? De gefactureerde uren worden weer beschikbaar voor facturatie en de originele factuur wordt vervallen verklaard.`,
      )
    ) {
      return;
    }
    try {
      const result = await createCreditInvoice.mutateAsync(invoice.$id);
      navigate(`/app/invoices/${result.creditInvoiceId}`);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : t`Creditnota maken mislukt.`);
    }
  }

  async function handleRegenerate() {
    if (!invoice) return;
    if (
      !confirm(
        t`PDF opnieuw genereren voor ${invoice.invoiceNumber}? De PDF wordt vernieuwd met de huidige klantgegevens en factuurstyling. Factuurnummer en bedragen blijven gelijk.`,
      )
    ) {
      return;
    }
    try {
      await regenerateInvoice.mutateAsync(invoice.$id);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : t`Opnieuw genereren mislukt.`);
    }
  }

  return (
    <div className="content-card">
      <div className="content-inner">
        <PageHeader
          title={invoice.invoiceNumber}
          description={company?.name}
          breadcrumb={
            <PageBreadcrumb
              items={[
                { label: t`Dashboard`, to: '/app/dashboard' },
                { label: t`Facturen`, to: listPath },
                { label: invoice.invoiceNumber },
              ]}
            />
          }
        />

        <div className="invoice-detail-layout">
          <section className="report-card invoice-detail-summary">
            <div className="report-card-header">
              <h3><Trans>Factuurgegevens</Trans></h3>
              <span className={`badge badge-status--${invoice.status === 'generated' ? 'open' : 'finished'}`}>
                {statusLabel(invoice.status)}
              </span>
            </div>

            {invoice.creditForInvoiceId && (
              <p className="text-muted invoice-detail-credit-note">
                <Trans>
                  Creditnota voor factuur{' '}
                  {originalInvoice ? (
                    <Link to={`/app/invoices/${originalInvoice.$id}`}>{originalInvoice.invoiceNumber}</Link>
                  ) : (
                    invoice.creditForInvoiceId
                  )}
                </Trans>
              </p>
            )}
            {invoice.creditedByInvoiceId && (
              <p className="text-muted invoice-detail-credit-note">
                <Trans>
                  Gecrediteerd door{' '}
                  {creditInvoice ? (
                    <Link to={`/app/invoices/${creditInvoice.$id}`}>{creditInvoice.invoiceNumber}</Link>
                  ) : (
                    invoice.creditedByInvoiceId
                  )}
                </Trans>
              </p>
            )}

            <dl className="invoice-detail-fields">
              <div>
                <dt><Trans>Bedrijf</Trans></dt>
                <dd>{company?.name ?? invoice.companyId}</dd>
              </div>
              <div>
                <dt><Trans>Periode</Trans></dt>
                <dd>
                  {dayjs(invoice.periodStart).format('D MMM')} –{' '}
                  {dayjs(invoice.periodEnd).subtract(1, 'day').format('D MMM YYYY')}
                </dd>
              </div>
              {invoice.issueDate && (
                <div>
                  <dt><Trans>Factuurdatum</Trans></dt>
                  <dd>{dayjs(invoice.issueDate).format('D MMM YYYY')}</dd>
                </div>
              )}
              {invoice.dueDate && (
                <div>
                  <dt><Trans>Vervaldag</Trans></dt>
                  <dd>{dayjs(invoice.dueDate).format('D MMM YYYY')}</dd>
                </div>
              )}
              <div>
                <dt><Trans>Uren</Trans></dt>
                <dd>{formatHours(invoice.totalHours)}</dd>
              </div>
              <div>
                <dt><Trans>Uurtarief</Trans></dt>
                <dd>{formatAmount(invoice.hourlyRate, invoice.currency)}</dd>
              </div>
              <div>
                <dt><Trans>Subtotaal</Trans></dt>
                <dd>{formatAmount(subtotal, invoice.currency)}</dd>
              </div>
              {vatAmount != null && (
                <div>
                  <dt>{t`BTW`}{invoice.vatRate != null ? ` (${invoice.vatRate}%)` : ''}</dt>
                  <dd>{formatAmount(vatAmount, invoice.currency)}</dd>
                </div>
              )}
              <div className="invoice-detail-total">
                <dt><Trans>Totaal</Trans></dt>
                <dd>{formatAmount(total, invoice.currency)}</dd>
              </div>
            </dl>

            <div className="invoice-detail-actions">
              {invoice.pdfFileId && (
                <a
                  className="btn-accent invoice-detail-download"
                  href={getInvoicePdfUrl(invoice.pdfFileId)}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Download size={16} /> <Trans>PDF downloaden</Trans>
                </a>
              )}
              {(canRegenerate || canCreateCredit) && (
                <div className="form-row" style={{ width: '100%' }}>
                  {canRegenerate && (
                    <button
                      type="button"
                      onClick={() => void handleRegenerate()}
                      disabled={regenerateInvoice.isPending}
                    >
                      <RefreshCw size={16} />{' '}
                      {regenerateInvoice.isPending ? <Trans>Bezig…</Trans> : <Trans>PDF opnieuw genereren</Trans>}
                    </button>
                  )}
                  {canCreateCredit && (
                    <button
                      type="button"
                      onClick={() => void handleCreateCredit()}
                      disabled={createCreditInvoice.isPending}
                    >
                      <Undo2 size={16} />{' '}
                      {createCreditInvoice.isPending ? <Trans>Bezig…</Trans> : <Trans>Creditnota maken</Trans>}
                    </button>
                  )}
                </div>
              )}
            </div>
          </section>

          <section className="report-card invoice-detail-pdf">
            {invoice.pdfFileId ? (
              <Suspense fallback={<p className="empty-state"><Trans>PDF laden…</Trans></p>}>
                <InvoicePdfViewer fileId={invoice.pdfFileId} />
              </Suspense>
            ) : (
              <p className="empty-state"><Trans>PDF wordt gegenereerd…</Trans></p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
