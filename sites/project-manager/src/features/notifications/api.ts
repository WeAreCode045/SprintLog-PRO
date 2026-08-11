import { Query } from 'appwrite';
import { tablesDB } from '../../appwrite/client';
import { DATABASE_ID, TABLES } from '../../appwrite/constants';
import type { NotificationRow } from '../../appwrite/types';

export async function listNotifications(userId: string) {
  const result = await tablesDB.listRows<NotificationRow>({
    databaseId: DATABASE_ID,
    tableId: TABLES.notifications,
    queries: [Query.equal('userId', userId), Query.orderDesc('$createdAt'), Query.limit(100)],
  });
  return result.rows;
}

export async function markNotificationRead(notificationId: string) {
  return tablesDB.updateRow<NotificationRow>({
    databaseId: DATABASE_ID,
    tableId: TABLES.notifications,
    rowId: notificationId,
    data: { readAt: new Date().toISOString() },
  });
}
