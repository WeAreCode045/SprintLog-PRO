import { t } from '@lingui/core/macro';
import type { LucideIcon } from 'lucide-react';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  File,
  FileUp,
  ListTodo,
  MessagesSquare,
  Receipt,
  Unlock,
  UserPlus,
} from 'lucide-react';
import type { NotificationRow } from '../../appwrite/types';
import { isPendingHoursNotification } from './dashboardNotificationUtils';

export function cleanNotificationBody(body: string): string {
  return body.replace(/\s+across\s+\d+\s+entr(?:y|ies)\.?/gi, '').trim();
}

export function getDashboardNotificationTitle(notification: NotificationRow): string {
  if (isPendingHoursNotification(notification)) {
    return t`Uren ter goedkeuring`;
  }

  switch (notification.type) {
    case 'task_completed':
      return t`Taak afgerond`;
    case 'file_requested':
      return t`Bestand aangevraagd`;
    case 'task_created':
      return t`Nieuwe taak`;
    case 'discussion_active':
      return t`Discussie`;
    case 'task_assigned':
      return t`Taak toegewezen`;
    case 'file_uploaded':
      return t`Bestand geüpload`;
    case 'hours_approved':
      return t`Uren goedgekeurd`;
    case 'hours_unlocked':
      return t`Uren gedeblokkeerd`;
    case 'invoice_sent':
      return t`Nieuwe factuur`;
    default: {
      const fallback = (notification.title ?? '').trim();
      return fallback || t`Notificatie`;
    }
  }
}

export function getDashboardNotificationDescription(notification: NotificationRow): string | null {
  if (isPendingHoursNotification(notification)) {
    const body = cleanNotificationBody((notification.body ?? '').trim());
    return body || null;
  }

  const title = getDashboardNotificationTitle(notification);
  const rawBody = cleanNotificationBody((notification.body ?? notification.title ?? '').trim());
  if (!rawBody || rawBody === title) return null;
  return rawBody;
}

export function getDashboardNotificationIcon(notification: NotificationRow): LucideIcon {
  if (isPendingHoursNotification(notification)) {
    return AlertCircle;
  }

  switch (notification.type) {
    case 'task_completed':
      return CheckCircle2;
    case 'file_requested':
      return FileUp;
    case 'task_created':
      return ListTodo;
    case 'discussion_active':
      return MessagesSquare;
    case 'task_assigned':
      return UserPlus;
    case 'file_uploaded':
      return File;
    case 'hours_approved':
      return Clock;
    case 'hours_unlocked':
      return Unlock;
    case 'invoice_sent':
      return Receipt;
    default:
      return ListTodo;
  }
}
