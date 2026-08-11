import { Lightbulb, FolderKanban, MessagesSquare, LayoutGrid } from 'lucide-react';
import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';
import type { DiscussionCategoryType } from '../../appwrite/types';
import { discussionCategoryLabel, type DiscussionCategoryFilter } from './TopicList';

interface DiscussionCategorySidebarProps {
  active: DiscussionCategoryFilter;
  onChange: (filter: DiscussionCategoryFilter) => void;
  counts?: Partial<Record<DiscussionCategoryFilter, number>>;
}

function items(): Array<{
  key: DiscussionCategoryFilter;
  label: string;
  icon: typeof LayoutGrid;
}> {
  return [
    { key: 'all', label: t`Alles`, icon: LayoutGrid },
    { key: 'general', label: discussionCategoryLabel('general'), icon: MessagesSquare },
    { key: 'idea', label: discussionCategoryLabel('idea'), icon: Lightbulb },
    { key: 'project', label: discussionCategoryLabel('project'), icon: FolderKanban },
  ];
}

export function DiscussionCategorySidebar({
  active,
  onChange,
  counts,
}: DiscussionCategorySidebarProps) {
  return (
    <nav className="forum-sidebar" aria-label={t`Discussiecategorieën`}>
      <h2 className="forum-sidebar-title">
        <LayoutGrid size={16} aria-hidden /> <Trans>Categorieën</Trans>
      </h2>
      <ul className="forum-sidebar-list">
        {items().map(({ key, label, icon: Icon }) => {
          const count = counts?.[key];
          return (
            <li key={key}>
              <button
                type="button"
                className={`forum-sidebar-item ${active === key ? 'is-active' : ''}`}
                onClick={() => onChange(key)}
                aria-current={active === key ? 'page' : undefined}
              >
                <Icon size={16} aria-hidden />
                <span>{label}</span>
                {typeof count === 'number' && (
                  <span className="forum-sidebar-count">{count}</span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export type { DiscussionCategoryType };
