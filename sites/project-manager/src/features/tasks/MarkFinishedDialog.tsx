import { useState } from 'react';
import { Trans, useLingui } from '@lingui/react/macro';
import { Modal } from '../../components/Modal';
import { useAuth } from '../../auth/AuthContext';
import { useCreateTimeEntry } from '../timeEntries/hooks';
import { useMarkTaskFinished } from './hooks';
import type { TaskRow } from '../../appwrite/types';
import { formatHours } from '../../lib/formatHours';

interface MarkFinishedDialogProps {
  companyId: string;
  teamId: string;
  task: TaskRow;
  onClose: () => void;
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

export function MarkFinishedDialog({ companyId, teamId, task, onClose }: MarkFinishedDialogProps) {
  const { t } = useLingui();
  const { user } = useAuth();
  const isClientTask = (task.audience ?? 'internal') === 'client';
  const [hours, setHours] = useState('');
  const [date, setDate] = useState(todayIsoDate());
  const [comment, setComment] = useState('');
  const [error, setError] = useState<string | null>(null);
  const markFinished = useMarkTaskFinished(companyId);
  const createEntry = useCreateTimeEntry(companyId);
  const existingTotal = task.hours ?? 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    try {
      if (isClientTask) {
        await markFinished.mutateAsync({
          taskId: task.$id,
          teamId,
          companyId,
          projectId: task.projectId,
          completedDate: new Date(`${date}T12:00:00`),
          assigneeIds: task.assigneeIds,
        });
        onClose();
        return;
      }

      const trimmedHours = hours.trim();
      if (trimmedHours) {
        if (!user) {
          setError(t`Niet ingelogd.`);
          return;
        }
        const hoursValue = parseFloat(trimmedHours);
        if (!Number.isFinite(hoursValue) || hoursValue <= 0) {
          setError(t`Vul een geldig aantal uren in, of laat leeg.`);
          return;
        }
        await createEntry.mutateAsync({
          companyId,
          projectId: task.projectId,
          taskId: task.$id,
          teamId,
          userId: user.$id,
          hours: hoursValue,
          workedDate: new Date(`${date}T12:00:00`),
          comment: comment.trim() || null,
        });
      }

      await markFinished.mutateAsync({
        taskId: task.$id,
        teamId,
        companyId,
        projectId: task.projectId,
        completedDate: new Date(`${date}T12:00:00`),
        assigneeIds: task.assigneeIds,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : t`Sluiten mislukt.`);
    }
  }

  const isPending = markFinished.isPending || createEntry.isPending;

  return (
    <Modal title={t`Sluiten: ${task.title}`} onClose={onClose}>
      <form className="form" onSubmit={(event) => void handleSubmit(event)}>
        {isClientTask ? (
          <p className="text-muted">
            <Trans>
              Klanttaken hebben geen urenregistratie. Markeer deze taak als afgerond wanneer de
              klantactie klaar is.
            </Trans>
          </p>
        ) : (
          <>
            <p className="text-muted">
              <Trans>
                Totaal geboekt: <strong>{formatHours(existingTotal)}</strong>. Optioneel kun je nog
                uren toevoegen voordat de taak wordt afgerond.
              </Trans>
            </p>
            <label>
              <Trans>Extra uren (optioneel)</Trans>
              <input
                autoFocus
                type="number"
                step="0.25"
                min="0.25"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
              />
            </label>
            <label>
              <Trans>Toelichting</Trans>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={2}
                placeholder={t`Optioneel`}
                disabled={!hours.trim()}
              />
            </label>
          </>
        )}
        <label>
          <Trans>Datum</Trans>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </label>
        {error && <p className="form-error">{error}</p>}
        <div className="form-actions">
          <button type="submit" className="btn-accent" disabled={isPending}>
            <Trans>Afronden</Trans>
          </button>
          <button type="button" onClick={onClose}>
            <Trans>Annuleren</Trans>
          </button>
        </div>
      </form>
    </Modal>
  );
}
