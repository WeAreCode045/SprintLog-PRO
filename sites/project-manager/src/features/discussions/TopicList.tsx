import dayjs from 'dayjs';
import { MessageSquare } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Trans, useLingui } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';
import {
  DISCUSSION_CATEGORY_TYPES,
  type DiscussionCategoryType,
  type DiscussionRow,
} from '../../appwrite/types';

export type DiscussionCategoryFilter = DiscussionCategoryType | 'all';

export function discussionCategoryLabel(type: DiscussionCategoryType): string {
  switch (type) {
    case 'general':
      return t`Algemeen`;
    case 'idea':
      return t`Ideeën`;
    case 'project':
      return t`Projecten`;
    default: {
      const _exhaustive: never = type;
      return _exhaustive;
    }
  }
}

export function formatDiscussionDate(value: string) {
  return dayjs(value).format('D MMM YYYY HH:mm');
}

export function authorInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
}

export function groupDiscussionsByCategory(
  discussions: DiscussionRow[],
): Record<DiscussionCategoryType, DiscussionRow[]> {
  const groups: Record<DiscussionCategoryType, DiscussionRow[]> = {
    general: [],
    idea: [],
    project: [],
  };
  for (const discussion of discussions) {
    const type = discussion.categoryType ?? 'project';
    groups[type].push(discussion);
  }
  return groups;
}

/** Group project discussions by projectId; keys ordered by project display name. */
export function groupDiscussionsByProject(
  discussions: DiscussionRow[],
  projectName: (projectId: string) => string,
): { projectId: string; title: string; discussions: DiscussionRow[] }[] {
  const byProject = new Map<string, DiscussionRow[]>();
  for (const discussion of discussions) {
    const projectId = discussion.projectId || discussion.categoryId;
    const list = byProject.get(projectId);
    if (list) list.push(discussion);
    else byProject.set(projectId, [discussion]);
  }
  return [...byProject.entries()]
    .map(([projectId, rows]) => ({
      projectId,
      title: projectName(projectId),
      discussions: rows,
    }))
    .sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }));
}

export function orderedCategoryTypes(
  filter: DiscussionCategoryFilter,
): DiscussionCategoryType[] {
  if (filter === 'all') return [...DISCUSSION_CATEGORY_TYPES];
  return [filter];
}

interface TopicListItemProps {
  discussion: DiscussionRow;
  companyId: string;
  displayName: (userId: string) => string;
  projectName?: (projectId: string) => string;
  to: string;
}

export function TopicListItem({
  discussion,
  displayName,
  projectName,
  to,
}: TopicListItemProps) {
  const { t } = useLingui();
  const replyCount = discussion.totalReplies ?? 0;
  return (
    <li>
      <Link to={to} className="forum-topic-item">
        <span className="forum-topic-avatar" aria-hidden>
          {authorInitials(displayName(discussion.createdBy))}
        </span>
        <span className="forum-topic-main">
          <span className="forum-topic-title">{discussion.title}</span>
          <span className="forum-topic-meta">
            <span>{displayName(discussion.createdBy)}</span>
            <span aria-hidden>·</span>
            <span>{formatDiscussionDate(discussion.$createdAt)}</span>
            {discussion.categoryType === 'project' && projectName && (
              <>
                <span aria-hidden>·</span>
                <span>{projectName(discussion.projectId)}</span>
              </>
            )}
          </span>
        </span>
        <span className="forum-topic-replies" title={t`Reacties`}>
          <MessageSquare size={14} aria-hidden />
          {replyCount}
        </span>
      </Link>
    </li>
  );
}

interface TopicListProps {
  companyId: string;
  discussions: DiscussionRow[];
  filter: DiscussionCategoryFilter;
  isLoading?: boolean;
  displayName: (userId: string) => string;
  projectName?: (projectId: string) => string;
  emptyMessage?: string;
  /** When set, links stay in-board via callback instead of routing (project tab). */
  onOpenDiscussion?: (discussionId: string) => void;
  detailPath?: (discussionId: string) => string;
  grouped?: boolean;
}

export function TopicList({
  companyId,
  discussions,
  filter,
  isLoading,
  displayName,
  projectName,
  emptyMessage,
  onOpenDiscussion,
  detailPath,
  grouped = true,
}: TopicListProps) {
  const { t } = useLingui();
  if (isLoading) {
    return <p className="forum-loading"><Trans>Laden…</Trans></p>;
  }

  const resolvedEmptyMessage = emptyMessage ?? t`Nog geen discussies.`;
  const types = orderedCategoryTypes(filter);
  const groups = groupDiscussionsByCategory(discussions);
  const visible = types.flatMap((type) => groups[type]);

  if (visible.length === 0) {
    return <p className="empty-state">{resolvedEmptyMessage}</p>;
  }

  function hrefFor(discussionId: string) {
    return detailPath?.(discussionId) ?? `/app/discussions/${discussionId}`;
  }

  if (filter === 'project' && projectName) {
    const projectGroups = groupDiscussionsByProject(visible, projectName);
    return (
      <div className="forum-topic-groups">
        {projectGroups.map((group) => (
          <section
            key={group.projectId}
            className="forum-topic-group"
            aria-label={group.title}
          >
            <h3 className="forum-topic-group-title">{group.title}</h3>
            <ul className="forum-topic-list">
              {group.discussions.map((discussion) =>
                onOpenDiscussion ? (
                  <li key={discussion.$id}>
                    <button
                      type="button"
                      className="forum-topic-item forum-topic-item--button"
                      onClick={() => onOpenDiscussion(discussion.$id)}
                    >
                      <span className="forum-topic-avatar" aria-hidden>
                        {authorInitials(displayName(discussion.createdBy))}
                      </span>
                      <span className="forum-topic-main">
                        <span className="forum-topic-title">{discussion.title}</span>
                        <span className="forum-topic-meta">
                          <span>{displayName(discussion.createdBy)}</span>
                          <span aria-hidden>·</span>
                          <span>{formatDiscussionDate(discussion.$createdAt)}</span>
                        </span>
                      </span>
                      <span className="forum-topic-replies">
                        <MessageSquare size={14} aria-hidden />
                        {discussion.totalReplies ?? 0}
                      </span>
                    </button>
                  </li>
                ) : (
                  <TopicListItem
                    key={discussion.$id}
                    discussion={discussion}
                    companyId={companyId}
                    displayName={displayName}
                    to={hrefFor(discussion.$id)}
                  />
                ),
              )}
            </ul>
          </section>
        ))}
      </div>
    );
  }

  if (!grouped || types.length === 1) {
    return (
      <ul className="forum-topic-list">
        {visible.map((discussion) =>
          onOpenDiscussion ? (
            <li key={discussion.$id}>
              <button
                type="button"
                className="forum-topic-item forum-topic-item--button"
                onClick={() => onOpenDiscussion(discussion.$id)}
              >
                <span className="forum-topic-avatar" aria-hidden>
                  {authorInitials(displayName(discussion.createdBy))}
                </span>
                <span className="forum-topic-main">
                  <span className="forum-topic-title">{discussion.title}</span>
                  <span className="forum-topic-meta">
                    <span>{displayName(discussion.createdBy)}</span>
                    <span aria-hidden>·</span>
                    <span>{formatDiscussionDate(discussion.$createdAt)}</span>
                  </span>
                </span>
                <span className="forum-topic-replies">
                  <MessageSquare size={14} aria-hidden />
                  {discussion.totalReplies ?? 0}
                </span>
              </button>
            </li>
          ) : (
            <TopicListItem
              key={discussion.$id}
              discussion={discussion}
              companyId={companyId}
              displayName={displayName}
              projectName={projectName}
              to={hrefFor(discussion.$id)}
            />
          ),
        )}
      </ul>
    );
  }

  return (
    <div className="forum-topic-groups">
      {types.map((type) => {
        const rows = groups[type];
        if (rows.length === 0) return null;
        return (
          <section key={type} className="forum-topic-group" aria-label={discussionCategoryLabel(type)}>
            <h3 className="forum-topic-group-title">{discussionCategoryLabel(type)}</h3>
            <ul className="forum-topic-list">
              {rows.map((discussion) => (
                <TopicListItem
                  key={discussion.$id}
                  discussion={discussion}
                  companyId={companyId}
                  displayName={displayName}
                  projectName={projectName}
                  to={hrefFor(discussion.$id)}
                />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
