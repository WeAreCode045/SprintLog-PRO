import { useEffect, useMemo, useState } from 'react';
import { Bell, ChevronDown, ChevronUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Trans } from '@lingui/react/macro';
import type { NotificationRow } from '../../appwrite/types';
import { useMarkNotificationRead } from '../notifications/hooks';
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
  const navigate = useNavigate();
  const markRead = useMarkNotificationRead(userId);
  const [startIndex, setStartIndex] = useState(0);

  const maxStartIndex = Math.max(0, notifications.length - VISIBLE_COUNT);
  const safeStartIndex = Math.min(startIndex, maxStartIndex);

  useEffect(() => {
    setStartIndex((current) => Math.min(current, maxStartIndex));
  }, [maxStartIndex]);

  const visibleNotifications = useMemo(
    () => notifications.slice(safeStartIndex, safeStartIndex + VISIBLE_COUNT),
    [notifications, safeStartIndex],
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

  return (
    <section className="dashboard-v2-notifications">
      <header className="dashboard-v2-notifications-header">
        <Bell size={16} />
        <Trans>Notificaties</Trans>
        {notifications.length > VISIBLE_COUNT && (
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

      {notifications.length === 0 ? (
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
                <button
                  type="button"
                  className={`dashboard-v2-notifications-button${isUnread ? ' dashboard-v2-notifications-button--unread' : ''}`}
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
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
