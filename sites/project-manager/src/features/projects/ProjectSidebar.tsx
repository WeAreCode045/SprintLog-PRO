import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueries } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { Bell, Copy, Download, FolderOpen, Info, Link2, MessageSquare, Users } from 'lucide-react';
import { Trans, useLingui } from '@lingui/react/macro';
import { t as staticT } from '@lingui/core/macro';
import type { NotificationRow, ProjectRow, ProjectStatus, ResolvedRole } from '../../appwrite/types';
import { queryKeys } from '../../lib/queryKeys';
import { IconEdit } from '../../components/icons';
import { useProjectAssignments } from '../assignments/hooks';
import { listDiscussionReplies } from '../discussions/api';
import { useDiscussions } from '../discussions/hooks';
import { getFileViewUrl } from '../files/api';
import { useProjectFiles } from '../files/hooks';
import { useMarkNotificationRead, useNotifications } from '../notifications/hooks';
import { useDeveloperProfiles } from '../profiles/hooks';
import { ProjectEditDialog } from './ProjectEditDialog';
import { getProjectLastVisit, isAfterLastVisit } from './projectLastVisit';

const DISCUSSION_LIMIT = 5;
const FILE_LIMIT = 5;
const NOTIFICATION_LIMIT = 8;

interface ProjectSidebarProps {
  companyId: string;
  teamId: string;
  userId: string;
  project: ProjectRow;
  role: ResolvedRole;
  onOpenDiscussionTab: () => void;
  onOpenFilesTab: () => void;
}

function hrefForProjectLink(link: string) {
  const trimmed = link.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function displayProjectLink(link: string) {
  return link.replace(/^https?:\/\//i, '');
}

function formatBytes(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function projectStatusLabel(status: ProjectStatus) {
  switch (status) {
    case 'active':
      return staticT`Actief`;
    case 'on_hold':
      return staticT`In de wacht`;
    case 'completed':
      return staticT`Voltooid`;
    case 'archived':
      return staticT`Gearchiveerd`;
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

function notificationMeta(notification: NotificationRow) {
  switch (notification.type) {
    case 'task_completed':
      return staticT`Taak afgerond`;
    case 'file_requested':
      return staticT`Bestand aangevraagd`;
    case 'task_created':
      return staticT`Nieuwe taak`;
    case 'discussion_active':
      return staticT`Discussie`;
    case 'task_assigned':
      return staticT`Taak toegewezen`;
    case 'file_uploaded':
      return staticT`Bestand geüpload`;
    case 'hours_approved':
      return staticT`Uren goedgekeurd`;
    case 'hours_unlocked':
      return staticT`Uren gedeblokkeerd`;
    default: {
      const _exhaustive: never = notification.type;
      return _exhaustive;
    }
  }
}

export function ProjectSidebar({
  companyId,
  teamId,
  userId,
  project,
  role,
  onOpenDiscussionTab,
  onOpenFilesTab,
}: ProjectSidebarProps) {
  const { t } = useLingui();
  const navigate = useNavigate();
  const { data: discussions = [] } = useDiscussions(project.$id);
  const { data: files = [] } = useProjectFiles(project.$id);
  const { data: notifications = [] } = useNotifications(userId);
  const { data: assignments = [] } = useProjectAssignments(project.$id);
  const { data: developers = [] } = useDeveloperProfiles(true);
  const markRead = useMarkNotificationRead(userId);

  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [lastVisitIso] = useState(() => getProjectLastVisit(userId, project.$id));
  const projectLink = project.link?.trim() || null;

  const assignedDeveloperNames = useMemo(() => {
    const byUserId = new Map(developers.map((profile) => [profile.userId, profile.displayName]));
    return assignments
      .map((assignment) => byUserId.get(assignment.userId) ?? assignment.userId)
      .sort((a, b) => a.localeCompare(b, 'nl'));
  }, [assignments, developers]);

  const recentDiscussions = useMemo(
    () =>
      discussions
        .slice()
        .sort((a, b) => b.$createdAt.localeCompare(a.$createdAt))
        .slice(0, DISCUSSION_LIMIT),
    [discussions],
  );

  const replyQueries = useQueries({
    queries: recentDiscussions.map((discussion) => ({
      queryKey: queryKeys.discussionReplies(discussion.$id),
      queryFn: () => listDiscussionReplies(discussion.$id),
    })),
  });

  const discussionUnreadById = useMemo(() => {
    const map = new Map<string, boolean>();
    recentDiscussions.forEach((discussion, index) => {
      const replies = replyQueries[index]?.data ?? [];
      const discussionNew = isAfterLastVisit(discussion.$createdAt, lastVisitIso);
      const replyNew = replies.some((reply) => isAfterLastVisit(reply.$createdAt, lastVisitIso));
      map.set(discussion.$id, discussionNew || replyNew);
    });
    return map;
  }, [recentDiscussions, replyQueries, lastVisitIso]);

  const projectNotifications = useMemo(() => {
    return notifications
      .filter((item) => item.projectId === project.$id)
      .slice()
      .sort((a, b) => {
        const unreadDiff = Number(!a.readAt) - Number(!b.readAt);
        if (unreadDiff !== 0) return unreadDiff > 0 ? -1 : 1;
        return b.$createdAt.localeCompare(a.$createdAt);
      })
      .slice(0, NOTIFICATION_LIMIT);
  }, [notifications, project.$id]);

  const latestFiles = useMemo(
    () =>
      files
        .slice()
        .sort((a, b) => b.$createdAt.localeCompare(a.$createdAt))
        .slice(0, FILE_LIMIT),
    [files],
  );

  async function handleCopyLink() {
    if (!projectLink) return;
    try {
      await navigator.clipboard.writeText(hrefForProjectLink(projectLink));
      setCopyFeedback(t`Gekopieerd`);
      window.setTimeout(() => setCopyFeedback(null), 1500);
    } catch {
      setCopyFeedback(t`Kopiëren mislukt`);
      window.setTimeout(() => setCopyFeedback(null), 1500);
    }
  }

  async function handleNotificationClick(notification: NotificationRow) {
    if (!notification.readAt) {
      await markRead.mutateAsync(notification.$id);
    }
    if (notification.href) {
      navigate(notification.href);
    }
  }

  return (
    <aside className="client-dashboard-side project-detail-sidebar">
      <section className="report-card project-info-card">
        <div className="report-card-header">
          <h3>
            <Info size={16} /> <Trans>Project info</Trans>
          </h3>
          {(role === 'admin' || role === 'developer') && (
            <button
              type="button"
              className="icon-button"
              title={t`Project bewerken`}
              onClick={() => setShowEditDialog(true)}
            >
              <IconEdit />
            </button>
          )}
        </div>
        <div className="project-info-body">
          <div className="project-info-top">
            <h4 className="project-info-name">{project.name}</h4>
            <span className={`badge badge-status badge-status--${project.status ?? 'active'}`}>
              {projectStatusLabel(project.status ?? 'active')}
            </span>
          </div>

          {projectLink ? (
            <div className="project-info-link-row">
              <a
                className="project-info-link"
                href={hrefForProjectLink(projectLink)}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Link2 size={14} />
                <span>{displayProjectLink(projectLink)}</span>
              </a>
              <button
                type="button"
                className="icon-button"
                title={t`Kopieer link`}
                onClick={() => void handleCopyLink()}
              >
                <Copy size={14} />
              </button>
              {copyFeedback && <span className="save-confirmation">{copyFeedback}</span>}
            </div>
          ) : null}

          {project.description?.trim() ? (
            <p className="project-info-description">{project.description}</p>
          ) : null}

          <div className="project-info-developers">
            <span className="project-info-developers-label">
              <Users size={14} /> <Trans>Developers</Trans>
            </span>
            {assignedDeveloperNames.length === 0 ? (
              <span className="data-table-muted"><Trans>Nog geen developers toegewezen.</Trans></span>
            ) : (
              <div className="project-info-developer-chips">
                {assignedDeveloperNames.map((name) => (
                  <span key={name} className="project-info-chip">
                    {name}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="report-card">
        <div className="report-card-header">
          <h3>
            <MessageSquare size={16} /> <Trans>Laatste discussies</Trans>
          </h3>
          <button type="button" className="btn-link report-card-action" onClick={onOpenDiscussionTab}>
            <Trans>Open</Trans>
          </button>
        </div>
        {recentDiscussions.length === 0 ? (
          <p className="empty-state"><Trans>Nog geen discussies.</Trans></p>
        ) : (
          <ul className="dashboard-list">
            {recentDiscussions.map((discussion) => {
              const unread = discussionUnreadById.get(discussion.$id);
              return (
                <li key={discussion.$id} className="dashboard-list-item">
                  <button type="button" className="dashboard-list-button" onClick={onOpenDiscussionTab}>
                    {unread && <span className="discussion-unread-dot" aria-label={t`Nieuwe activiteit`} />}
                    {discussion.title}
                  </button>
                  <span className="dashboard-list-meta">
                    {dayjs(discussion.$createdAt).format('D MMM HH:mm')}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="report-card">
        <div className="report-card-header">
          <h3><Trans>Meldingen</Trans></h3>
        </div>
        {projectNotifications.length === 0 ? (
          <p className="empty-state"><Trans>Geen projectmeldingen.</Trans></p>
        ) : (
          <ul className="dashboard-list">
            {projectNotifications.map((notification) => (
              <li key={notification.$id} className="dashboard-list-item">
                <button
                  type="button"
                  className={`dashboard-list-button ${notification.readAt ? '' : 'unread'}`}
                  onClick={() => void handleNotificationClick(notification)}
                >
                  {!notification.readAt && <Bell size={14} className="notification-inline-icon" />}
                  <span>{notification.title}</span>
                </button>
                <span className="dashboard-list-meta">
                  {notificationMeta(notification)} · {dayjs(notification.$createdAt).format('D MMM HH:mm')}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="report-card">
        <div className="report-card-header">
          <h3>
            <FolderOpen size={16} /> <Trans>Bestanden</Trans>
          </h3>
          <button type="button" className="btn-link report-card-action" onClick={onOpenFilesTab}>
            <Trans>Alle</Trans>
          </button>
        </div>
        {latestFiles.length === 0 ? (
          <p className="empty-state"><Trans>Nog geen bestanden.</Trans></p>
        ) : (
          <ul className="dashboard-list">
            {latestFiles.map((file) => (
              <li key={file.$id} className="dashboard-list-item">
                <a
                  className="dashboard-list-button"
                  href={getFileViewUrl(file.bucketFileId)}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Download size={14} className="notification-inline-icon" />
                  <span>{file.name}</span>
                </a>
                <span className="dashboard-list-meta">
                  {formatBytes(file.size)} · {dayjs(file.$createdAt).format('D MMM')}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {showEditDialog && (
        <ProjectEditDialog
          companyId={companyId}
          teamId={teamId}
          project={project}
          onClose={() => setShowEditDialog(false)}
        />
      )}
    </aside>
  );
}
