import { useEffect, useMemo, useState } from 'react';
import { Link, useOutletContext, useParams } from 'react-router-dom';
import { Trans, useLingui } from '@lingui/react/macro';
import { useCompany, useUpdateCompanyDetails } from '../features/companies/hooks';
import { useProjects } from '../features/projects/hooks';
import { useTasks } from '../features/tasks/hooks';
import { MembersList } from '../features/invites/MembersList';
import { IconCheck, IconChart, IconPackage, IconTasks } from '../components/icons';
import { PageHeader } from '../components/PageHeader';
import { PageBreadcrumb } from '../components/PageBreadcrumb';
import type { PortalContext } from '../layouts/PortalLayout';
import { formatHours } from '../lib/formatHours';

type Tab = 'details' | 'accounts';

export function ClientManagerPage() {
  const { t } = useLingui();
  const { companyId } = useParams<{ companyId: string }>();
  const { role } = useOutletContext<PortalContext>();
  const { data: company, isLoading } = useCompany(companyId);
  const [tab, setTab] = useState<Tab>('details');

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [vatNumber, setVatNumber] = useState('');
  const [hourlyRate, setHourlyRate] = useState('');
  const [saved, setSaved] = useState(false);

  const updateDetails = useUpdateCompanyDetails(companyId ?? '');
  const { data: projects = [] } = useProjects(companyId ?? '');
  const { data: tasks = [] } = useTasks(companyId ?? '', 'all');

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
    setPhone(company.phone ?? '');
    setVatNumber(company.vatNumber ?? '');
    setHourlyRate(company.hourlyRate != null ? String(company.hourlyRate) : '');
  }, [company]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !companyId) return;
    const trimmedRate = hourlyRate.trim();
    await updateDetails.mutateAsync({
      name: name.trim(),
      email: email.trim(),
      address: address.trim(),
      phone: phone.trim(),
      vatNumber: vatNumber.trim() || null,
      hourlyRate: trimmedRate ? parseFloat(trimmedRate) : null,
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
                <label>
                  <Trans>Telefoonnummer</Trans>
                  <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
                </label>
                <label>
                  <Trans>BTW / VAT nummer</Trans>
                  <input type="text" value={vatNumber} onChange={(e) => setVatNumber(e.target.value)} />
                </label>
                {role === 'admin' && (
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
