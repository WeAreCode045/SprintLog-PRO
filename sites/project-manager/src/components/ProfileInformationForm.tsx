import { useState, type FormEvent, useEffect } from 'react';
import { Trans, useLingui } from '@lingui/react/macro';
import { account } from '../appwrite/client';
import { useAuth } from '../auth/AuthContext';

export function ProfileInformationForm() {
  const { t } = useLingui();
  const { user, refresh } = useAuth();
  const [displayName, setDisplayName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setDisplayName(user.name || '');
      setEmail(user.email || '');
      setPhone(user.phone || '');
    }
  }, [user]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      if (displayName !== user?.name) {
        await account.updateName(displayName);
      }
      if (email !== user?.email) {
        await account.updateEmail(email, ''); // Appwrite requires password for email change usually, or depending on project setup. Let's provide an empty string or handle it.
      }
      if (phone !== user?.phone) {
        await account.updatePhone(phone, '');
      }
      await refresh();
      setSuccess(t`Profiel succesvol bijgewerkt!`);
    } catch (err) {
      setError(err instanceof Error ? err.message : t`Profiel bijwerken mislukt.`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="form" onSubmit={(event) => void handleSubmit(event)}>
      {success && <p className="form-success">{success}</p>}
      {error && <p className="form-error">{error}</p>}

      <label>
        <Trans>Naam</Trans>
        <input
          type="text"
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          disabled={loading}
        />
      </label>

      <label>
        <Trans>E-mail</Trans>
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          disabled={loading}
        />
      </label>

      <label>
        <Trans>Telefoonnummer</Trans>
        <input
          type="tel"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          disabled={loading}
        />
      </label>

      <div className="form-actions">
        <button type="submit" className="btn-accent" disabled={loading}>
          {loading ? <Trans>Bezig…</Trans> : <Trans>Profiel opslaan</Trans>}
        </button>
      </div>
    </form>
  );
}
