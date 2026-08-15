import { FolderPlus, ListTodo, MessagesSquare, Timer } from 'lucide-react';
import { Trans } from '@lingui/react/macro';
import type { DashboardOverview } from './useDashboardOverview';
import { formatHours } from '../../lib/formatHours';

export function DashboardStatsCards({
  stats,
  columns = 4,
}: {
  stats: DashboardOverview['currentStats'];
  columns?: 2 | 4;
}) {
  return (
    <div className="dashboard-stats-cards">
      <div
        className="dashboard-stats-cards-grid"
        style={{
          gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
        }}
      >
        <div style={{ background: 'var(--sidebar-bg)', padding: '1rem 1.5rem', borderRadius: '0.625rem', border: '1px solid color-mix(in srgb, var(--accent, #f4622c) 35%, #333)', boxShadow: '0 4px 12px rgba(0,0,0,0.25)' }}>
          <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--accent, #f4622c)', fontWeight: 700, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <ListTodo size={14} style={{ color: 'var(--accent)' }} /> <Trans>Taken</Trans>
          </div>
          <div style={{ fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.3rem', color: '#fff' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'color-mix(in srgb, #fff 75%, transparent)' }}><Trans>Nieuw:</Trans></span> <strong style={{ color: '#fff' }}>{stats.newTasks}</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'color-mix(in srgb, #fff 75%, transparent)' }}><Trans>Afgerond:</Trans></span> <strong style={{ color: 'var(--accent, #f4622c)' }}>{stats.tasksCompleted}</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'color-mix(in srgb, #fff 75%, transparent)' }}><Trans>Aanvragen:</Trans></span> <strong style={{ color: '#ff9838' }}>{stats.taskRequests}</strong></div>
          </div>
        </div>

        <div style={{ background: 'var(--sidebar-bg)', padding: '1rem 1.5rem', borderRadius: '0.625rem', border: '1px solid color-mix(in srgb, var(--accent, #f4622c) 35%, #333)', boxShadow: '0 4px 12px rgba(0,0,0,0.25)' }}>
          <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--accent, #f4622c)', fontWeight: 700, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <Timer size={14} style={{ color: 'var(--accent)' }} /> <Trans>Uren</Trans>
          </div>
          <div style={{ fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.3rem', color: '#fff' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'color-mix(in srgb, #fff 75%, transparent)' }}><Trans>Totaal:</Trans></span> <strong style={{ color: '#fff' }}>{formatHours(stats.totalHours)}</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'color-mix(in srgb, #fff 75%, transparent)' }}><Trans>Gem/Taak:</Trans></span> <strong style={{ color: '#fff' }}>{formatHours(stats.avgHoursPerTask)}</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'color-mix(in srgb, #fff 75%, transparent)' }}><Trans>Gem/Proj:</Trans></span> <strong style={{ color: '#fff' }}>{formatHours(stats.avgHoursPerProject)}</strong></div>
          </div>
        </div>

        <div style={{ background: 'var(--sidebar-bg)', padding: '1rem 1.5rem', borderRadius: '0.625rem', border: '1px solid color-mix(in srgb, var(--accent, #f4622c) 35%, #333)', boxShadow: '0 4px 12px rgba(0,0,0,0.25)' }}>
          <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--accent, #f4622c)', fontWeight: 700, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <MessagesSquare size={14} style={{ color: 'var(--accent)' }} /> <Trans>Discussies</Trans>
          </div>
          <div style={{ fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.3rem', color: '#fff' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'color-mix(in srgb, #fff 75%, transparent)' }}><Trans>Topics:</Trans></span> <strong style={{ color: '#fff' }}>{stats.totalNewTopics}</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'color-mix(in srgb, #fff 75%, transparent)' }}><Trans>Reacties:</Trans></span> <strong style={{ color: '#fff' }}>{stats.totalReplies}</strong></div>
          </div>
        </div>

        <div style={{ background: 'var(--sidebar-bg)', padding: '1rem 1.5rem', borderRadius: '0.625rem', border: '1px solid color-mix(in srgb, var(--accent, #f4622c) 35%, #333)', boxShadow: '0 4px 12px rgba(0,0,0,0.25)' }}>
          <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--accent, #f4622c)', fontWeight: 700, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <FolderPlus size={14} style={{ color: 'var(--accent)' }} /> <Trans>Projecten</Trans>
          </div>
          <div style={{ fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.3rem', color: '#fff' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'color-mix(in srgb, #fff 75%, transparent)' }}><Trans>Totaal:</Trans></span> <strong style={{ color: '#fff' }}>{stats.totalProjects}</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'color-mix(in srgb, #fff 75%, transparent)' }}><Trans>Nieuw:</Trans></span> <strong style={{ color: '#fff' }}>{stats.newProjects}</strong></div>
          </div>
        </div>
      </div>
    </div>
  );
}
