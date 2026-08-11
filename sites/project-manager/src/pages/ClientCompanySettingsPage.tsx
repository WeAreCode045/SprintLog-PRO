import { useEffect, useState } from 'react';
import { Navigate, useOutletContext } from 'react-router-dom';
import { Trans, useLingui } from '@lingui/react/macro';
import { IconCheck } from '../components/icons';
import { PageHeader } from '../components/PageHeader';
import { PageBreadcrumb } from '../components/PageBreadcrumb';
import type { PortalContext } from '../layouts/PortalLayout';
import { useCompany, useUpdateCompanyContactDetails } from '../features/companies/hooks';

export function ClientCompanySettingsPage() {
  const { t } = useLingui();
  const { role, enabledCompanyIds, availableCompanies } = useOutletContext<PortalContext>();
  const [companyId, setCompanyId] = useState(enabledCompanyIds[0] ?? '');
  const { data: company, isLoading } = useCompany(companyId);
  const updateDetails = useUpdateCompanyContactDetails(companyId);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [vatNumber, setVatNumber] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!company) return;
    setName(company.name);
    setEmail(company.email ?? '');
    setAddress(company.address ?? '');
    setPhone(company.phone ?? '');
    setVatNumber(company.vatNumber ?? '');
  }, [company]);

  if (role !== 'client') {
    return <Navigate to="/app/dashboard" replace />;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !companyId) return;
    await updateDetails.mutateAsync({
      name: name.trim(),
      email: email.trim(),
      address: address.trim(),
      phone: phone.trim(),
      vatNumber: vatNumber.trim() || null,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="content-card">
      <div className="content-inner">
        <PageHeader
          title={<Trans>Bedrijfsgegevens</Trans>}
          description={
            <Trans>
              Deze gegevens worden gebruikt op je facturen. Uurtarief wordt door de beheerder ingesteld.
            </Trans>
          }
          breadcrumb={
            <PageBreadcrumb
              items={[{ label: t`Dashboard`, to: '/app/dashboard' }, { label: t`Bedrijfsgegevens` }]}
            />
          }
        />

        {availableCompanies.length > 1 && (
          <div className="filter-bar">
            <div className="filter-group">
              <label>
                <Trans>Bedrijf</Trans>
                <select value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
                  {availableCompanies.map((c) => (
                    <option key={c.$id} value={c.$id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        )}

        {isLoading || !company ? (
          <p><Trans>Laden…</Trans></p>
        ) : (
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
            <label>
              <Trans>Telefoon</Trans>
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </label>
            <label>
              <Trans>BTW / VAT Nummer</Trans>
              <input type="text" value={vatNumber} onChange={(e) => setVatNumber(e.target.value)} />
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
        )}
      </div>
    </div>
  );
}
