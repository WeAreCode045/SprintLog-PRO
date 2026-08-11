import { useMemo, useState } from 'react';
import { Trans, useLingui } from '@lingui/react/macro';
import { Modal } from '../../components/Modal';
import { IconEdit, IconLockOpen, IconPlus, IconTrash } from '../../components/icons';
import type { ResolvedRole, TaskRow, TimeEntryRow } from '../../appwrite/types';
import { useDeveloperProfiles } from '../profiles/hooks';
import { TimeEntryForm } from './TimeEntryForm';
import { UnlockTimeEntriesDialog } from './UnlockTimeEntriesDialog';
import { useDeleteTimeEntry, useTimeEntriesByTask } from './hooks';
import { formatHours } from '../../lib/formatHours';

interface TaskHoursDialogProps {
  companyId: string;
  teamId: string;
  task: TaskRow;
  userId: string;
  role: ResolvedRole;
  onClose: () => void;
}

export function TaskHoursDialog({ companyId, teamId, task, userId: _userId, role, onClose }: TaskHoursDialogProps) {
  const { t } = useLingui();
  const { data: entries = [], isLoading } = useTimeEntriesByTask(task.$id);
  const { data: developers = [] } = useDeveloperProfiles(true);
  const deleteEntry = useDeleteTimeEntry();
  const [formEntry, setFormEntry] = useState<TimeEntryRow | 'new' | null>(null);
  const [unlockingEntry, setUnlockingEntry] = useState<TimeEntryRow | null>(null);

  const developerById = useMemo(
    () => new Map(developers.map((profile) => [profile.userId, profile])),
    [developers],
  );

  const sortedEntries = useMemo(
    () => entries.slice().sort((a, b) => b.workedDate.localeCompare(a.workedDate)),
    [entries],
  );

  const total = entries.reduce((sum, entry) => sum + (entry.hours ?? 0), 0);

  function canManage(entry: TimeEntryRow) {
    if (entry.approved) return false;
    return role === 'admin' || role === 'developer';
  }

  function canUnlock(entry: TimeEntryRow) {
    return role === 'admin' && Boolean(entry.approved) && !entry.invoiced;
  }

  async function handleDelete(entry: TimeEntryRow) {
    if (!confirm(t`Deze urenregel verwijderen?`)) return;
    await deleteEntry.mutateAsync({ entryId: entry.$id, taskId: entry.taskId });
  }

  if (formEntry !== null) {
    return (
      <Modal
        title={`${formEntry === 'new' ? t`Uren boeken` : t`Uren bewerken`}: ${task.title}`}
        onClose={onClose}
      >
        <TimeEntryForm
          companyId={companyId}
          teamId={teamId}
          task={task}
          entry={formEntry === 'new' ? undefined : formEntry}
          onSaved={() => setFormEntry(null)}
          onCancel={() => setFormEntry(null)}
        />
      </Modal>
    );
  }

  if (unlockingEntry) {
    return (
      <UnlockTimeEntriesDialog
        entryIds={[unlockingEntry.$id]}
        teamId={teamId}
        onClose={() => setUnlockingEntry(null)}
      />
    );
  }

  return (
    <Modal title={`${t`Uren`}: ${task.title}`} onClose={onClose}>
      {isLoading ? (
        <p><Trans>Laden…</Trans></p>
      ) : entries.length === 0 ? (
        <p className="empty-state"><Trans>Nog geen uren geboekt op deze taak.</Trans></p>
      ) : (
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th><Trans>Datum</Trans></th>
                <th><Trans>Developer</Trans></th>
                <th><Trans>Toelichting</Trans></th>
                <th className="data-table-num"><Trans>Uren</Trans></th>
              </tr>
            </thead>
            <tbody>
              {sortedEntries.map((entry) => (
                <tr key={entry.$id}>
                  <td>{entry.workedDate.slice(0, 10)}</td>
                  <td>{developerById.get(entry.userId)?.displayName ?? entry.userId}</td>
                  <td className="data-table-muted">{entry.comment?.trim() || '—'}</td>
                  <td className="data-table-num">
                    {formatHours(entry.hours)}
                    {entry.approved && (
                      <span className="badge badge-status--finished" style={{ marginLeft: '0.5rem' }}>
                        {entry.invoiced ? <Trans>Gefactureerd</Trans> : <Trans>Goedgekeurd</Trans>}
                      </span>
                    )}
                    {(canManage(entry) || canUnlock(entry)) && (
                      <div className="data-table-actions">
                        {canManage(entry) && (
                          <>
                            <button
                              type="button"
                              className="icon-button"
                              title={t`Bewerken`}
                              onClick={() => setFormEntry(entry)}
                            >
                              <IconEdit />
                            </button>
                            <button
                              type="button"
                              className="icon-button"
                              title={t`Verwijderen`}
                              onClick={() => void handleDelete(entry)}
                            >
                              <IconTrash />
                            </button>
                          </>
                        )}
                        {canUnlock(entry) && (
                          <button
                            type="button"
                            className="icon-button"
                            title={t`Deblokkeren`}
                            onClick={() => setUnlockingEntry(entry)}
                          >
                            <IconLockOpen />
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="data-table-total">
                <td colSpan={3}><Trans>Totaal</Trans></td>
                <td className="data-table-num">{formatHours(total)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
      <div className="form-actions">
        <button type="button" className="btn-accent" onClick={() => setFormEntry('new')}>
          <IconPlus /> <Trans>Uren toevoegen</Trans>
        </button>
        <button type="button" onClick={onClose}>
          <Trans>Sluiten</Trans>
        </button>
      </div>
    </Modal>
  );
}
