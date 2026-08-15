import { useEffect, useMemo, useState } from 'react';
import { Link, useOutletContext, useParams, useSearchParams } from 'react-router-dom';
import { Trans, useLingui } from '@lingui/react/macro';
import { useCompany, useUpdateCompanyDetails } from '../features/companies/hooks';
import { useInvoiceSettings } from '../features/invoiceSettings/hooks';
import { useProjects } from '../features/projects/hooks';
import { useTasks } from '../features/tasks/hooks';
import { MembersList } from '../features/invites/MembersList';
import { IconCheck, IconChart, IconPackage, IconTasks } from '../components/icons';
import { PageHeader } from '../components/PageHeader';
import { PageBreadcrumb } from '../components/PageBreadcrumb';
import type { PortalContext } from '../layouts/PortalLayout';
import { formatHours } from '../lib/formatHours';
import { COUNTRIES } from '../lib/countries';

type Tab = 'details' | 'invoicing' | 'accounts';

const VALID_TABS: Tab[] = ['details', 'invoicing', 'accounts'];

export function ClientManagerPage() {
  const { t } = useLingui();
  const { companyId } = useParams<{ companyId: string }>();
  const { role } = useOutletContext<PortalContext>();
  const { data: company, isLoading } = useCompany(companyId);
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get('tab');
  const [tab, setTab] = useState<Tab>(
    initialTab && VALID_TABS.includes(initialTab as Tab) ? (initialTab as Tab) : 'details',
  );

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('');
  const [phone, setPhone] = useState('');
  const [vatNumber, setVatNumber] = useState('');
  const [invoiceEmail, setInvoiceEmail] = useState('');
  const [hourlyRate, setHourlyRate] = useState('');
  const [autoApproveHours, setAutoApproveHours] = useState(false);
  const [generalTerms, setGeneralTerms] = useState('');
  const [paymentTermDays, setPaymentTermDays] = useState('');
  const [invoiceAddress, setInvoiceAddress] = useState('');
  const [invoicePostalCode, setInvoicePostalCode] = useState('');
  const [invoiceCity, setInvoiceCity] = useState('');
  const [invoiceCountry, setInvoiceCountry] = useState('');
  const [vatExempt, setVatExempt] = useState(false);
  const [useDifferentInvoiceAddress, setUseDifferentInvoiceAddress] = useState(false);
  const [saved, setSaved] = useState(false);

  const updateDetails = useUpdateCompanyDetails(companyId ?? '');
  const { data: projects = [] } = useProjects(companyId ?? '');
  const { data: tasks = [] } = useTasks(companyId ?? '', 'all');
  const { data: invoiceSettings } = useInvoiceSettings();

  const totalHours = useMemo(
    () =>
      tasks
        .filter((t) => (t.audience ?? 'internal') === 'internal')
        .reduce((sum, t) => sum + (t.hours ?? 0), 0),
    [tasks],
  );

  useEffect(() => {
    if (!company) return;
    setName(company.name);
    setEmail(company.email ?? '');
    setAddress(company.address ?? '');
    setPostalCode(company.postalCode ?? '');
    setCity(company.city ?? '');
    setCountry(company.country ?? '');
    setPhone(company.phone ?? '');
    setVatNumber(company.vatNumber ?? '');
    setInvoiceEmail(company.invoiceEmail ?? '');
    setHourlyRate(company.hourlyRate != null ? String(company.hourlyRate) : '');
    setAutoApproveHours(company.autoApproveHours ?? false);
    setGeneralTerms(company.generalTerms ?? '');
    setPaymentTermDays(company.paymentTermDays != null ? String(company.paymentTermDays) : '');
    setInvoiceAddress(company.invoiceAddress ?? '');
    setInvoicePostalCode(company.invoicePostalCode ?? '');
    setInvoiceCity(company.invoiceCity ?? '');
    setInvoiceCountry(company.invoiceCountry ?? '');
    setVatExempt(company.vatExempt ?? false);
    setUseDifferentInvoiceAddress(
      Boolean(
        company.invoiceAddress || company.invoicePostalCode || company.invoiceCity || company.invoiceCountry,
      ),
    );
  }, [company]);

  function handleDifferentInvoiceAddressToggle(checked: boolean) {
    setUseDifferentInvoiceAddress(checked);
    if (!checked) {
      setInvoiceAddress('');
      setInvoicePostalCode('');
      setInvoiceCity('');
      setInvoiceCountry('');
      setVatExempt(false);
    }
  }

  const senderCountry = invoiceSettings?.senderCountry?.trim() ?? '';
  const effectiveInvoiceCountry = (useDifferentInvoiceAddress ? invoiceCountry : country).trim();
  const showVatExemptOption =
    vatNumber.trim() !== '' &&
    effectiveInvoiceCountry !== '' &&
    senderCountry !== '' &&
    effectiveInvoiceCountry.toLowerCase() !== senderCountry.toLowerCase();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !companyId) return;
    const trimmedRate = hourlyRate.trim();
    const trimmedPaymentTermDays = paymentTermDays.trim();
    await updateDetails.mutateAsync({
      name: name.trim(),
      email: email.trim(),
      address: address.trim(),
      postalCode: postalCode.trim(),
      city: city.trim(),
      country: country.trim(),
      phone: phone.trim(),
      vatNumber: vatNumber.trim() || null,
      invoiceEmail: invoiceEmail.trim() || null,
      hourlyRate: trimmedRate ? parseFloat(trimmedRate) : null,
      autoApproveHours,
      generalTerms: generalTerms.trim() || null,
      paymentTermDays: trimmedPaymentTermDays ? parseInt(trimmedPaymentTermDays, 10) : null,
      invoiceAddress: invoiceAddress.trim() || null,
      invoicePostalCode: invoicePostalCode.trim() || null,
      invoiceCity: invoiceCity.trim() || null,
      invoiceCountry: invoiceCountry.trim() || null,
      vatExempt: showVatExemptOption ? vatExempt : false,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  if (isLoading || !company) {
    return (
      <div className="content-card">
        <div className="content-inner">
          <p className="forum-loading"><Trans>Laden…</Trans></p>
          <Link to="/app/manage" className="btn-link">
            <Trans>← Terug naar overzicht</Trans>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="content-card">
      <div className="content-inner">
        <PageHeader
          title={<Trans>Klantbeheer</Trans>}
          description={company.name}
          breadcrumb={
            <PageBreadcrumb
              items={[
                { label: t`Dashboard`, to: '/app/dashboard' },
                { label: t`Beheren`, to: '/app/manage' },
                { label: company.name },
              ]}
            />
          }
          tabs={
            <div className="task-view-tabs" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'details'}
                className={`task-view-tab${tab === 'details' ? ' active' : ''}`}
                onClick={() => setTab('details')}
              >
                <span><Trans>Klantgegevens</Trans></span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'invoicing'}
                className={`task-view-tab${tab === 'invoicing' ? ' active' : ''}`}
                onClick={() => setTab('invoicing')}
              >
                <span><Trans>Time Sheets & Invoicing</Trans></span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'accounts'}
                className={`task-view-tab${tab === 'accounts' ? ' active' : ''}`}
                onClick={() => setTab('accounts')}
              >
                <span><Trans>Accounts</Trans></span>
              </button>
            </div>
          }
        />

        <div className="stat-tiles">
          <div className="stat-tile">
            <span className="stat-tile-icon">
              <IconChart />
            </span>
            <div>
              <div className="stat-tile-value">{formatHours(totalHours)}</div>
              <div className="stat-tile-label"><Trans>Totaal uren</Trans></div>
            </div>
          </div>
          <div className="stat-tile">
            <span className="stat-tile-icon">
              <IconTasks />
            </span>
            <div>
              <div className="stat-tile-value">{tasks.length}</div>
              <div className="stat-tile-label"><Trans>Taken</Trans></div>
            </div>
          </div>
          <div className="stat-tile">
            <span className="stat-tile-icon">
              <IconPackage />
            </span>
            <div>
              <div className="stat-tile-value">{projects.length}</div>
              <div className="stat-tile-label"><Trans>Projecten</Trans></div>
            </div>
          </div>
        </div>

        <div className="tab-panel-body">
            {tab === 'details' ? (
              <form className="form client-details-form" onSubmit={handleSubmit}>
                <label>
                  <Trans>Klantnaam</Trans>
                  <input type="text" value={name} onChange={(e) => setName(e.target.value)} required />
                </label>
                <label>
                  <Trans>E-mail klant</Trans>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                </label>
                <label>
                  <Trans>Adres klant</Trans>
                  <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} />
                </label>
                <div className="form-row">
                  <label>
                    <Trans>Postcode</Trans>
                    <input type="text" value={postalCode} onChange={(e) => setPostalCode(e.target.value)} />
                  </label>
                  <label>
                    <Trans>Plaats</Trans>
                    <input type="text" value={city} onChange={(e) => setCity(e.target.value)} />
                  </label>
                </div>
                <label>
                  <Trans>Land</Trans>
                  <select value={country} onChange={(e) => setCountry(e.target.value)}>
                    <option value="">{t`Kies een land`}</option>
                    {COUNTRIES.map((countryOption) => (
                      <option key={countryOption} value={countryOption}>
                        {countryOption}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <Trans>Telefoonnummer</Trans>
                  <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
                </label>
                <div className="form-actions">
                  <button type="submit" disabled={updateDetails.isPending || !name.trim()}>
                    <Trans>Opslaan</Trans>
                  </button>
                  {saved && (
                    <span className="save-confirmation">
                      {t`Opgeslagen`} <IconCheck />
                    </span>
                  )}
                </div>
              </form>
            ) : tab === 'invoicing' ? (
              <form className="form client-details-form client-details-form--wide" onSubmit={handleSubmit}>
                {role === 'admin' ? (
                  <div className="form-two-col">
                    <div className="form-col">
                      <label>
                        <Trans>BTW / VAT nummer</Trans>
                        <input
                          type="text"
                          value={vatNumber}
                          onChange={(e) => setVatNumber(e.target.value)}
                        />
                      </label>
                      <label>
                        <Trans>E-mailadres facturen</Trans>
                        <input
                          type="email"
                          value={invoiceEmail}
                          onChange={(e) => setInvoiceEmail(e.target.value)}
                          placeholder={email}
                        />
                      </label>
                      <label>
                        <Trans>Uurtarief (€)</Trans>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={hourlyRate}
                          onChange={(e) => setHourlyRate(e.target.value)}
                        />
                      </label>
                      <label>
                        <Trans>Betalingstermijn (dagen)</Trans>
                        <input
                          type="number"
                          min={0}
                          max={365}
                          value={paymentTermDays}
                          onChange={(e) => setPaymentTermDays(e.target.value)}
                          placeholder={t`bijv. 30`}
                        />
                      </label>
                      <label className="checkbox-inline">
                        <input
                          type="checkbox"
                          checked={autoApproveHours}
                          onChange={(e) => setAutoApproveHours(e.target.checked)}
                        />
                        <Trans>Geboekte uren automatisch goedkeuren</Trans>
                      </label>
                      <label className="checkbox-inline">
                        <input
                          type="checkbox"
                          checked={useDifferentInvoiceAddress}
                          onChange={(e) => handleDifferentInvoiceAddressToggle(e.target.checked)}
                        />
                        <Trans>Afwijkend factuuradres opslaan</Trans>
                      </label>
                    </div>
                    <div className="form-col">
                      {useDifferentInvoiceAddress && (
                        <>
                          <label>
                            <Trans>Factuuradres</Trans>
                            <input
                              type="text"
                              value={invoiceAddress}
                              onChange={(e) => setInvoiceAddress(e.target.value)}
                            />
                          </label>
                          <div className="form-row">
                            <label>
                              <Trans>Postcode</Trans>
                              <input
                                type="text"
                                value={invoicePostalCode}
                                onChange={(e) => setInvoicePostalCode(e.target.value)}
                              />
                            </label>
                            <label>
                              <Trans>Plaats</Trans>
                              <input
                                type="text"
                                value={invoiceCity}
                                onChange={(e) => setInvoiceCity(e.target.value)}
                              />
                            </label>
                          </div>
                          <label>
                            <Trans>Land</Trans>
                            <select
                              value={invoiceCountry}
                              onChange={(e) => setInvoiceCountry(e.target.value)}
                            >
                              <option value="">{t`Kies een land`}</option>
                              {COUNTRIES.map((countryOption) => (
                                <option key={countryOption} value={countryOption}>
                                  {countryOption}
                                </option>
                              ))}
                            </select>
                          </label>
                        </>
                      )}
                      {showVatExemptOption && (
                        <label className="checkbox-inline">
                          <input
                            type="checkbox"
                            checked={vatExempt}
                            onChange={(e) => setVatExempt(e.target.checked)}
                          />
                          <Trans>Facturen versturen zonder BTW (verlegd)</Trans>
                        </label>
                      )}
                    </div>
                  </div>
                ) : (
                  <>
                    <label>
                      <Trans>BTW / VAT nummer</Trans>
                      <input type="text" value={vatNumber} onChange={(e) => setVatNumber(e.target.value)} />
                    </label>
                    <label>
                      <Trans>E-mailadres facturen</Trans>
                      <input
                        type="email"
                        value={invoiceEmail}
                        onChange={(e) => setInvoiceEmail(e.target.value)}
                        placeholder={email}
                      />
                    </label>
                  </>
                )}
                <div className="form-actions">
                  <button type="submit" disabled={updateDetails.isPending || !name.trim()}>
                    <Trans>Opslaan</Trans>
                  </button>
                  {saved && (
                    <span className="save-confirmation">
                      {t`Opgeslagen`} <IconCheck />
                    </span>
                  )}
                </div>
              </form>
            ) : (
              <MembersList teamId={company.teamId} />
            )}
        </div>
      </div>
    </div>
  );
}
