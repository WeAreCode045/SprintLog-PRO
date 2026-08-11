import { useLingui } from '@lingui/react/macro';
import { Modal } from '../../components/Modal';
import { TaskForm, type TaskFormProps } from './TaskForm';

/** Modal framing for TaskForm — used for adding a task or subtask. Editing renders
 * TaskForm inline via TaskEditView instead, swapped into the content body. */
export function TaskFormDialog(props: TaskFormProps) {
  const { t } = useLingui();
  const { task, parentTask, defaultStatus } = props;
  const isEditing = Boolean(task);

  const title = isEditing
    ? t`Taak bewerken`
    : parentTask
      ? t`Nieuwe subtaak`
      : defaultStatus === 'requested'
        ? t`Taak aanvragen`
        : t`Nieuwe taak`;

  return (
    <Modal title={title} onClose={props.onClose}>
      <TaskForm {...props} />
    </Modal>
  );
}
