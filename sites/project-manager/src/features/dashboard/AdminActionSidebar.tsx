import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Trans } from '@lingui/react/macro';
import {
  MessagesSquare,
  ArrowRight,
  Clock,
  Calendar,
  ListTodo,
} from 'lucide-react';
import type { DiscussionRow, DiscussionCategoryType, TaskRow, ProjectRow } from '../../appwrite/types';
import { discussionCategoryLabel } from '../discussions/TopicList';
import dayjs from 'dayjs';

function formatTimeAgo(isoString: string): string {
  const d = dayjs(isoString);
  const now = dayjs();
  const diffMinutes = now.diff(d, 'minute');
  if (diffMinutes < 1) return 'Zojuist';
  if (diffMinutes < 60) return `${diffMinutes}m geleden`;
  const diffHours = now.diff(d, 'hour');
  if (diffHours < 24) return `${diffHours}u geleden`;
  const diffDays = now.diff(d, 'day');
  if (diffDays === 1) return 'Gisteren';
  if (diffDays < 7) return `${diffDays}d geleden`;
  return d.format('D MMM');
}

const PRIORITY_ORDER: Record<string, number> = {
  urgent: 1,
  high: 2,
  medium: 3,
  low: 4,
};

interface AdminActionSidebarProps {
  discussions?: DiscussionRow[];
  discussionFeed: Array<{
    id: string;
    title: string;
    topicTitle?: string;
    authorName?: string;
    actionText?: string;
    createdAt: string;
    href: string;
    kind: 'topic' | 'reply';
    categoryType: DiscussionCategoryType | string;
    projectId?: string;
  }>;
  tasks: TaskRow[];
  projects: ProjectRow[];
}

export function AdminActionSidebar({
  discussionFeed,
  tasks,
  projects,
}: AdminActionSidebarProps) {
  const projectNameById = useMemo(
    () => new Map(projects.map((p) => [p.$id, p.name])),
    [projects],
  );

  // 1. New topics/replies visible for at least 48h
  const newDiscussions = useMemo(() => {
    const fortyEightHoursAgo = dayjs().subtract(48, 'hour');
    const filtered = discussionFeed.filter((item) => dayjs(item.createdAt).isAfter(fortyEightHoursAgo));
    return filtered.length > 0 ? filtered.slice(0, 8) : discussionFeed.slice(0, 5);
  }, [discussionFeed]);

  // 2. 5 Upcoming tasks based on priority & due date
  const upcomingTasks = useMemo(() => {
    const openTasks = tasks.filter((t) => t.status === 'open');
    return openTasks
      .slice()
      .sort((a, b) => {
        const pA = PRIORITY_ORDER[a.priority || 'medium'] || 3;
        const pB = PRIORITY_ORDER[b.priority || 'medium'] || 3;
        if (pA !== pB) return pA - pB;
        if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
        if (a.dueDate) return -1;
        if (b.dueDate) return 1;
        return (a.order ?? 0) - (b.order ?? 0);
      })
      .slice(0, 5);
  }, [tasks]);

  return (
    <aside className="admin-action-sidebar">
      {/* 1. New Topics & Replies */}
      <section className="admin-action-block">
        <div className="admin-action-block-header">
          <div className="admin-action-title">
            <span className="admin-action-badge-icon admin-action-badge--accent">
              <MessagesSquare size={15} />
            </span>
            <h4><Trans>Nieuwe Topics & Reacties</Trans></h4>
          </div>
          <Link to="/app/discussions" className="admin-bottom-card-link">
            <Trans>Alles</Trans> <ArrowRight size={13} />
          </Link>
        </div>

        <div className="admin-action-block-body">
          {newDiscussions.length === 0 ? (
            <p className="admin-action-empty">
              <Trans>Geen nieuwe discussies sinds je laatste bezoek.</Trans>
            </p>
          ) : (
            <ul className="admin-bottom-list">
              {newDiscussions.map((item) => {
                const actionText =
                  item.actionText ||
                  (item.kind === 'topic' ? 'Nieuw topic' : 'Nieuwe reactie');
                const topicTitle = item.topicTitle || item.title;
                const categoryLabel =
                  item.categoryType === 'project'
                    ? (item.projectId && projectNameById.get(item.projectId)) || discussionCategoryLabel('project')
                    : discussionCategoryLabel((item.categoryType as DiscussionCategoryType) || 'general');

                return (
                  <li key={item.id} className="admin-bottom-item">
                    <Link to={item.href} className="admin-bottom-item-btn">
                      <div className="admin-bottom-item-content">
                        <div className="admin-bottom-item-headline">
                          <span className="admin-bottom-item-action" title={actionText}>
                            {actionText}
                          </span>
                          <span className="admin-bottom-tag" title={categoryLabel}>
                            {categoryLabel}
                          </span>
                        </div>
                        <div className="admin-bottom-item-title-row">
                          <span className="admin-bottom-item-title" title={topicTitle}>
                            {topicTitle}
                          </span>
                          <span className="admin-bottom-date">
                            <Clock size={11} /> {formatTimeAgo(item.createdAt)}
                          </span>
                        </div>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      {/* 2. 5 Upcoming Tasks based on Priority */}
      <section className="admin-action-block">
        <div className="admin-action-block-header">
          <div className="admin-action-title">
            <span className="admin-action-badge-icon admin-action-badge--sidebar">
              <ListTodo size={15} />
            </span>
            <h4><Trans>Nog te voltooien taken</Trans></h4>
          </div>
          <Link to="/app/tasks" className="admin-bottom-card-link">
            <Trans>Alles</Trans> <ArrowRight size={13} />
          </Link>
        </div>

        <div className="admin-action-block-body">
          {upcomingTasks.length === 0 ? (
            <p className="admin-action-empty">
              <Trans>Geen openstaande taken.</Trans>
            </p>
          ) : (
            <div className="admin-action-list">
              {upcomingTasks.map((task) => {
                const priority = task.priority || 'medium';
                return (
                  <Link
                    key={task.$id}
                    to={`/app/tasks/${task.$id}`}
                    className="admin-upcoming-task-item"
                  >
                    <div className="admin-upcoming-left">
                      <span className={`admin-priority-badge admin-priority--${priority}`}>
                        {priority}
                      </span>
                      <div className="admin-upcoming-info">
                        <span className="admin-upcoming-title" title={task.title}>
                          {task.title}
                        </span>
                        <span className="admin-upcoming-project">
                          {projectNameById.get(task.projectId) || 'Project'}
                        </span>
                      </div>
                    </div>

                    {task.dueDate && (
                      <span className="admin-upcoming-date">
                        <Calendar size={11} /> {dayjs(task.dueDate).format('D MMM')}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </aside>
  );
}
