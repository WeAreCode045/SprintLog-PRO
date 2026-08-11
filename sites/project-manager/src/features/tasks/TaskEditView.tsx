import { Trans } from '@lingui/react/macro';
import { ArrowLeft } from 'lucide-react';
import type { CompanyRow, TaskRow } from '../../appwrite/types';
import { TaskForm } from './TaskForm';

interface TaskEditViewProps {
  companyId: string;
  teamId: string;
  userId: string;
  canManageProjects: boolean;
  task: TaskRow;
  availableCompanies?: CompanyRow[];
  onBack: () => void;
}

/** Inline replacement for the task list/table while editing — mirrors TaskDetailView's
 * swap-in-place pattern instead of layering TaskFormDialog's Modal on top. */
export function TaskEditView({
  companyId,
  teamId,
  userId,
  canManageProjects,
  task,
  availableCompanies,
  onBack,
}: TaskEditViewProps) {
  return (
    <div className="task-detail-view">
      <button type="button" className="btn-link task-detail-back" onClick={onBack}>
        <ArrowLeft size={16} aria-hidden /> <Trans>Terug naar taken</Trans>
      </button>
      <h3 className="task-edit-heading"><Trans>Taak bewerken</Trans></h3>
      <TaskForm
        companyId={companyId}
        teamId={teamId}
        userId={userId}
        canManageProjects={canManageProjects}
        task={task}
        availableCompanies={availableCompanies}
        onClose={onBack}
      />
    </div>
  );
}
