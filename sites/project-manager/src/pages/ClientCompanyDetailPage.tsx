import { useEffect, useState } from 'react';
import { Navigate, useOutletContext, useParams } from 'react-router-dom';
import { Trans, useLingui } from '@lingui/react/macro';
import { IconCheck } from '../components/icons';
import { PageHeader } from '../components/PageHeader';
import { PageBreadcrumb } from '../components/PageBreadcrumb';
import type { PortalContext } from '../layouts/PortalLayout';
import { useCompany, useUpdateCompanyContactDetails } from '../features/companies/hooks';
import { MembersList } from '../features/invites/MembersList';
import { COUNTRIES } from '../lib/countries';

type Tab = 'details' | 'invoicing' | 'accounts';

export function ClientCompanyDetailPage() {
  const { t } = useLingui();
  const { companyId } = useParams<{ companyId: string }>();
  const { role, availableCompanies } = useOutletContext<PortalContext>();
  const { data: company, isLoading } = useCompany(companyId);
  const updateDetails = useUpdateCompanyContactDetails(companyId ?? '');
  const [tab, setTab] = useState<Tab>('details');

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('');
  const [phone, setPhone] = useState('');
  const [vatNumber, setVatNumber] = useState('');
  const [invoiceEmail, setInvoiceEmail] = useState('');
  const [invoiceAddress, setInvoiceAddress] = useState('');
  const [invoicePostalCode, setInvoicePostalCode] = useState('');
  const [invoiceCity, setInvoiceCity] = useState('');
  const [invoiceCountry, setInvoiceCountry] = useState('');
  const [useDifferentInvoiceAddress, setUseDifferentInvoiceAddress] = useState(false);
  const [saved, setSaved] = useState(false);

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
    setInvoiceAddress(company.invoiceAddress ?? '');
    setInvoicePostalCode(company.invoicePostalCode ?? '');
    setInvoiceCity(company.invoiceCity ?? '');
    setInvoiceCountry(company.invoiceCountry ?? '');
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
    }
  }

  if (role !== 'client') {
    return <Navigate to="/app/dashboard" replace />;
  }

  if (!companyId || (availableCompanies.length > 0 && !availableCompanies.some((c) => c.$id === companyId))) {
    return <Navigate to="/app/company-settings" replace />;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !companyId) return;
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
      invoiceAddress: invoiceAddress.trim() || null,
      invoicePostalCode: invoicePostalCode.trim() || null,
      invoiceCity: invoiceCity.trim() || null,
      invoiceCountry: invoiceCountry.trim() || null,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  if (isLoading || !company) {
    return (
      <div className="content-card">
        <div className="content-inner">
          <p className="page-loading"><Trans>Laden…</Trans></p>
        </div>
      </div>
    );
  }

  return (
    <div className="content-card">
      <div className="content-inner">
        <PageHeader
          title={<Trans>Bedrijfsgegevens</Trans>}
          description={company.name}
          breadcrumb={
            <PageBreadcrumb
              items={[
                { label: t`Dashboard`, to: '/app/dashboard' },
                { label: t`Bedrijfsgegevens`, to: '/app/company-settings' },
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
                <span><Trans>Bedrijfsgegevens</Trans></span>
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

        <div className="tab-panel-body">
          {tab === 'details' ? (
            <form className="form client-details-form" onSubmit={(e) => void handleSubmit(e)}>
              <label>
                <Trans>Bedrijfsnaam</Trans>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} required />
              </label>
              <label>
                <Trans>E-mail</Trans>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </label>
              <label>
                <Trans>Adres</Trans>
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
                <Trans>Telefoon</Trans>
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
            <form
              className="form client-details-form client-details-form--wide"
              onSubmit={(e) => void handleSubmit(e)}
            >
              <div className="form-two-col">
                <div className="form-col">
                  <label>
                    <Trans>BTW / VAT Nummer</Trans>
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
                        <select value={invoiceCountry} onChange={(e) => setInvoiceCountry(e.target.value)}>
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
                </div>
              </div>
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
            <MembersList teamId={company.teamId} canRevoke={false} allowDirectAdd={false} />
          )}
        </div>
      </div>
    </div>
  );
}
