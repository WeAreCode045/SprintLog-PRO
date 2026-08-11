import { useLingui } from '@lingui/react/macro';
import { Modal } from '../../components/Modal';
import type { TaskRow, TimeEntryRow } from '../../appwrite/types';
import { TimeEntryForm } from './TimeEntryForm';

interface LogHoursDialogProps {
  companyId: string;
  teamId: string;
  task: TaskRow;
  entry?: TimeEntryRow;
  onClose: () => void;
}

export function LogHoursDialog({ companyId, teamId, task, entry, onClose }: LogHoursDialogProps) {
  const { t } = useLingui();
  const dialogTitle = entry ? t`Uren bewerken` : t`Uren boeken`;
  return (
    <Modal title={`${dialogTitle}: ${task.title}`} onClose={onClose}>
      <TimeEntryForm
        companyId={companyId}
        teamId={teamId}
        task={task}
        entry={entry}
        onSaved={onClose}
        onCancel={onClose}
      />
    </Modal>
  );
}
