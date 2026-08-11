import { useState, type FormEvent } from 'react';
import { Trans, useLingui } from '@lingui/react/macro';
import { account } from '../appwrite/client';

export function ChangePasswordForm() {
  const { t } = useLingui();
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (newPassword !== confirmPassword) {
      setError(t`Nieuwe wachtwoorden komen niet overeen.`);
      return;
    }
    if (newPassword.length < 8) {
      setError(t`Wachtwoord moet minimaal 8 tekens lang zijn.`);
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      await account.updatePassword(newPassword, oldPassword);
      setSuccess(t`Wachtwoord succesvol bijgewerkt!`);
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError(err instanceof Error ? err.message : t`Wachtwoord bijwerken mislukt.`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="form" onSubmit={(event) => void handleSubmit(event)}>
      {success && <p className="form-success">{success}</p>}
      {error && <p className="form-error">{error}</p>}

      <label>
        <Trans>Huidig wachtwoord</Trans>
        <input
          type="password"
          value={oldPassword}
          onChange={(event) => setOldPassword(event.target.value)}
          required
          disabled={loading}
        />
      </label>

      <label>
        <Trans>Nieuw wachtwoord</Trans>
        <input
          type="password"
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
          required
          disabled={loading}
        />
      </label>

      <label>
        <Trans>Bevestig nieuw wachtwoord</Trans>
        <input
          type="password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          required
          disabled={loading}
        />
      </label>

      <div className="form-actions">
        <button type="submit" className="btn-accent" disabled={loading}>
          {loading ? <Trans>Bezig…</Trans> : <Trans>Wachtwoord wijzigen</Trans>}
        </button>
      </div>
    </form>
  );
}
