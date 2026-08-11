import { useState } from 'react';
import { Trans, useLingui } from '@lingui/react/macro';
import type { TaskRow, TimeEntryRow } from '../../appwrite/types';
import { useAuth } from '../../auth/AuthContext';
import { useCreateTimeEntry, useUpdateTimeEntry } from './hooks';
import { useMarkTaskFinished } from '../tasks/hooks';

interface TimeEntryFormProps {
  companyId: string;
  teamId: string;
  task: TaskRow;
  entry?: TimeEntryRow;
  onSaved: () => void;
  onCancel: () => void;
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

export function TimeEntryForm({ companyId, teamId, task, entry, onSaved, onCancel }: TimeEntryFormProps) {
  const { t } = useLingui();
  const { user } = useAuth();
  const [hours, setHours] = useState(entry ? String(entry.hours) : '');
  const [date, setDate] = useState(entry ? entry.workedDate.slice(0, 10) : todayIsoDate());
  const [comment, setComment] = useState(entry?.comment ?? '');
  const [error, setError] = useState<string | null>(null);
  const createEntry = useCreateTimeEntry(companyId);
  const updateEntry = useUpdateTimeEntry();
  const markFinished = useMarkTaskFinished(companyId);
  const isPending = (entry ? updateEntry.isPending : createEntry.isPending) || markFinished.isPending;

  async function handleSubmit(e: React.FormEvent, completeTask = false) {
    e.preventDefault();
    setError(null);
    if (!user) {
      setError(t`Niet ingelogd.`);
      return;
    }
    const hoursValue = parseFloat(hours);
    if (!Number.isFinite(hoursValue) || hoursValue <= 0) {
      setError(t`Vul een geldig aantal uren in.`);
      return;
    }
    try {
      if (entry) {
        await updateEntry.mutateAsync({
          entryId: entry.$id,
          taskId: entry.taskId,
          hours: hoursValue,
          workedDate: new Date(`${date}T12:00:00`),
          comment: comment.trim() || null,
        });
      } else {
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
      if (completeTask && task.status !== 'finished') {
        await markFinished.mutateAsync({
          taskId: task.$id,
          teamId,
          companyId,
          projectId: task.projectId,
          completedDate: new Date(),
        });
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : t`Uren boeken mislukt.`);
    }
  }

  return (
    <form className="form" onSubmit={(event) => void handleSubmit(event, false)}>
      <label>
        <Trans>Aantal uren</Trans>
        <input
          autoFocus
          type="number"
          step="0.25"
          min="0.25"
          value={hours}
          onChange={(e) => setHours(e.target.value)}
          required
        />
      </label>
      <label>
        <Trans>Datum</Trans>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
      </label>
      <label>
        <Trans>Toelichting</Trans>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={3}
          placeholder={t`Optioneel`}
        />
      </label>
      {error && <p className="form-error">{error}</p>}
      <div className="form-actions">
        <button type="submit" className="btn-accent" disabled={isPending || !hours}>
          <Trans>Opslaan</Trans>
        </button>
        {task.status !== 'finished' && (
          <button
            type="button"
            className="btn-accent"
            disabled={isPending || !hours}
            onClick={(e) => void handleSubmit(e, true)}
          >
            <Trans>Opslaan & taak afronden</Trans>
          </button>
        )}
        <button type="button" onClick={onCancel}>
          <Trans>Annuleren</Trans>
        </button>
      </div>
    </form>
  );
}
