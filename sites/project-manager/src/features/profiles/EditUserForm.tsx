import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Trans, useLingui } from '@lingui/react/macro';
import type { AdminUserCompany, AdminUserMembership, CompanyRow, GlobalRole } from '../../appwrite/types';
import { IconCheck, IconTrash } from '../../components/icons';
import { useAllCompanies } from '../companies/hooks';
import { CompanyAutocomplete } from './CompanyAutocomplete';
import { UserTeamsPanel } from './UserTeamsPanel';
import { useAdminUser, useDeleteAdminUser, useRevokeUserTeamMembership, useSaveAdminUser } from './hooks';

const ROLE_OPTIONS: GlobalRole[] = ['admin', 'developer', 'client'];

function adminCompanyToRow(company: AdminUserCompany): CompanyRow {
  return {
    $id: company.companyId,
    $sequence: '',
    $tableId: '',
    $databaseId: '',
    $createdAt: '',
    $updatedAt: '',
    $permissions: [],
    name: company.name,
    teamId: company.teamId,
  };
}

interface EditUserFormProps {
  userId: string;
  onCancel?: () => void;
  onDeleted?: () => void;
}

export function EditUserForm({ userId, onCancel, onDeleted }: EditUserFormProps) {
  const { t } = useLingui();

  const ROLE_LABELS: Record<GlobalRole, string> = {
    admin: t`Admin`,
    developer: t`Developer`,
    client: t`Klant`,
  };

  const { data: user, isLoading: userLoading, error: loadError } = useAdminUser(userId, true);
  const { data: companies = [], isLoading: companiesLoading } = useAllCompanies(true);
  const saveAdminUser = useSaveAdminUser();
  const deleteAdminUser = useDeleteAdminUser();
  const revokeMembership = useRevokeUserTeamMembership(userId);

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<GlobalRole>('developer');
  const [companyIds, setCompanyIds] = useState<string[]>([]);
  const [companiesDirty, setCompaniesDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const mergedCompanies = useMemo(() => {
    const map = new Map(companies.map((company) => [company.$id, company]));
    for (const linkedCompany of user?.companies ?? []) {
      if (!map.has(linkedCompany.companyId)) {
        map.set(linkedCompany.companyId, adminCompanyToRow(linkedCompany));
      }
    }
    return Array.from(map.values());
  }, [companies, user?.companies]);

  useEffect(() => {
    if (!user) return;
    setDisplayName(user.displayName);
    setEmail(user.email);
    setRole(user.role);
    setCompanyIds(user.companies.map((company) => company.companyId));
    setCompaniesDirty(false);
  }, [user]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!displayName.trim() || !email.trim()) {
      setError(t`Naam en e-mail zijn verplicht.`);
      return;
    }
    setError(null);
    try {
      await saveAdminUser.mutateAsync({
        userId,
        displayName: displayName.trim(),
        email: email.trim(),
        role,
        ...(role === 'client' && (user || companiesDirty) ? { companyIds } : {}),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t`Opslaan mislukt`);
    }
  }

  async function handleRevokeMembership(membership: AdminUserMembership) {
    if (!confirm(t`${membership.teamName} verwijderen uit dit team?`)) return;
    setError(null);
    try {
      await revokeMembership.mutateAsync({ teamId: membership.teamId, membershipId: membership.membershipId });
    } catch (revokeError) {
      setError(revokeError instanceof Error ? revokeError.message : t`Verwijderen uit team mislukt`);
    }
  }

  async function handleDelete() {
    if (!user) return;
    const label = user.displayName || user.email || user.userId;
    if (!confirm(t`Gebruiker “${label}” permanent verwijderen?`)) return;
    setError(null);
    try {
      await deleteAdminUser.mutateAsync(userId);
      onDeleted?.();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : t`Verwijderen mislukt`);
    }
  }

  if (userLoading) {
    return <p><Trans>Laden…</Trans></p>;
  }

  if (loadError || !user) {
    return (
      <p className="form-error">
        {loadError instanceof Error ? loadError.message : t`Gebruiker niet gevonden.`}
      </p>
    );
  }

  const isBusy = saveAdminUser.isPending || deleteAdminUser.isPending;

  return (
    <div className="user-detail-layout">
      <form className="form client-details-form" onSubmit={(event) => void handleSubmit(event)}>
        <label>
          <Trans>Naam</Trans>
          <input
            type="text"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            required
          />
        </label>
        <label>
          <Trans>E-mail</Trans>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </label>
        <label>
          <Trans>Rol</Trans>
          <select value={role} onChange={(event) => setRole(event.target.value as GlobalRole)}>
            {ROLE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {ROLE_LABELS[option]}
              </option>
            ))}
          </select>
        </label>

        {role === 'client' && (
          <label>
            <Trans>Bedrijven</Trans>
            <CompanyAutocomplete
              companies={mergedCompanies}
              selectedIds={companyIds}
              onChange={(nextIds) => {
                setCompaniesDirty(true);
                setCompanyIds(nextIds);
              }}
              disabled={isBusy || companiesLoading}
            />
          </label>
        )}

        {error && <p className="form-error">{error}</p>}

        <div className="form-actions">
          <button type="submit" className="btn-accent" disabled={isBusy}>
            <Trans>Opslaan</Trans>
          </button>
          {saved && (
            <span className="save-confirmation">
              {t`Opgeslagen`} <IconCheck />
            </span>
          )}
          {onCancel && (
            <button type="button" onClick={onCancel} disabled={isBusy}>
              <Trans>Terug</Trans>
            </button>
          )}
          {onDeleted && (
            <button type="button" onClick={() => void handleDelete()} disabled={isBusy}>
              <IconTrash /> <Trans>Verwijderen</Trans>
            </button>
          )}
        </div>
      </form>
      <UserTeamsPanel
        memberships={user.memberships}
        companies={user.companies}
        onRevoke={(membership) => void handleRevokeMembership(membership)}
        isRevoking={revokeMembership.isPending}
      />
    </div>
  );
}
