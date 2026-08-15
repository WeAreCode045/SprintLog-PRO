import { useMemo, useState } from 'react';
import { Trans } from '@lingui/react/macro';
import type { TaskRow, ProjectRow } from '../../appwrite/types';
import dayjs from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';

dayjs.extend(isoWeek);

type TasksFilterPeriod = 'week' | 'month' | 'project';

interface ClientCompletedTasksChartProps {
  tasks: TaskRow[];
  projects: ProjectRow[];
}

export function ClientCompletedTasksChart({
  tasks,
  projects,
}: ClientCompletedTasksChartProps) {
  const [period, setPeriod] = useState<TasksFilterPeriod>('week');
  const [hoveredBar, setHoveredBar] = useState<{
    label: string;
    completed: number;
    open: number;
    total: number;
  } | null>(null);

  const projectNameById = useMemo(
    () => new Map(projects.map((p) => [p.$id, p.name])),
    [projects],
  );

  const totalFinishedTasks = useMemo(
    () => tasks.filter((t) => t.status === 'finished').length,
    [tasks],
  );

  const totalOpenTasks = useMemo(
    () => tasks.filter((t) => t.status === 'open' || t.status === 'requested').length,
    [tasks],
  );

  const totalTasksCount = tasks.length;

  const barData = useMemo(() => {
    const now = dayjs();
    const bars: { label: string; completed: number; open: number; total: number }[] = [];

    if (period === 'week') {
      // Last 6 weeks
      for (let i = 5; i >= 0; i--) {
        const targetWeek = now.subtract(i, 'week');
        const startOfWeek = targetWeek.startOf('isoWeek');
        const endOfWeek = targetWeek.endOf('isoWeek');
        const label = `W${startOfWeek.isoWeek()}`;

        const weekCompleted = tasks.filter((t) => {
          if (t.status !== 'finished') return false;
          const d = dayjs(t.finishedAt || t.$updatedAt);
          return (
            (d.isAfter(startOfWeek) && d.isBefore(endOfWeek)) ||
            d.isSame(startOfWeek, 'day') ||
            d.isSame(endOfWeek, 'day')
          );
        }).length;

        const weekOpen = tasks.filter((t) => {
          if (t.status === 'finished') return false;
          const d = dayjs(t.$createdAt);
          return (
            (d.isAfter(startOfWeek) && d.isBefore(endOfWeek)) ||
            d.isSame(startOfWeek, 'day') ||
            d.isSame(endOfWeek, 'day')
          );
        }).length;

        bars.push({
          label,
          completed: weekCompleted,
          open: weekOpen,
          total: weekCompleted + weekOpen,
        });
      }
    } else if (period === 'month') {
      // Last 6 months
      for (let i = 5; i >= 0; i--) {
        const m = now.subtract(i, 'month');
        const startOfMonth = m.startOf('month');
        const endOfMonth = m.endOf('month');
        const label = m.format('MMM');

        const monthCompleted = tasks.filter((t) => {
          if (t.status !== 'finished') return false;
          const d = dayjs(t.finishedAt || t.$updatedAt);
          return (
            (d.isAfter(startOfMonth) && d.isBefore(endOfMonth)) ||
            d.isSame(startOfMonth, 'day') ||
            d.isSame(endOfMonth, 'day')
          );
        }).length;

        const monthOpen = tasks.filter((t) => {
          if (t.status === 'finished') return false;
          const d = dayjs(t.$createdAt);
          return (
            (d.isAfter(startOfMonth) && d.isBefore(endOfMonth)) ||
            d.isSame(startOfMonth, 'day') ||
            d.isSame(endOfMonth, 'day')
          );
        }).length;

        bars.push({
          label,
          completed: monthCompleted,
          open: monthOpen,
          total: monthCompleted + monthOpen,
        });
      }
    } else {
      // Per project
      const projectStatsMap = new Map<string, { completed: number; open: number }>();
      for (const p of projects) {
        projectStatsMap.set(p.$id, { completed: 0, open: 0 });
      }

      for (const t of tasks) {
        if (!t.projectId) continue;
        const current = projectStatsMap.get(t.projectId) ?? { completed: 0, open: 0 };
        if (t.status === 'finished') {
          current.completed += 1;
        } else {
          current.open += 1;
        }
        projectStatsMap.set(t.projectId, current);
      }

      const sortedProjects = [...projectStatsMap.entries()]
        .map(([id, stats]) => ({
          id,
          label: (projectNameById.get(id) || id).slice(0, 10),
          completed: stats.completed,
          open: stats.open,
          total: stats.completed + stats.open,
        }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 6);

      bars.push(...sortedProjects);
    }

    return bars;
  }, [period, tasks, projects, projectNameById]);

  const maxBarTotal = useMemo(() => {
    const max = Math.max(...barData.map((b) => b.total), 5);
    return Math.ceil(max * 1.15);
  }, [barData]);

  return (
    <div className="admin-chart-card admin-revenue-card">
      <div className="admin-chart-header">
        <div className="admin-chart-title-group">
          <h3 className="admin-chart-title">
            <Trans>Voltooide taken</Trans>
          </h3>
          <span className="admin-chart-subtitle">
            <Trans>Afgerond per periode</Trans>
          </span>
        </div>

        {/* Period Switcher */}
        <div className="admin-chart-switcher" role="tablist">
          <button
            type="button"
            className={`admin-chart-switch-btn ${period === 'week' ? 'active' : ''}`}
            onClick={() => setPeriod('week')}
          >
            <Trans>Week</Trans>
          </button>
          <button
            type="button"
            className={`admin-chart-switch-btn ${period === 'month' ? 'active' : ''}`}
            onClick={() => setPeriod('month')}
          >
            <Trans>Maand</Trans>
          </button>
          <button
            type="button"
            className={`admin-chart-switch-btn ${period === 'project' ? 'active' : ''}`}
            onClick={() => setPeriod('project')}
          >
            <Trans>Project</Trans>
          </button>
        </div>
      </div>

      <div className="admin-chart-body">
        <div className="admin-columns-container" onMouseLeave={() => setHoveredBar(null)}>
          {barData.map((b, idx) => {
            const completedPct = Math.max(b.completed > 0 ? 6 : 0, Math.round((b.completed / maxBarTotal) * 100));
            const openPct = Math.max(b.open > 0 ? 6 : 0, Math.round((b.open / maxBarTotal) * 100));

            return (
              <div
                key={`task-col-${idx}`}
                className="admin-column-wrapper"
                onMouseEnter={() => setHoveredBar(b)}
              >
                <div className="admin-column-bars">
                  {/* Completed Bar */}
                  <div
                    className="admin-col-bar admin-col-invoiced"
                    style={{ height: `${completedPct}%` }}
                    title={`Voltooid: ${b.completed}`}
                  />
                  {/* Open Bar */}
                  {b.open > 0 && (
                    <div
                      className="admin-col-bar admin-col-unbilled"
                      style={{ height: `${openPct}%` }}
                      title={`Openstaand: ${b.open}`}
                    />
                  )}
                </div>
                <span className="admin-column-label">{b.label}</span>
              </div>
            );
          })}
        </div>

        {/* Hover summary popup */}
        {hoveredBar && (
          <div className="admin-revenue-hover-badge">
            <span>
              <strong>{hoveredBar.label}:</strong> {hoveredBar.completed} voltooid
            </span>
            <small>
              Voltooid: {hoveredBar.completed} · Openstaand: {hoveredBar.open}
            </small>
          </div>
        )}
      </div>

      {/* Bottom Summary Metric Pills */}
      <div className="admin-revenue-summary-pills">
        <div className="admin-revenue-pill">
          <span className="admin-rev-pill-dot invoiced" />
          <div className="admin-rev-pill-content">
            <span className="admin-rev-pill-label"><Trans>Voltooid</Trans></span>
            <strong className="admin-rev-pill-val">{totalFinishedTasks}</strong>
          </div>
        </div>

        <div className="admin-revenue-pill">
          <span className="admin-rev-pill-dot unbilled" />
          <div className="admin-rev-pill-content">
            <span className="admin-rev-pill-label"><Trans>Openstaand</Trans></span>
            <strong className="admin-rev-pill-val">{totalOpenTasks}</strong>
          </div>
        </div>

        <div className="admin-revenue-pill admin-revenue-pill--total">
          <span className="admin-rev-pill-dot total" />
          <div className="admin-rev-pill-content">
            <span className="admin-rev-pill-label"><Trans>Totaal taken</Trans></span>
            <strong className="admin-rev-pill-val">{totalTasksCount}</strong>
          </div>
        </div>
      </div>
    </div>
  );
}
