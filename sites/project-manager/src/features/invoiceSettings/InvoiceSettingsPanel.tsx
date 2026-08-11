import { useEffect, useRef, useState } from 'react';
import { Trans, useLingui } from '@lingui/react/macro';
import { IconCheck } from '../../components/icons';
import { useInvoiceSettings, useUpdateInvoiceSettings } from './hooks';

interface FormState {
  senderName: string;
  senderAddress: string;
  senderPostalCode: string;
  senderCity: string;
  senderCountry: string;
  senderVatNumber: string;
  senderRegistrationNumber: string;
  contactPerson: string;
  contactPhone: string;
  contactEmail: string;
  contactWebsite: string;
  bankName: string;
  bankIban: string;
  bankSwiftBic: string;
  vatEnabled: boolean;
  vatRate: string;
  vatLabel: string;
  paymentTermDays: string;
  currency: string;
  footerText: string;
  defaultInstructionsText: string;
  creditFooterText: string;
  creditInstructionsText: string;
}

const EMPTY_FORM: FormState = {
  senderName: '',
  senderAddress: '',
  senderPostalCode: '',
  senderCity: '',
  senderCountry: '',
  senderVatNumber: '',
  senderRegistrationNumber: '',
  contactPerson: '',
  contactPhone: '',
  contactEmail: '',
  contactWebsite: '',
  bankName: '',
  bankIban: '',
  bankSwiftBic: '',
  vatEnabled: true,
  vatRate: '21',
  vatLabel: 'BTW',
  paymentTermDays: '30',
  currency: 'EUR',
  footerText: '',
  defaultInstructionsText: '',
  creditFooterText: '',
  creditInstructionsText: '',
};

type SettingsTab = 'company' | 'contact' | 'bank' | 'vat' | 'texts';

export function InvoiceSettingsPanel() {
  const { t } = useLingui();
  const { data: settings, isLoading } = useInvoiceSettings();
  const updateSettings = useUpdateInvoiceSettings();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [activeTab, setActiveTab] = useState<SettingsTab>('company');
  const [saved, setSaved] = useState(false);
  const hydratedRef = useRef(false);

  useEffect(() => {
    // Only hydrate once, from the first successful fetch — re-running on every background
    // refetch (window focus, staleTime elapsing) would silently overwrite in-progress edits
    // with stale server data before the user hits Save.
    if (!settings || hydratedRef.current) return;
    hydratedRef.current = true;
    setForm({
      senderName: settings.senderName ?? '',
      senderAddress: settings.senderAddress ?? '',
      senderPostalCode: settings.senderPostalCode ?? '',
      senderCity: settings.senderCity ?? '',
      senderCountry: settings.senderCountry ?? '',
      senderVatNumber: settings.senderVatNumber ?? '',
      senderRegistrationNumber: settings.senderRegistrationNumber ?? '',
      contactPerson: settings.contactPerson ?? '',
      contactPhone: settings.contactPhone ?? '',
      contactEmail: settings.contactEmail ?? '',
      contactWebsite: settings.contactWebsite ?? '',
      bankName: settings.bankName ?? '',
      bankIban: settings.bankIban ?? '',
      bankSwiftBic: settings.bankSwiftBic ?? '',
      vatEnabled: settings.vatEnabled ?? true,
      vatRate: settings.vatRate != null ? String(settings.vatRate) : '21',
      vatLabel: settings.vatLabel ?? 'BTW',
      paymentTermDays: settings.paymentTermDays != null ? String(settings.paymentTermDays) : '30',
      currency: settings.currency ?? 'EUR',
      footerText: settings.footerText ?? '',
      defaultInstructionsText: settings.defaultInstructionsText ?? '',
      creditFooterText: settings.creditFooterText ?? '',
      creditInstructionsText: settings.creditInstructionsText ?? '',
    });
  }, [settings]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await updateSettings.mutateAsync({
        senderName: form.senderName.trim() || null,
        senderAddress: form.senderAddress.trim() || null,
        senderPostalCode: form.senderPostalCode.trim() || null,
        senderCity: form.senderCity.trim() || null,
        senderCountry: form.senderCountry.trim() || null,
        senderVatNumber: form.senderVatNumber.trim() || null,
        senderRegistrationNumber: form.senderRegistrationNumber.trim() || null,
        contactPerson: form.contactPerson.trim() || null,
        contactPhone: form.contactPhone.trim() || null,
        contactEmail: form.contactEmail.trim() || null,
        contactWebsite: form.contactWebsite.trim() || null,
        bankName: form.bankName.trim() || null,
        bankIban: form.bankIban.trim() || null,
        bankSwiftBic: form.bankSwiftBic.trim() || null,
        vatEnabled: form.vatEnabled,
        vatRate: form.vatRate.trim() ? parseFloat(form.vatRate) : null,
        vatLabel: form.vatLabel.trim() || null,
        paymentTermDays: form.paymentTermDays.trim() ? parseInt(form.paymentTermDays, 10) : null,
        currency: form.currency.trim() || 'EUR',
        footerText: form.footerText.trim() || null,
        defaultInstructionsText: form.defaultInstructionsText.trim() || null,
        creditFooterText: form.creditFooterText.trim() || null,
        creditInstructionsText: form.creditInstructionsText.trim() || null,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : t`Opslaan mislukt.`);
    }
  }

  if (isLoading) {
    return <p><Trans>Laden…</Trans></p>;
  }

  return (
    <form className="form invoice-settings-form" onSubmit={(e) => void handleSubmit(e)}>
      <div className="text-tab-bar" style={{ marginBottom: '1.25rem' }}>
        <button
          type="button"
          className={`text-tab ${activeTab === 'company' ? 'active' : ''}`}
          onClick={() => setActiveTab('company')}
        >
          <Trans>Bedrijfsgegevens</Trans>
        </button>
        <button
          type="button"
          className={`text-tab ${activeTab === 'contact' ? 'active' : ''}`}
          onClick={() => setActiveTab('contact')}
        >
          <Trans>Contact</Trans>
        </button>
        <button
          type="button"
          className={`text-tab ${activeTab === 'bank' ? 'active' : ''}`}
          onClick={() => setActiveTab('bank')}
        >
          <Trans>Bankgegevens</Trans>
        </button>
        <button
          type="button"
          className={`text-tab ${activeTab === 'vat' ? 'active' : ''}`}
          onClick={() => setActiveTab('vat')}
        >
          <Trans>BTW & betaling</Trans>
        </button>
        <button
          type="button"
          className={`text-tab ${activeTab === 'texts' ? 'active' : ''}`}
          onClick={() => setActiveTab('texts')}
        >
          <Trans>Factuurteksten</Trans>
        </button>
      </div>

      <div className="invoice-settings-tab-body">
        {activeTab === 'company' && (
          <fieldset>
            <label>
              <Trans>Bedrijfsnaam</Trans>
              <input type="text" value={form.senderName} onChange={(e) => set('senderName', e.target.value)} />
            </label>
            <label>
              <Trans>Contactpersoon</Trans>
              <input type="text" value={form.contactPerson} onChange={(e) => set('contactPerson', e.target.value)} />
            </label>
            <label>
              <Trans>Adres</Trans>
              <input type="text" value={form.senderAddress} onChange={(e) => set('senderAddress', e.target.value)} />
            </label>
            <div className="form-row form-row-3">
              <label>
                <Trans>Postcode</Trans>
                <input
                  type="text"
                  value={form.senderPostalCode}
                  onChange={(e) => set('senderPostalCode', e.target.value)}
                />
              </label>
              <label>
                <Trans>Plaats</Trans>
                <input type="text" value={form.senderCity} onChange={(e) => set('senderCity', e.target.value)} />
              </label>
              <label>
                <Trans>Land</Trans>
                <input type="text" value={form.senderCountry} onChange={(e) => set('senderCountry', e.target.value)} />
              </label>
            </div>
            <label>
              <Trans>Ondernemingsnummer</Trans>
              <input
                type="text"
                value={form.senderRegistrationNumber}
                onChange={(e) => set('senderRegistrationNumber', e.target.value)}
              />
            </label>
          </fieldset>
        )}

        {activeTab === 'contact' && (
          <fieldset>
            <label>
              <Trans>Telefoon</Trans>
              <input type="tel" value={form.contactPhone} onChange={(e) => set('contactPhone', e.target.value)} />
            </label>
            <label>
              <Trans>E-mail</Trans>
              <input type="email" value={form.contactEmail} onChange={(e) => set('contactEmail', e.target.value)} />
            </label>
            <label>
              <Trans>Website</Trans>
              <input type="text" value={form.contactWebsite} onChange={(e) => set('contactWebsite', e.target.value)} />
            </label>
          </fieldset>
        )}

        {activeTab === 'bank' && (
          <fieldset>
            <label>
              <Trans>Banknaam</Trans>
              <input type="text" value={form.bankName} onChange={(e) => set('bankName', e.target.value)} />
            </label>
            <label>
              <Trans>IBAN</Trans>
              <input type="text" value={form.bankIban} onChange={(e) => set('bankIban', e.target.value)} />
            </label>
            <label>
              <Trans>SWIFT/BIC</Trans>
              <input type="text" value={form.bankSwiftBic} onChange={(e) => set('bankSwiftBic', e.target.value)} />
            </label>
          </fieldset>
        )}

        {activeTab === 'vat' && (
          <fieldset>
            <label className="radio-label">
              <input
                type="checkbox"
                checked={form.vatEnabled}
                onChange={(e) => set('vatEnabled', e.target.checked)}
              />
              <Trans>BTW toepassen op facturen</Trans>
            </label>
            <div className="form-row">
              <label>
                <Trans>BTW percentage (%)</Trans>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={form.vatRate}
                  onChange={(e) => set('vatRate', e.target.value)}
                  disabled={!form.vatEnabled}
                />
              </label>
              <label>
                <Trans>BTW label</Trans>
                <input type="text" value={form.vatLabel} onChange={(e) => set('vatLabel', e.target.value)} />
              </label>
            </div>
            <label>
              <Trans>BTW nummer</Trans>
              <input
                type="text"
                value={form.senderVatNumber}
                onChange={(e) => set('senderVatNumber', e.target.value)}
              />
            </label>
            <div className="form-row">
              <label>
                <Trans>Betalingstermijn (dagen)</Trans>
                <input
                  type="number"
                  step="1"
                  min="0"
                  value={form.paymentTermDays}
                  onChange={(e) => set('paymentTermDays', e.target.value)}
                />
              </label>
              <label>
                <Trans>Valuta</Trans>
                <input type="text" value={form.currency} onChange={(e) => set('currency', e.target.value)} />
              </label>
            </div>
          </fieldset>
        )}

        {activeTab === 'texts' && (
          <fieldset>
            <label>
              <Trans>Standaard instructietekst (boven op de factuur)</Trans>
              <textarea
                rows={3}
                value={form.defaultInstructionsText}
                onChange={(e) => set('defaultInstructionsText', e.target.value)}
              />
            </label>
            <label>
              <Trans>Voettekst (onder de totalen)</Trans>
              <textarea rows={3} value={form.footerText} onChange={(e) => set('footerText', e.target.value)} />
            </label>
            <p className="text-muted invoice-settings-placeholder-hint">
              <Trans>Vervangcodes:</Trans>{' '}
              <code>{'{{invoiceNumber}}'}</code>, <code>{'{{dueDate}}'}</code>,{' '}
              <code>{'{{totalAmount}}'}</code>, <code>{'{{bankAccountNumber}}'}</code>
            </p>

            <label>
              <Trans>Instructietekst voor creditnota&apos;s (boven op de creditnota)</Trans>
              <textarea
                rows={3}
                value={form.creditInstructionsText}
                onChange={(e) => set('creditInstructionsText', e.target.value)}
              />
            </label>
            <label>
              <Trans>Voettekst voor creditnota&apos;s (onder de totalen)</Trans>
              <textarea
                rows={3}
                value={form.creditFooterText}
                onChange={(e) => set('creditFooterText', e.target.value)}
              />
            </label>
            <p className="text-muted invoice-settings-placeholder-hint">
              <Trans>Vervangcodes:</Trans>{' '}
              <code>{'{{invoiceNumber}}'}</code>, <code>{'{{dueDate}}'}</code>,{' '}
              <code>{'{{totalAmount}}'}</code>, <code>{'{{bankAccountNumber}}'}</code>,{' '}
              <code>{'{{creditForInvoice}}'}</code>
            </p>
          </fieldset>
        )}
      </div>

      <div className="form-actions">
        <button type="submit" disabled={updateSettings.isPending}>
          <Trans>Opslaan</Trans>
        </button>
        {saved && (
          <span className="save-confirmation">
            {t`Opgeslagen`} <IconCheck />
          </span>
        )}
      </div>
    </form>
  );
}
