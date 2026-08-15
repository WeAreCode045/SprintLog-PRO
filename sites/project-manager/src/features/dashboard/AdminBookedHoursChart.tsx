import { useMemo, useState } from 'react';
import { Trans } from '@lingui/react/macro';
import type { TimeEntryRow, ProjectRow, CompanyRow } from '../../appwrite/types';
import { formatHours } from '../../lib/formatHours';
import dayjs from 'dayjs';

type HoursViewMode = 'day' | 'project' | 'company';

interface AdminBookedHoursChartProps {
  entries: TimeEntryRow[];
  projects: ProjectRow[];
  companies: CompanyRow[];
  companyById: (companyId: string) => CompanyRow | undefined;
}

export function AdminBookedHoursChart({
  entries,
  projects,
  companyById,
}: AdminBookedHoursChartProps) {
  const [viewMode, setViewMode] = useState<HoursViewMode>('day');
  const [hoveredPoint, setHoveredPoint] = useState<{
    label: string;
    hours: number;
    secondaryHours?: number;
    x: number;
    y: number;
  } | null>(null);

  const projectNameById = useMemo(
    () => new Map(projects.map((p) => [p.$id, p.name])),
    [projects],
  );

  // 1. Data for "Hours per Day" (last 14 days)
  const dailyData = useMemo(() => {
    const days: { dateStr: string; label: string; hours: number; billableHours: number }[] = [];
    const now = dayjs();
    const entryMap = new Map<string, { total: number; billable: number }>();

    for (const entry of entries) {
      const d = entry.workedDate ? dayjs(entry.workedDate).format('YYYY-MM-DD') : '';
      if (!d) continue;
      const current = entryMap.get(d) ?? { total: 0, billable: 0 };
      const hours = entry.hours ?? 0;
      current.total += hours;
      if (!entry.freeOfCharge) current.billable += hours;
      entryMap.set(d, current);
    }

    for (let i = 13; i >= 0; i--) {
      const d = now.subtract(i, 'day');
      const key = d.format('YYYY-MM-DD');
      const stats = entryMap.get(key) ?? { total: 0, billable: 0 };
      days.push({
        dateStr: key,
        label: d.format('D MMM'),
        hours: Math.round(stats.total * 100) / 100,
        billableHours: Math.round(stats.billable * 100) / 100,
      });
    }

    return days;
  }, [entries]);

  // 2. Data for "Hours per Project"
  const projectData = useMemo(() => {
    const map = new Map<string, number>();
    for (const entry of entries) {
      const pId = entry.projectId;
      if (!pId) continue;
      map.set(pId, (map.get(pId) ?? 0) + (entry.hours ?? 0));
    }
    const list = [...map.entries()]
      .map(([id, hours]) => ({
        id,
        name: projectNameById.get(id) || id,
        hours: Math.round(hours * 100) / 100,
      }))
      .sort((a, b) => b.hours - a.hours)
      .slice(0, 6);
    return list;
  }, [entries, projectNameById]);

  // 3. Data for "Hours per Company"
  const companyData = useMemo(() => {
    const map = new Map<string, number>();
    for (const entry of entries) {
      const cId = entry.companyId;
      if (!cId) continue;
      map.set(cId, (map.get(cId) ?? 0) + (entry.hours ?? 0));
    }
    const list = [...map.entries()]
      .map(([id, hours]) => ({
        id,
        name: companyById(id)?.name || id,
        hours: Math.round(hours * 100) / 100,
      }))
      .sort((a, b) => b.hours - a.hours)
      .slice(0, 6);
    return list;
  }, [entries, companyById]);

  // SVG Spline Math for Daily Chart
  const svgWidth = 600;
  const svgHeight = 200;
  const paddingX = 35;
  const paddingY = 25;
  const chartW = svgWidth - paddingX * 2;
  const chartH = svgHeight - paddingY * 2;

  const maxDailyHours = useMemo(() => {
    const max = Math.max(...dailyData.map((d) => d.hours), 1);
    return Math.ceil(max * 1.2);
  }, [dailyData]);

  const points = useMemo(() => {
    if (dailyData.length === 0) return [];
    return dailyData.map((d, index) => {
      const x = paddingX + (index / (dailyData.length - 1)) * chartW;
      const y = paddingY + chartH - (d.hours / maxDailyHours) * chartH;
      const yBillable = paddingY + chartH - (d.billableHours / maxDailyHours) * chartH;
      return { x, y, yBillable, data: d };
    });
  }, [dailyData, maxDailyHours, chartW, chartH, paddingX, paddingY]);

  // Generate smooth cubic Bézier path
  const splinePath = useMemo(() => {
    if (points.length === 0) return '';
    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i];
      const p1 = points[i + 1];
      const cp1x = p0.x + (p1.x - p0.x) / 2;
      const cp1y = p0.y;
      const cp2x = p0.x + (p1.x - p0.x) / 2;
      const cp2y = p1.y;
      d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p1.x} ${p1.y}`;
    }
    return d;
  }, [points]);

  const areaPath = useMemo(() => {
    if (!splinePath || points.length === 0) return '';
    const last = points[points.length - 1];
    const first = points[0];
    return `${splinePath} L ${last.x} ${paddingY + chartH} L ${first.x} ${paddingY + chartH} Z`;
  }, [splinePath, points, paddingY, chartH]);

  const secondarySplinePath = useMemo(() => {
    if (points.length === 0) return '';
    let d = `M ${points[0].x} ${points[0].yBillable}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i];
      const p1 = points[i + 1];
      const cp1x = p0.x + (p1.x - p0.x) / 2;
      const cp1y = p0.yBillable;
      const cp2x = p0.x + (p1.x - p0.x) / 2;
      const cp2y = p1.yBillable;
      d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p1.x} ${p1.yBillable}`;
    }
    return d;
  }, [points]);

  const totalFilteredHours = useMemo(() => {
    return Math.round(entries.reduce((sum, e) => sum + (e.hours ?? 0), 0) * 100) / 100;
  }, [entries]);

  return (
    <div className="admin-chart-card admin-booked-hours-card">
      <div className="admin-chart-header">
        <div className="admin-chart-title-group">
          <h3 className="admin-chart-title">
            <Trans>Urenactiviteit</Trans>
          </h3>
          <span className="admin-chart-subtitle">
            {viewMode === 'day' && <Trans>Dagelijks geregistreerde uren (laatste 14 dagen)</Trans>}
            {viewMode === 'project' && <Trans>Totaal aantal uren per project</Trans>}
            {viewMode === 'company' && <Trans>Totaal aantal uren per bedrijf</Trans>}
          </span>
        </div>

        {/* View Mode Switcher on Top Right */}
        <div className="admin-chart-switcher" role="tablist">
          <button
            type="button"
            className={`admin-chart-switch-btn ${viewMode === 'day' ? 'active' : ''}`}
            onClick={() => setViewMode('day')}
          >
            <Trans>Per dag</Trans>
          </button>
          <button
            type="button"
            className={`admin-chart-switch-btn ${viewMode === 'project' ? 'active' : ''}`}
            onClick={() => setViewMode('project')}
          >
            <Trans>Per project</Trans>
          </button>
          <button
            type="button"
            className={`admin-chart-switch-btn ${viewMode === 'company' ? 'active' : ''}`}
            onClick={() => setViewMode('company')}
          >
            <Trans>Per bedrijf</Trans>
          </button>
        </div>
      </div>

      <div className="admin-chart-body">
        {viewMode === 'day' && (
          <div className="admin-svg-chart-wrap" onMouseLeave={() => setHoveredPoint(null)}>
            <svg
              viewBox={`0 0 ${svgWidth} ${svgHeight}`}
              className="admin-spline-svg"
              preserveAspectRatio="none"
            >
              <defs>
                <linearGradient id="bookedHoursGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.38" />
                  <stop offset="60%" stopColor="var(--accent)" stopOpacity="0.08" />
                  <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
                </linearGradient>
                <linearGradient id="secondaryLineGradient" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="var(--sidebar-active-bg)" />
                  <stop offset="100%" stopColor="var(--sidebar-bg)" />
                </linearGradient>
                <filter id="glow-line" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="var(--accent)" floodOpacity="0.35" />
                </filter>
              </defs>

              {/* Grid Lines */}
              {[0, 0.33, 0.66, 1].map((ratio, idx) => {
                const y = paddingY + chartH * ratio;
                const value = Math.round(maxDailyHours * (1 - ratio));
                return (
                  <g key={`grid-${idx}`}>
                    <line
                      x1={paddingX}
                      y1={y}
                      x2={svgWidth - paddingX}
                      y2={y}
                      stroke="var(--border)"
                      strokeDasharray="4 4"
                      strokeWidth="1"
                      opacity="0.6"
                    />
                    <text
                      x={paddingX - 8}
                      y={y + 3}
                      textAnchor="end"
                      fontSize="10"
                      fill="var(--text-muted)"
                    >
                      {value}u
                    </text>
                  </g>
                );
              })}

              {/* Area Gradient */}
              <path d={areaPath} fill="url(#bookedHoursGradient)" />

              {/* Secondary (Billable) Curve */}
              <path
                d={secondarySplinePath}
                fill="none"
                stroke="url(#secondaryLineGradient)"
                strokeWidth="2"
                strokeDasharray="4 3"
                opacity="0.75"
              />

              {/* Main Spline Line */}
              <path
                d={splinePath}
                fill="none"
                stroke="var(--accent)"
                strokeWidth="3.2"
                strokeLinecap="round"
                filter="url(#glow-line)"
              />

              {/* Interactive Data Points */}
              {points.map((p, idx) => (
                <g key={`pt-${idx}`}>
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={hoveredPoint?.label === p.data.label ? 6 : 3.5}
                    fill="#fff"
                    stroke="var(--accent)"
                    strokeWidth="2.5"
                    style={{ transition: 'all 0.15s ease', cursor: 'pointer' }}
                    onMouseEnter={() =>
                      setHoveredPoint({
                        label: p.data.label,
                        hours: p.data.hours,
                        secondaryHours: p.data.billableHours,
                        x: (p.x / svgWidth) * 100,
                        y: (p.y / svgHeight) * 100,
                      })
                    }
                  />
                  {/* Bottom Date labels */}
                  {(idx % 2 === 0 || idx === points.length - 1) && (
                    <text
                      x={p.x}
                      y={svgHeight - 6}
                      textAnchor="middle"
                      fontSize="10"
                      fill="var(--text-muted)"
                    >
                      {p.data.label}
                    </text>
                  )}
                </g>
              ))}
            </svg>

            {/* Hover Tooltip */}
            {hoveredPoint && (
              <div
                className="admin-chart-tooltip"
                style={{
                  left: `${hoveredPoint.x}%`,
                  top: `${Math.max(10, hoveredPoint.y - 18)}%`,
                }}
              >
                <div className="tooltip-date">{hoveredPoint.label}</div>
                <div className="tooltip-value">
                  <span className="tooltip-dot accent" />
                  <strong>{formatHours(hoveredPoint.hours)}</strong>
                </div>
                {hoveredPoint.secondaryHours != null && hoveredPoint.secondaryHours > 0 && (
                  <div className="tooltip-sub">
                    <span className="tooltip-dot blue" />
                    <span>Facturabel: {formatHours(hoveredPoint.secondaryHours)}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {viewMode === 'project' && (
          <div className="admin-bar-list">
            {projectData.length === 0 ? (
              <p className="admin-empty-text"><Trans>Geen geregistreerde projecturen.</Trans></p>
            ) : (
              projectData.map((item, index) => {
                const maxVal = projectData[0]?.hours || 1;
                const pct = Math.min(100, Math.round((item.hours / maxVal) * 100));
                return (
                  <div key={item.id} className="admin-bar-row">
                    <div className="admin-bar-label-group">
                      <span className="admin-bar-rank">#{index + 1}</span>
                      <span className="admin-bar-label" title={item.name}>{item.name}</span>
                    </div>
                    <div className="admin-bar-track">
                      <div
                        className="admin-bar-fill"
                        style={{ width: `${pct}%`, background: 'linear-gradient(90deg, var(--accent), var(--accent-2))' }}
                      />
                    </div>
                    <span className="admin-bar-val">{formatHours(item.hours)}</span>
                  </div>
                );
              })
            )}
          </div>
        )}

        {viewMode === 'company' && (
          <div className="admin-bar-list">
            {companyData.length === 0 ? (
              <p className="admin-empty-text"><Trans>Geen geregistreerde bedrijfsuren.</Trans></p>
            ) : (
              companyData.map((item, index) => {
                const maxVal = companyData[0]?.hours || 1;
                const pct = Math.min(100, Math.round((item.hours / maxVal) * 100));
                return (
                  <div key={item.id} className="admin-bar-row">
                    <div className="admin-bar-label-group">
                      <span className="admin-bar-rank">#{index + 1}</span>
                      <span className="admin-bar-label" title={item.name}>{item.name}</span>
                    </div>
                    <div className="admin-bar-track">
                      <div
                        className="admin-bar-fill"
                        style={{ width: `${pct}%`, background: 'linear-gradient(90deg, var(--sidebar-active-bg), var(--sidebar-bg))' }}
                      />
                    </div>
                    <span className="admin-bar-val">{formatHours(item.hours)}</span>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      <div className="admin-chart-footer">
        <div className="admin-legend-item">
          <span className="admin-legend-indicator" style={{ background: 'var(--accent)' }} />
          <span><Trans>Totaal geboekt ({formatHours(totalFilteredHours)})</Trans></span>
        </div>
        {viewMode === 'day' && (
          <div className="admin-legend-item">
            <span className="admin-legend-indicator" style={{ background: 'var(--sidebar-active-bg)' }} />
            <span><Trans>Facturabel</Trans></span>
          </div>
        )}
      </div>
    </div>
  );
}
