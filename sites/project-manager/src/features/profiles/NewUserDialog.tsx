import { useState, type FormEvent } from 'react';
import { Trans, useLingui } from '@lingui/react/macro';
import { useQueryClient } from '@tanstack/react-query';
import type { GlobalRole } from '../../appwrite/types';
import { Modal } from '../../components/Modal';
import { useAllCompanies } from '../companies/hooks';
import { CompanyAutocomplete } from './CompanyAutocomplete';
import { useSaveAdminUser } from './hooks';
import { useAddClientDirect } from '../invites/hooks';

const ROLE_OPTIONS: GlobalRole[] = ['developer', 'admin', 'client'];
const MIN_PASSWORD_LENGTH = 8;

interface NewUserDialogProps {
  onClose: () => void;
}

export function NewUserDialog({ onClose }: NewUserDialogProps) {
  const { t } = useLingui();
  const queryClient = useQueryClient();

  const ROLE_LABELS: Record<GlobalRole, string> = {
    admin: t`Admin`,
    developer: t`Developer`,
    client: t`Klant`,
  };

  const { data: companies = [], isLoading: companiesLoading } = useAllCompanies(true);
  const saveAdminUser = useSaveAdminUser();

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<GlobalRole>('developer');
  const [password, setPassword] = useState('');
  const [companyIds, setCompanyIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const primaryCompany = companies[0];
  const addClientDirect = useAddClientDirect(primaryCompany?.teamId ?? '');

  const isPending = addClientDirect.isPending || saveAdminUser.isPending;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!displayName.trim() || !email.trim()) {
      setError(t`Naam en e-mail zijn verplicht.`);
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(t`Wachtwoord moet minimaal ${MIN_PASSWORD_LENGTH} tekens zijn.`);
      return;
    }
    if (!primaryCompany) {
      setError(t`Geen bedrijf beschikbaar om de gebruiker aan te koppelen.`);
      return;
    }

    setError(null);
    try {
      // 1. Create Appwrite Auth user & userProfile
      const result = await addClientDirect.mutateAsync({
        email: email.trim(),
        displayName: displayName.trim(),
        password,
      });

      // 2. Set role & companies for user
      await saveAdminUser.mutateAsync({
        userId: result.userId,
        displayName: displayName.trim(),
        email: email.trim(),
        role,
        companyIds: role === 'client' ? companyIds : [],
      });

      await queryClient.invalidateQueries({ queryKey: ['adminUsers'] });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : t`Gebruiker toevoegen mislukt.`);
    }
  }

  return (
    <Modal title={t`Nieuwe gebruiker toevoegen`} onClose={onClose}>
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
        <label>
          <Trans>Wachtwoord</Trans>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            minLength={MIN_PASSWORD_LENGTH}
            required
            placeholder={t`Minimaal ${MIN_PASSWORD_LENGTH} tekens`}
          />
        </label>

        {role === 'client' && (
          <label>
            <Trans>Bedrijven</Trans>
            <CompanyAutocomplete
              companies={companies}
              selectedIds={companyIds}
              onChange={setCompanyIds}
              disabled={isPending || companiesLoading}
            />
          </label>
        )}

        {error && <p className="form-error">{error}</p>}

        <div className="form-actions">
          <button type="submit" className="btn-accent" disabled={isPending}>
            {isPending ? t`Bezig…` : t`Toevoegen`}
          </button>
          <button type="button" onClick={onClose} disabled={isPending}>
            <Trans>Annuleren</Trans>
          </button>
        </div>
      </form>
    </Modal>
  );
}
