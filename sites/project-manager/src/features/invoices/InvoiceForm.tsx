import { useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useNavigate, useOutletContext } from 'react-router-dom';
import { FormProvider, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Trans, useLingui } from '@lingui/react/macro';
import type { PortalContext } from '../../layouts/PortalLayout';
import { PageHeader } from '../../components/PageHeader';
import { PageBreadcrumb } from '../../components/PageBreadcrumb';
import { IconTrash } from '../../components/icons';
import { useInvoiceSettings } from '../invoiceSettings/hooks';
import { canEditInvoice } from './invoiceAccess';
import { InvoiceItemRows } from './InvoiceItemRows';
import { AddApprovedHoursModal } from './AddApprovedHoursModal';
import {
  useCreateInvoiceDraft,
  useDeleteInvoiceDraft,
  useInvoice,
  useInvoiceItems,
  useReplaceInvoiceItems,
  useSendInvoice,
  useUpdateInvoiceDraft,
} from './hooks';
import { invoiceFormSchema, type InvoiceFormValues, type InvoiceItemFormValues } from './schema';
import type { InvoiceItemInput } from './api';

const PAYMENT_TERM_PRESETS = [0, 14, 30];

function computeTotals(items: InvoiceItemFormValues[] | undefined) {
  const vatGroups = new Map<number, number>();
  let subtotal = 0;
  for (const item of items ?? []) {
    const base = (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0);
    subtotal += base;
    const rate = Number(item.vatRate) || 0;
    vatGroups.set(rate, (vatGroups.get(rate) ?? 0) + base);
  }
  subtotal = Math.round(subtotal * 100) / 100;
  const vatRows = [...vatGroups.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([rate, base]) => ({ rate, amount: Math.round(base * rate) / 100 }));
  const vatAmount = Math.round(vatRows.reduce((sum, row) => sum + row.amount, 0) * 100) / 100;
  const total = Math.round((subtotal + vatAmount) * 100) / 100;
  return { subtotal, vatRows, vatAmount, total };
}

function itemsToFormValues(items: { $id: string; description: string; quantity: number; unitPrice: number; vatRate: number; sourceTimeEntryIds?: string[] | null }[]): InvoiceItemFormValues[] {
  return items.map((item) => ({
    id: item.$id,
    description: item.description,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    vatRate: item.vatRate,
    sourceTimeEntryIds: item.sourceTimeEntryIds ?? [],
  }));
}

interface InvoiceFormProps {
  /** Present when editing an already-persisted draft; absent when composing a brand-new invoice. */
  invoiceId?: string;
}

export function InvoiceForm({ invoiceId: routeInvoiceId }: InvoiceFormProps) {
  const { t } = useLingui();
  const navigate = useNavigate();
  const { role, availableCompanies, companyById } = useOutletContext<PortalContext>();
  const { data: settings, isLoading: settingsLoading } = useInvoiceSettings();
  const { data: existingInvoice, isLoading: invoiceLoading } = useInvoice(routeInvoiceId);
  const { data: existingItems = [], isLoading: itemsLoading } = useInvoiceItems(routeInvoiceId);

  const [invoiceId, setInvoiceId] = useState<string | undefined>(routeInvoiceId);
  const [isHoursModalOpen, setHoursModalOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const hydratedRef = useRef(false);

  const createDraft = useCreateInvoiceDraft();
  const updateDraft = useUpdateInvoiceDraft();
  const replaceItems = useReplaceInvoiceItems();
  const sendInvoiceMutation = useSendInvoice();
  const deleteDraft = useDeleteInvoiceDraft();

  const methods = useForm<InvoiceFormValues>({
    resolver: zodResolver(invoiceFormSchema),
    defaultValues: { companyId: '', paymentTermDays: 30, instructionsText: '', footerText: '', items: [] },
  });
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    getValues,
    formState: { isSubmitting, errors },
  } = methods;

  useEffect(() => {
    if (hydratedRef.current) return;
    if (routeInvoiceId) {
      if (invoiceLoading || itemsLoading || !existingInvoice) return;
      hydratedRef.current = true;
      methods.reset({
        companyId: existingInvoice.companyId,
        paymentTermDays: existingInvoice.paymentTermDays ?? settings?.paymentTermDays ?? 30,
        instructionsText: existingInvoice.instructionsText ?? '',
        footerText: existingInvoice.footerText ?? '',
        items: itemsToFormValues(existingItems),
      });
      return;
    }
    if (settingsLoading) return;
    hydratedRef.current = true;
    methods.reset({
      companyId: '',
      paymentTermDays: settings?.paymentTermDays ?? 30,
      instructionsText: settings?.defaultInstructionsText ?? '',
      footerText: settings?.footerText ?? '',
      items: [],
    });
  }, [routeInvoiceId, invoiceLoading, itemsLoading, existingInvoice, existingItems, settings, settingsLoading, methods]);

  const watchedCompanyId = watch('companyId');
  const watchedItems = watch('items');
  const paymentTermDaysValue = watch('paymentTermDays');

  useEffect(() => {
    if (routeInvoiceId) return;
    if (!watchedCompanyId) return;
    const company = companyById(watchedCompanyId);
    if (!company) return;
    setValue('footerText', company.generalTerms ?? settings?.footerText ?? '');
    setValue('paymentTermDays', company.paymentTermDays ?? settings?.paymentTermDays ?? 30);
  }, [routeInvoiceId, watchedCompanyId, companyById, settings, setValue]);

  const selectedCompany = companyById(watchedCompanyId);
  const currency = settings?.currency ?? 'EUR';
  const vatRateHigh = settings?.vatRateHigh ?? 21;
  const vatRateLow = settings?.vatRateLow ?? 9;
  const vatLabel = settings?.vatLabel ?? 'BTW';

  const totals = useMemo(() => computeTotals(watchedItems), [watchedItems]);
  const excludeEntryIds = useMemo(
    () => new Set(watchedItems?.flatMap((item) => item.sourceTimeEntryIds ?? []) ?? []),
    [watchedItems],
  );
  const isCustomPaymentTerm = !PAYMENT_TERM_PRESETS.includes(paymentTermDaysValue);

  async function persist(values: InvoiceFormValues): Promise<string> {
    let id = invoiceId;
    const draftData = {
      companyId: values.companyId,
      paymentTermDays: values.paymentTermDays,
      instructionsText: values.instructionsText?.trim() || null,
      footerText: values.footerText?.trim() || null,
    };
    if (!id) {
      const created = await createDraft.mutateAsync({ ...draftData, currency });
      id = created.$id;
      setInvoiceId(id);
    } else {
      await updateDraft.mutateAsync({ invoiceId: id, data: draftData });
    }

    const itemsInput: InvoiceItemInput[] = values.items.map((item, index) => ({
      id: item.id,
      description: item.description,
      quantity: Number(item.quantity),
      unitPrice: Number(item.unitPrice),
      vatRate: Number(item.vatRate),
      order: index,
      sourceTimeEntryIds: item.sourceTimeEntryIds,
    }));
    const savedItems = await replaceItems.mutateAsync({ invoiceId: id, companyId: values.companyId, items: itemsInput });
    setValue('items', itemsToFormValues(savedItems));

    return id;
  }

  async function handleSaveDraft() {
    setFormError(null);
    setSaved(false);
    const values = getValues();
    if (!values.companyId) {
      setFormError(t`Kies eerst een klant.`);
      return;
    }
    try {
      const wasNew = !invoiceId;
      const id = await persist(values);
      if (wasNew) {
        navigate(`/app/invoices/${id}/edit`, { replace: true });
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : t`Opslaan mislukt.`);
    }
  }

  async function onSubmitSend(values: InvoiceFormValues) {
    setFormError(null);
    try {
      const id = await persist(values);
      await sendInvoiceMutation.mutateAsync(id);
      navigate(`/app/invoices/${id}`);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : t`Verzenden mislukt.`);
    }
  }

  async function handleDeleteDraft() {
    if (!invoiceId) return;
    if (!confirm(t`Dit concept verwijderen? Gekoppelde uren komen weer beschikbaar voor facturatie.`)) return;
    await deleteDraft.mutateAsync(invoiceId);
    navigate('/app/invoices');
  }

  const isBusy = isSubmitting || createDraft.isPending || updateDraft.isPending || replaceItems.isPending || sendInvoiceMutation.isPending;

  if (routeInvoiceId && !invoiceLoading && existingInvoice && !canEditInvoice(existingInvoice, role)) {
    return <Navigate to={`/app/invoices/${routeInvoiceId}`} replace />;
  }

  if (routeInvoiceId && (invoiceLoading || itemsLoading || !hydratedRef.current)) {
    return (
      <div className="content-card">
        <div className="content-inner">
          <Trans>Laden…</Trans>
        </div>
      </div>
    );
  }

  const isExistingSent = existingInvoice?.status === 'sent';
  const pageTitle = routeInvoiceId
    ? isExistingSent
      ? existingInvoice?.invoiceNumber
        ? t`Factuur ${existingInvoice.invoiceNumber} bewerken`
        : t`Factuur bewerken`
      : existingInvoice?.invoiceNumber ?? t`Conceptfactuur`
    : t`Nieuwe factuur`;

  return (
    <div className="content-card">
      <div className="content-inner">
        <PageHeader
          title={pageTitle}
          breadcrumb={
            <PageBreadcrumb
              items={[
                { label: t`Dashboard`, to: '/app/dashboard' },
                { label: t`Facturen`, to: '/app/invoices' },
                ...(isExistingSent && existingInvoice
                  ? [
                      {
                        label: existingInvoice.invoiceNumber ?? t`Factuur`,
                        to: `/app/invoices/${existingInvoice.$id}`,
                      },
                      { label: t`Bewerken` },
                    ]
                  : [{ label: routeInvoiceId ? t`Bewerken` : t`Nieuw` }]),
              ]}
            />
          }
        />

        <FormProvider {...methods}>
          <form className="form invoice-form" onSubmit={handleSubmit(onSubmitSend)}>
            <section className="report-card">
              <div className="form-row">
                <label>
                  <Trans>Klant</Trans>
                  <select {...register('companyId')} required>
                    <option value="" disabled>
                      {t`Kies een klant`}
                    </option>
                    {availableCompanies.map((company) => (
                      <option key={company.$id} value={company.$id}>
                        {company.name}
                      </option>
                    ))}
                  </select>
                  {errors.companyId && <span className="form-error">{t`Kies een klant`}</span>}
                </label>

                <label>
                  <Trans>Betalingstermijn</Trans>
                  <select
                    value={isCustomPaymentTerm ? 'custom' : String(paymentTermDaysValue)}
                    onChange={(e) => {
                      if (e.target.value === 'custom') {
                        setValue('paymentTermDays', paymentTermDaysValue || 7);
                      } else {
                        setValue('paymentTermDays', Number(e.target.value));
                      }
                    }}
                  >
                    <option value="0">{t`Direct`}</option>
                    <option value="14">Net 14</option>
                    <option value="30">Net 30</option>
                    <option value="custom">{t`Aangepast`}</option>
                  </select>
                </label>

                {isCustomPaymentTerm && (
                  <label>
                    <Trans>Aantal dagen</Trans>
                    <input
                      type="number"
                      min={0}
                      max={365}
                      {...register('paymentTermDays', { valueAsNumber: true })}
                    />
                  </label>
                )}
              </div>

              <label>
                <Trans>Standaard instructietekst</Trans>
                <textarea rows={3} {...register('instructionsText')} />
              </label>
              <label>
                <Trans>Voettekst</Trans>
                <textarea rows={3} {...register('footerText')} />
              </label>
            </section>

            <section className="report-card">
              <div className="report-card-header">
                <h3>
                  <Trans>Factuurregels</Trans>
                </h3>
                <button
                  type="button"
                  className="btn-accent"
                  disabled={!watchedCompanyId}
                  onClick={() => setHoursModalOpen(true)}
                >
                  <Trans>Voeg goedgekeurde uren toe</Trans>
                </button>
              </div>
              <InvoiceItemRows vatRateHigh={vatRateHigh} vatRateLow={vatRateLow} currency={currency} />
              {errors.items && !Array.isArray(errors.items) && (
                <p className="form-error">{t`Voeg minimaal één factuurregel toe.`}</p>
              )}
            </section>

            <section className="report-card">
              <dl className="invoice-detail-fields">
                <div>
                  <dt>
                    <Trans>Subtotaal</Trans>
                  </dt>
                  <dd>
                    {currency} {totals.subtotal.toFixed(2)}
                  </dd>
                </div>
                {totals.vatRows.map((row) => (
                  <div key={row.rate}>
                    <dt>
                      {vatLabel} ({row.rate}%)
                    </dt>
                    <dd>
                      {currency} {row.amount.toFixed(2)}
                    </dd>
                  </div>
                ))}
                <div className="invoice-detail-total">
                  <dt>
                    <Trans>Totaal</Trans>
                  </dt>
                  <dd>
                    {currency} {totals.total.toFixed(2)}
                  </dd>
                </div>
              </dl>
            </section>

            {formError && <p className="form-error">{formError}</p>}

            <div className="form-actions">
              <button type="button" onClick={() => void handleSaveDraft()} disabled={isBusy}>
                {isExistingSent ? <Trans>Wijzigingen opslaan</Trans> : <Trans>Save as Draft</Trans>}
              </button>
              <button type="submit" className="btn-accent" disabled={isBusy}>
                {isExistingSent ? <Trans>Opslaan en opnieuw verzenden</Trans> : <Trans>Send to Client</Trans>}
              </button>
              {saved && <span className="save-confirmation"><Trans>Opgeslagen</Trans></span>}
              {invoiceId && existingInvoice?.status === 'draft' && (
                <button type="button" onClick={() => void handleDeleteDraft()} disabled={isBusy}>
                  <IconTrash /> <Trans>Concept verwijderen</Trans>
                </button>
              )}
              <button
                type="button"
                onClick={() =>
                  navigate(isExistingSent && routeInvoiceId ? `/app/invoices/${routeInvoiceId}` : '/app/invoices')
                }
                disabled={isBusy}
              >
                <Trans>Annuleren</Trans>
              </button>
            </div>
          </form>
        </FormProvider>

        {isHoursModalOpen && selectedCompany && (
          <AddApprovedHoursModal
            company={selectedCompany}
            invoiceId={invoiceId}
            excludeEntryIds={excludeEntryIds}
            defaultVatRate={vatRateHigh}
            onClose={() => setHoursModalOpen(false)}
            onAdd={(items) => {
              setValue('items', [...(getValues('items') ?? []), ...items]);
            }}
          />
        )}
      </div>
    </div>
  );
}
