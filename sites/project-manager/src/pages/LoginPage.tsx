import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Trans, useLingui } from '@lingui/react/macro';
import { account } from '../appwrite/client';
import { useAuth } from '../auth/AuthContext';

export function LoginPage() {
  const { t } = useLingui();
  const { status, refresh } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (status === 'authenticated') {
    return <Navigate to="/" replace />;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await account.createEmailPasswordSession({ email, password });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t`Inloggen mislukt.`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-brand">
        <h1 className="auth-brand-name">Scopera</h1>
        <p className="auth-brand-tagline">Stay in scope, stay informed.</p>
      </div>
      <form className="form auth-form" onSubmit={handleSubmit}>
        <h2><Trans>Inloggen</Trans></h2>
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
        <label>
          <Trans>Wachtwoord</Trans>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        {error && <p className="form-error">{error}</p>}
        <button type="submit" disabled={submitting}>
          <Trans>Inloggen</Trans>
        </button>
      </form>
    </div>
  );
}
