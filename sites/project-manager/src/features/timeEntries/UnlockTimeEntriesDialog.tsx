import { useState } from 'react';
import { Trans, useLingui } from '@lingui/react/macro';
import { plural } from '@lingui/core/macro';
import { Modal } from '../../components/Modal';
import { useUnlockTimeEntries } from './hooks';

interface UnlockTimeEntriesDialogProps {
  entryIds: string[];
  teamId: string;
  onClose: () => void;
}

export function UnlockTimeEntriesDialog({ entryIds, teamId, onClose }: UnlockTimeEntriesDialogProps) {
  const { t } = useLingui();
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const unlockEntries = useUnlockTimeEntries();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmedReason = reason.trim();
    if (!trimmedReason) {
      setError(t`Reden is verplicht.`);
      return;
    }
    try {
      await unlockEntries.mutateAsync({ entryIds, teamId, reason: trimmedReason });
      onClose();
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : t`Deblokkeren mislukt.`);
    }
  }

  return (
    <Modal
      title={plural(entryIds.length, {
        one: '# goedgekeurde urenregel deblokkeren',
        other: '# goedgekeurde urenregels deblokkeren',
      })}
      onClose={onClose}
    >
      <form onSubmit={(e) => void handleSubmit(e)}>
        <p className="text-muted">
          <Trans>
            Dit maakt de geselecteerde uren weer bewerkbaar voor de developer. Al gefactureerde
            uren kunnen niet worden gedeblokkeerd.
          </Trans>
        </p>
        <label>
          <Trans>Reden</Trans>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            maxLength={500}
            required
            autoFocus
          />
        </label>
        {error && <p className="form-error">{error}</p>}
        <div className="form-actions">
          <button type="submit" className="btn-accent" disabled={unlockEntries.isPending}>
            {unlockEntries.isPending ? t`Bezig…` : t`Deblokkeren`}
          </button>
          <button type="button" onClick={onClose}>
            <Trans>Annuleren</Trans>
          </button>
        </div>
      </form>
    </Modal>
  );
}
