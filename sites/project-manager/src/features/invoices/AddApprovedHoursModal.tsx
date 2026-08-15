import { useMemo, useState } from 'react';
import { Trans, useLingui } from '@lingui/react/macro';
import { Modal } from '../../components/Modal';
import type { CompanyRow } from '../../appwrite/types';
import { useTasksForCompanies } from '../tasks/hooks';
import { formatHours } from '../../lib/formatHours';
import { useApprovedUnbilledEntries } from './hooks';
import type { InvoiceItemFormValues } from './schema';

interface TaskGroup {
  taskId: string;
  taskTitle: string;
  hours: number;
  entryIds: string[];
}

interface AddApprovedHoursModalProps {
  company: CompanyRow;
  /** The draft invoice being edited, if it has been persisted yet — passed through so
   * entries this same draft already reserved still show up in the pool (see
   * listApprovedUnbilledEntries), not just entries nobody has touched yet. */
  invoiceId?: string;
  /** timeEntry ids already represented by a line item currently in the form (persisted or
   * not) — filtered out here so the modal only offers hours that aren't on the invoice yet. */
  excludeEntryIds: Set<string>;
  defaultVatRate: number;
  onClose: () => void;
  onAdd: (items: InvoiceItemFormValues[]) => void;
}

export function AddApprovedHoursModal({
  company,
  invoiceId,
  excludeEntryIds,
  defaultVatRate,
  onClose,
  onAdd,
}: AddApprovedHoursModalProps) {
  const { t } = useLingui();
  const { data: entries = [], isLoading: entriesLoading } = useApprovedUnbilledEntries(company.$id, invoiceId);
  const { data: tasks = [], isLoading: tasksLoading } = useTasksForCompanies([company.$id], 'all');
  const [checkedTaskIds, setCheckedTaskIds] = useState<Set<string>>(new Set());

  const taskById = useMemo(() => new Map(tasks.map((task) => [task.$id, task])), [tasks]);

  const groups = useMemo(() => {
    const availableEntries = entries.filter((entry) => !excludeEntryIds.has(entry.$id));
    const byTask = new Map<string, TaskGroup>();
    for (const entry of availableEntries) {
      const group = byTask.get(entry.taskId) ?? {
        taskId: entry.taskId,
        taskTitle: taskById.get(entry.taskId)?.title ?? entry.taskId,
        hours: 0,
        entryIds: [],
      };
      group.hours += entry.hours ?? 0;
      group.entryIds.push(entry.$id);
      byTask.set(entry.taskId, group);
    }
    return [...byTask.values()].sort((a, b) => a.taskTitle.localeCompare(b.taskTitle));
  }, [entries, excludeEntryIds, taskById]);

  function toggle(taskId: string) {
    setCheckedTaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  }

  function handleAdd() {
    const items: InvoiceItemFormValues[] = groups
      .filter((group) => checkedTaskIds.has(group.taskId))
      .map((group) => ({
        description: group.taskTitle,
        quantity: Math.round(group.hours * 100) / 100,
        unitPrice: company.hourlyRate ?? 0,
        vatRate: defaultVatRate,
        sourceTimeEntryIds: group.entryIds,
      }));
    onAdd(items);
    onClose();
  }

  const isLoading = entriesLoading || tasksLoading;

  return (
    <Modal title={t`Voeg goedgekeurde uren toe`} onClose={onClose}>
      {isLoading ? (
        <p>
          <Trans>Laden…</Trans>
        </p>
      ) : groups.length === 0 ? (
        <p className="empty-state">
          <Trans>Geen goedgekeurde, nog niet gefactureerde uren voor deze klant.</Trans>
        </p>
      ) : (
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th />
                <th>
                  <Trans>Taak</Trans>
                </th>
                <th className="data-table-num">
                  <Trans>Uren</Trans>
                </th>
              </tr>
            </thead>
            <tbody>
              {groups.map((group) => (
                <tr key={group.taskId}>
                  <td>
                    <input
                      type="checkbox"
                      checked={checkedTaskIds.has(group.taskId)}
                      onChange={() => toggle(group.taskId)}
                    />
                  </td>
                  <td>{group.taskTitle}</td>
                  <td className="data-table-num">{formatHours(group.hours)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="form-actions">
        <button type="button" className="btn-accent" disabled={checkedTaskIds.size === 0} onClick={handleAdd}>
          <Trans>Toevoegen</Trans>
        </button>
        <button type="button" onClick={onClose}>
          <Trans>Annuleren</Trans>
        </button>
      </div>
    </Modal>
  );
}
