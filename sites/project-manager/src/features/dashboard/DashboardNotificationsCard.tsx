import { useEffect, useMemo, useState } from 'react';
import { Bell, ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Trans, useLingui } from '@lingui/react/macro';
import type { NotificationRow } from '../../appwrite/types';
import { useDeleteNotification, useMarkNotificationRead } from '../notifications/hooks';
import {
  getDashboardNotificationDescription,
  getDashboardNotificationIcon,
  getDashboardNotificationTitle,
} from './dashboardNotificationDisplay';
import { isPersistentDashboardNotification } from './dashboardNotificationUtils';

const VISIBLE_COUNT = 3;

interface DashboardNotificationsCardProps {
  notifications: NotificationRow[];
  userId: string;
}

export function DashboardNotificationsCard({ notifications, userId }: DashboardNotificationsCardProps) {
  const { t } = useLingui();
  const navigate = useNavigate();
  const markRead = useMarkNotificationRead(userId);
  const deleteNotification = useDeleteNotification(userId);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [startIndex, setStartIndex] = useState(0);

  const activeNotifications = useMemo(
    () => notifications.filter((notification) => !dismissedIds.has(notification.$id)),
    [notifications, dismissedIds],
  );

  const maxStartIndex = Math.max(0, activeNotifications.length - VISIBLE_COUNT);
  const safeStartIndex = Math.min(startIndex, maxStartIndex);

  useEffect(() => {
    setStartIndex((current) => Math.min(current, maxStartIndex));
  }, [maxStartIndex]);

  const visibleNotifications = useMemo(
    () => activeNotifications.slice(safeStartIndex, safeStartIndex + VISIBLE_COUNT),
    [activeNotifications, safeStartIndex],
  );

  function goToPrevious() {
    setStartIndex((current) => Math.max(0, current - 1));
  }

  function goToNext() {
    setStartIndex((current) => Math.min(maxStartIndex, current + 1));
  }

  async function handleClick(notification: NotificationRow) {
    if (isPersistentDashboardNotification(notification)) {
      if (notification.href) {
        navigate(notification.href);
      }
      return;
    }
    if (!notification.readAt) {
      await markRead.mutateAsync(notification.$id);
    }
    if (notification.href) {
      navigate(notification.href);
    }
  }

  async function handleDelete(e: React.MouseEvent, notification: NotificationRow) {
    e.stopPropagation();
    setDismissedIds((prev) => new Set(prev).add(notification.$id));

    if (!isPersistentDashboardNotification(notification)) {
      try {
        await deleteNotification.mutateAsync(notification.$id);
      } catch {
        try {
          await markRead.mutateAsync(notification.$id);
        } catch {
          // ignore
        }
      }
    }
  }

  return (
    <section className="dashboard-v2-notifications">
      <header className="dashboard-v2-notifications-header">
        <Bell size={16} />
        <Trans>Notificaties</Trans>
        {activeNotifications.length > VISIBLE_COUNT && (
          <div className="dashboard-v2-notifications-nav">
            <button
              type="button"
              className="dashboard-v2-notifications-nav-btn"
              onClick={goToPrevious}
              disabled={safeStartIndex === 0}
              aria-label="Previous notification"
            >
              <ChevronUp size={16} strokeWidth={2.5} />
            </button>
            <button
              type="button"
              className="dashboard-v2-notifications-nav-btn"
              onClick={goToNext}
              disabled={safeStartIndex >= maxStartIndex}
              aria-label="Next notification"
            >
              <ChevronDown size={16} strokeWidth={2.5} />
            </button>
          </div>
        )}
      </header>
      <p className="dashboard-v2-notifications-description">
        <Trans>Meldingen die je actie of aandacht vragen.</Trans>
      </p>

      {activeNotifications.length === 0 ? (
        <p className="dashboard-v2-notifications-empty">
          <Trans>Geen nieuwe meldingen.</Trans>
        </p>
      ) : (
        <ul className="dashboard-v2-notifications-list">
          {visibleNotifications.map((notification) => {
            const isUnread = !notification.readAt;
            const title = getDashboardNotificationTitle(notification);
            const description = getDashboardNotificationDescription(notification);
            const Icon = getDashboardNotificationIcon(notification);

            return (
              <li key={notification.$id} className="dashboard-v2-notifications-item">
                <div
                  className={`dashboard-v2-notifications-card${isUnread ? ' dashboard-v2-notifications-card--unread' : ''}`}
                >
                  <button
                    type="button"
                    className="dashboard-v2-notifications-main-btn"
                    onClick={() => void handleClick(notification)}
                  >
                    <span className="dashboard-v2-notifications-line">
                      <span className="dashboard-v2-notifications-item-icon" aria-hidden>
                        <Icon size={18} strokeWidth={2} />
                      </span>
                      <span className="dashboard-v2-notifications-item-content">
                        <span className="dashboard-v2-notifications-item-title">{title}</span>
                        {description && (
                          <span className="dashboard-v2-notifications-text">{description}</span>
                        )}
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    className="dashboard-v2-notifications-delete-btn"
                    onClick={(e) => void handleDelete(e, notification)}
                    title={t`Verwijderen`}
                    aria-label={t`Verwijder notificatie`}
                  >
                    <Trash2 size={15} strokeWidth={2} />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
