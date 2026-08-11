import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Trans, useLingui } from '@lingui/react/macro';
import { account, teams } from '../appwrite/client';
import { useAuth } from '../auth/AuthContext';

type Step = 'accepting' | 'set-password' | 'error';

export function AcceptInvitePage() {
  const { t } = useLingui();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { refresh } = useAuth();

  const [step, setStep] = useState<Step>('accepting');
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const teamId = searchParams.get('teamId');
  const membershipId = searchParams.get('membershipId');
  const userId = searchParams.get('userId');
  const secret = searchParams.get('secret');

  useEffect(() => {
    async function accept() {
      if (!teamId || !membershipId || !userId || !secret) {
        setError(t`Deze uitnodigingslink is ongeldig of onvolledig.`);
        setStep('error');
        return;
      }
      try {
        await teams.updateMembershipStatus({ teamId, membershipId, userId, secret });
        setStep('set-password');
      } catch (err) {
        setError(err instanceof Error ? err.message : t`Uitnodiging accepteren is mislukt.`);
        setStep('error');
      }
    }
    void accept();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError(t`Vul je naam in.`);
      return;
    }
    if (password.length < 8) {
      setError(t`Wachtwoord moet minimaal 8 tekens zijn.`);
      return;
    }
    if (password !== confirmPassword) {
      setError(t`Wachtwoorden komen niet overeen.`);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await account.updateName({ name: name.trim() });
      await account.updatePassword({ password });
      await refresh();
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : t`Instellen is mislukt.`);
    } finally {
      setSubmitting(false);
    }
  }

  if (step === 'accepting') {
    return <div className="auth-page"><Trans>Uitnodiging accepteren…</Trans></div>;
  }

  if (step === 'error') {
    return (
      <div className="auth-page">
        <p className="form-error">{error}</p>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <form className="form auth-form" onSubmit={handleSetPassword}>
        <h1><Trans>Account voltooien</Trans></h1>
        <p><Trans>Vul je naam in en kies een wachtwoord om voortaan mee in te loggen.</Trans></p>
        <label>
          <Trans>Naam</Trans>
          <input
            autoFocus
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
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
            minLength={8}
          />
        </label>
        <label>
          <Trans>Bevestig wachtwoord</Trans>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={8}
          />
        </label>
        {error && <p className="form-error">{error}</p>}
        <button type="submit" disabled={submitting}>
          <Trans>Wachtwoord instellen</Trans>
        </button>
      </form>
    </div>
  );
}
