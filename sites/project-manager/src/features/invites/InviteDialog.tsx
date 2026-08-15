import { useState } from 'react';
import { Trans, useLingui } from '@lingui/react/macro';
import { Modal } from '../../components/Modal';
import { useAddClientDirect, useInviteMember } from './hooks';
import type { TeamMemberRole } from '../../appwrite/types';

type AddMode = 'direct' | 'invite';

interface InviteDialogProps {
  teamId: string;
  onClose: () => void;
  /** Clients may only invite by email — direct (password-set) creation stays staff-only. */
  allowDirectAdd?: boolean;
}

const MIN_PASSWORD_LENGTH = 8;

export function InviteDialog({ teamId, onClose, allowDirectAdd = true }: InviteDialogProps) {
  const { t } = useLingui();
  const [mode, setMode] = useState<AddMode>(allowDirectAdd ? 'direct' : 'invite');
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const role: TeamMemberRole = 'client';
  const inviteMember = useInviteMember(teamId);
  const addClientDirect = useAddClientDirect(teamId);

  const isPending = inviteMember.isPending || addClientDirect.isPending;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setError(null);
    try {
      if (mode === 'invite') {
        await inviteMember.mutateAsync({ email: email.trim(), role });
      } else {
        if (password.length > 0 && password.length < MIN_PASSWORD_LENGTH) {
          setError(t`Wachtwoord moet minimaal ${MIN_PASSWORD_LENGTH} tekens zijn.`);
          return;
        }
        await addClientDirect.mutateAsync({
          email: email.trim(),
          displayName: displayName.trim() || undefined,
          password: password || undefined,
        });
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : t`Toevoegen mislukt.`);
    }
  }

  return (
    <Modal title={t`Klant toevoegen`} onClose={onClose}>
      <form className="form" onSubmit={handleSubmit}>
        {allowDirectAdd && (
          <div className="form-actions" style={{ justifyContent: 'flex-start', gap: '0.5rem' }}>
            <button
              type="button"
              className={mode === 'direct' ? 'btn-accent' : undefined}
              onClick={() => setMode('direct')}
            >
              <Trans>Direct toevoegen</Trans>
            </button>
            <button
              type="button"
              className={mode === 'invite' ? 'btn-accent' : undefined}
              onClick={() => setMode('invite')}
            >
              <Trans>Uitnodigen per e-mail</Trans>
            </button>
          </div>
        )}

        <label>
          <Trans>E-mailadres</Trans>
          <input
            autoFocus
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>

        {mode === 'direct' && (
          <>
            <label>
              <Trans>Naam</Trans>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder={t`Optioneel`}
              />
            </label>
            <label>
              <Trans>Wachtwoord</Trans>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={MIN_PASSWORD_LENGTH}
                placeholder={t`Verplicht bij nieuwe users`}
              />
            </label>
            <p className="text-muted">
              <Trans>
                Bestaande accounts worden direct aan dit bedrijf gekoppeld. Nieuwe accounts hebben een
                wachtwoord nodig om in te loggen.
              </Trans>
            </p>
          </>
        )}

        {mode === 'invite' && (
          <p className="text-muted">
            <Trans>
              De uitgenodigde krijgt een e-mail en moet de uitnodiging accepteren voordat toegang actief
              is.
            </Trans>
          </p>
        )}

        {error && <p className="form-error">{error}</p>}

        <div className="form-actions">
          <button type="submit" disabled={isPending || !email.trim()}>
            {mode === 'direct' ? <Trans>Toevoegen</Trans> : <Trans>Uitnodigen</Trans>}
          </button>
          <button type="button" onClick={onClose}>
            <Trans>Annuleren</Trans>
          </button>
        </div>
      </form>
    </Modal>
  );
}
