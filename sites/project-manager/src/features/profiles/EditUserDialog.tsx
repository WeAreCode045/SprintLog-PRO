import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Trans, useLingui } from '@lingui/react/macro';
import type { AdminUser, GlobalRole } from '../../appwrite/types';
import { Modal } from '../../components/Modal';
import { useAllCompanies } from '../companies/hooks';
import { CompanyAutocomplete } from './CompanyAutocomplete';
import { useAdminUser, useSaveAdminUser } from './hooks';

const ROLE_OPTIONS: GlobalRole[] = ['admin', 'developer', 'client'];

interface EditUserDialogProps {
  user: AdminUser;
  onClose: () => void;
}

export function EditUserDialog({ user, onClose }: EditUserDialogProps) {
  const { t } = useLingui();

  const ROLE_LABELS: Record<GlobalRole, string> = {
    admin: t`Admin`,
    developer: t`Developer`,
    client: t`Klant`,
  };

  const { data: companies = [], isLoading: companiesLoading } = useAllCompanies(true);
  const { data: detailedUser, isLoading: detailsLoading } = useAdminUser(user.userId, true);
  const saveAdminUser = useSaveAdminUser();
  const [displayName, setDisplayName] = useState(user.displayName);
  const [email, setEmail] = useState(user.email);
  const [role, setRole] = useState<GlobalRole>(user.role);
  const [companyIds, setCompanyIds] = useState(user.companies.map((company) => company.companyId));
  const [companiesDirty, setCompaniesDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mergedCompanies = useMemo(() => {
    const map = new Map(companies.map((c) => [c.$id, c]));
    for (const uc of user.companies) {
      if (!map.has(uc.companyId)) {
        map.set(uc.companyId, {
          $id: uc.companyId,
          teamId: uc.teamId,
          name: uc.name,
          $createdAt: '',
          $updatedAt: '',
          $permissions: [],
          $databaseId: '',
          $collectionId: '',
        } as any);
      }
    }
    return Array.from(map.values());
  }, [companies, user.companies]);

  useEffect(() => {
    if (!detailedUser) return;
    setDisplayName(detailedUser.displayName);
    setEmail(detailedUser.email);
    setRole(detailedUser.role);
    if (detailedUser.companies.length > 0) {
      setCompanyIds(detailedUser.companies.map((company) => company.companyId));
    }
  }, [detailedUser]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!displayName.trim() || !email.trim()) {
      setError(t`Naam en e-mail zijn verplicht.`);
      return;
    }
    setError(null);
    try {
      await saveAdminUser.mutateAsync({
        userId: user.userId,
        displayName: displayName.trim(),
        email: email.trim(),
        role,
        ...(role === 'client' && (detailedUser || companiesDirty)
          ? { companyIds }
          : {}),
      });
      onClose();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t`Opslaan mislukt`);
    }
  }

  return (
    <Modal title={t`Gebruiker bewerken`} onClose={onClose}>
      <form className="form" onSubmit={(event) => void handleSubmit(event)}>
        <label>
          <Trans>Naam</Trans>
          <input
            autoFocus
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
            {detailsLoading && (
              <p className="text-muted"><Trans>Gekoppelde bedrijven laden…</Trans></p>
            )}
            <CompanyAutocomplete
              companies={mergedCompanies}
              selectedIds={companyIds}
              onChange={(nextIds) => {
                setCompaniesDirty(true);
                setCompanyIds(nextIds);
              }}
              disabled={saveAdminUser.isPending || companiesLoading}
            />
          </label>
        )}

        {error && <p className="form-error">{error}</p>}

        <div className="form-actions">
          <button type="submit" className="btn-accent" disabled={saveAdminUser.isPending}>
            <Trans>Opslaan</Trans>
          </button>
          <button type="button" onClick={onClose} disabled={saveAdminUser.isPending}>
            <Trans>Annuleren</Trans>
          </button>
        </div>
      </form>
    </Modal>
  );
}
