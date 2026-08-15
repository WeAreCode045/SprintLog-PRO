import type { NotificationRow } from '../../appwrite/types';

export const PENDING_HOURS_NOTIFICATION_ID = 'synthetic:hours-pending';

export function isPersistentDashboardNotification(notification: NotificationRow): boolean {
  return notification.$id.startsWith('synthetic:');
}

export function isPendingHoursNotification(notification: NotificationRow): boolean {
  return notification.$id === PENDING_HOURS_NOTIFICATION_ID;
}

export function buildPendingHoursNotification(
  companyId: string,
  body: string,
  latestAt: string,
): NotificationRow {
  return {
    $id: PENDING_HOURS_NOTIFICATION_ID,
    $sequence: '0',
    $tableId: 'notifications',
    $databaseId: 'main',
    $createdAt: latestAt,
    $updatedAt: latestAt,
    $permissions: [],
    userId: '',
    companyId,
    projectId: null,
    type: 'hours_approved',
    title: body,
    body,
    href: '/app/reports?tab=approvals',
    readAt: null,
    sourceId: null,
  };
}
