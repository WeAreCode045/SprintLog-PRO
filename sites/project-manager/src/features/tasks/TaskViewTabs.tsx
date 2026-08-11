import { useState, type ReactNode } from 'react';
import { ClipboardList, Code, Filter, Users, type LucideIcon } from 'lucide-react';
import { useLingui } from '@lingui/react/macro';
import type { ResolvedRole } from '../../appwrite/types';
import {
  TASK_VIEW_TAB_ORDER,
  type TaskViewTab,
  type TaskViewTabCounts,
  taskViewTabLabel,
} from './taskViewTabUtils';

interface TaskViewTabsProps {
  activeTab: TaskViewTab;
  onTabChange: (tab: TaskViewTab) => void;
  counts: TaskViewTabCounts;
  role: ResolvedRole;
  endAction?: ReactNode;
  filters?: ReactNode;
}

const TASK_VIEW_TAB_ICONS: Record<TaskViewTab, LucideIcon> = {
  developer: Code,
  client: Users,
  requested: ClipboardList,
};

export function TaskViewTabs({
  activeTab,
  onTabChange,
  counts,
  role,
  endAction,
  filters,
}: TaskViewTabsProps) {
  const { t } = useLingui();
  const [showFilters, setShowFilters] = useState(false);

  return (
    <div className="task-view-tabs-container" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1rem' }}>
      <div className="filter-bar task-view-tabs-bar" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: 0 }}>
        <div className="task-view-tabs" role="tablist" aria-label={t`Taakweergaven`}>
          {TASK_VIEW_TAB_ORDER.map((tab) => {
            const Icon = TASK_VIEW_TAB_ICONS[tab];
            const isActive = activeTab === tab;

            return (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={isActive}
                className={`task-view-tab${isActive ? ' active' : ''}`}
                onClick={() => onTabChange(tab)}
              >
                <Icon className="task-view-tab-icon" size={16} aria-hidden />
                <span>{taskViewTabLabel(tab, role)}</span>
                <span className="tab-count-badge">{counts[tab]}</span>
              </button>
            );
          })}
        </div>

        {filters ? (
          <button
            type="button"
            className={`task-view-filter-toggle${showFilters ? ' active' : ''}`}
            onClick={() => setShowFilters((v) => !v)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.4rem 0.75rem',
              borderRadius: '8px',
              border: '1px solid var(--border)',
              background: showFilters ? 'color-mix(in srgb, var(--accent) 12%, var(--surface))' : 'var(--surface)',
              color: showFilters ? 'var(--accent)' : 'var(--text-muted)',
              fontSize: '0.85rem',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <Filter size={15} />
            <span>{t`Filter`}</span>
          </button>
        ) : null}

        {endAction ? <div className="task-view-tabs-action" style={{ marginLeft: 'auto' }}>{endAction}</div> : null}
      </div>

      {filters && showFilters ? (
        <div className="task-view-filters-below" style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', padding: '0.25rem 0' }}>
          {filters}
        </div>
      ) : null}
    </div>
  );
}
