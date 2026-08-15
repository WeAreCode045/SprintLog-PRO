import type { ResolvedRole, TaskRow } from '../../appwrite/types';

export function canDeleteTaskRow(
  task: TaskRow,
  role: ResolvedRole,
  userId: string,
  invoicedTaskIds: Set<string>,
) {
  if (role === 'admin' && !invoicedTaskIds.has(task.$id)) return true;
  if (role === 'client' && task.status === 'requested' && task.createdBy === userId) return true;
  return false;
}
