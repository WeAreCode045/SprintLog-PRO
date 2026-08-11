import { t } from '@lingui/core/macro';
import type { ResolvedRole, TaskRow } from '../../appwrite/types';

export type TaskViewTab = 'developer' | 'client' | 'requested';

export const TASK_VIEW_TAB_ORDER: TaskViewTab[] = ['developer', 'client', 'requested'];

export function clientTasksTabLabel(role: ResolvedRole): string {
  return role === 'client' ? t`Jouw taken` : t`Klanttaken`;
}

export function taskViewTabLabel(tab: TaskViewTab, role: ResolvedRole): string {
  switch (tab) {
    case 'developer':
      return t`Projecttaken`;
    case 'client':
      return clientTasksTabLabel(role);
    case 'requested':
      return t`Aangevraagde taken`;
    default: {
      const _exhaustive: never = tab;
      return _exhaustive;
    }
  }
}

export interface TaskViewTabCounts {
  developer: number;
  client: number;
  requested: number;
}

export function splitTasksByViewTab(tasks: TaskRow[]): Record<TaskViewTab, TaskRow[]> {
  const developer: TaskRow[] = [];
  const client: TaskRow[] = [];
  const requested: TaskRow[] = [];

  for (const task of tasks) {
    if (task.status === 'archived') continue;
    const audience = task.audience ?? 'internal';
    if (task.status === 'requested' && audience === 'internal') {
      requested.push(task);
    } else if (audience === 'client') {
      client.push(task);
    } else if (audience === 'internal') {
      developer.push(task);
    }
  }

  return { developer, client, requested };
}

export function countTasksByViewTab(tasks: TaskRow[]): TaskViewTabCounts {
  const split = splitTasksByViewTab(tasks);
  return {
    developer: split.developer.length,
    client: split.client.length,
    requested: split.requested.length,
  };
}

export function defaultTaskViewTab(_role: ResolvedRole): TaskViewTab {
  return 'developer';
}
