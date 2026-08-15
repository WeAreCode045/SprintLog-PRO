import { useMemo, useState } from 'react';
import { Trans } from '@lingui/react/macro';
import type { InvoiceRow, TimeEntryRow, CompanyRow } from '../../appwrite/types';
import dayjs from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';

dayjs.extend(isoWeek);

type RevenueFilterPeriod = 'week' | 'month' | 'custom';

interface AdminRevenueChartProps {
  invoices: InvoiceRow[];
  entries: TimeEntryRow[];
  companies: CompanyRow[];
}

import { invoiceAmount } from './useDashboardPageData';

function formatEuro(amount: number) {
  const rounded = Math.round(amount);
  if (rounded < 0) {
    return `-€ ${Math.abs(rounded).toLocaleString('nl-NL')}`;
  }
  return `€ ${rounded.toLocaleString('nl-NL')}`;
}

export function AdminRevenueChart({
  invoices,
  entries,
  companies,
}: AdminRevenueChartProps) {
  const [period, setPeriod] = useState<RevenueFilterPeriod>('week');
  const [hoveredBar, setHoveredBar] = useState<{
    label: string;
    invoiced: number;
    unbilled: number;
    total: number;
  } | null>(null);

  // Rate lookup for unbilled entries
  const companyRateMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of companies) {
      map.set(c.$id, Number(c.hourlyRate) || 85); // fallback default hourly rate if unset
    }
    return map;
  }, [companies]);

  // Total unbilled approved amount
  const totalUnbilledAmount = useMemo(() => {
    let sum = 0;
    for (const entry of entries) {
      if (entry.approved && !entry.freeOfCharge && !entry.invoiced) {
        const rate = companyRateMap.get(entry.companyId) ?? 85;
        sum += (entry.hours ?? 0) * rate;
      }
    }
    return Math.round(sum * 100) / 100;
  }, [entries, companyRateMap]);

  // Total invoiced amount (sent + paid + drafts)
  const totalInvoicedAmount = useMemo(() => {
    return invoices
      .filter((inv) => inv.status !== 'void' || Boolean(inv.creditedByInvoiceId))
      .reduce((sum, inv) => sum + invoiceAmount(inv), 0);
  }, [invoices]);

  const grandTotalRevenue = totalInvoicedAmount + totalUnbilledAmount;

  // Grouped Bar Data for Week / Month
  const barData = useMemo(() => {
    const now = dayjs();
    const bars: { label: string; invoiced: number; unbilled: number; total: number }[] = [];

    if (period === 'week') {
      // Last 6 weeks
      for (let i = 5; i >= 0; i--) {
        const targetWeek = now.subtract(i, 'week');
        const startOfWeek = targetWeek.startOf('isoWeek');
        const endOfWeek = targetWeek.endOf('isoWeek');
        const label = `W${startOfWeek.isoWeek()}`;

        // Invoiced in this week
        const weekInvoiced = invoices
          .filter((inv) => {
            if (inv.status === 'void' && !inv.creditedByInvoiceId) return false;
            const date = dayjs(inv.issueDate || inv.$createdAt);
            return (date.isAfter(startOfWeek) && date.isBefore(endOfWeek)) || date.isSame(startOfWeek, 'day') || date.isSame(endOfWeek, 'day');
          })
          .reduce((sum, inv) => sum + invoiceAmount(inv), 0);

        // Unbilled worked in this week
        const weekUnbilled = entries
          .filter((e) => {
            if (!e.approved || e.freeOfCharge || e.invoiced) return false;
            const d = dayjs(e.workedDate || e.$createdAt);
            return (d.isAfter(startOfWeek) && d.isBefore(endOfWeek)) || d.isSame(startOfWeek, 'day') || d.isSame(endOfWeek, 'day');
          })
          .reduce((sum, e) => sum + (e.hours ?? 0) * (companyRateMap.get(e.companyId) ?? 85), 0);

        bars.push({
          label,
          invoiced: Math.round(weekInvoiced),
          unbilled: Math.round(weekUnbilled),
          total: Math.round(weekInvoiced + weekUnbilled),
        });
      }
    } else if (period === 'month') {
      // Last 6 months
      for (let i = 5; i >= 0; i--) {
        const m = now.subtract(i, 'month');
        const startOfMonth = m.startOf('month');
        const endOfMonth = m.endOf('month');
        const label = m.format('MMM');

        const monthInvoiced = invoices
          .filter((inv) => {
            if (inv.status === 'void' && !inv.creditedByInvoiceId) return false;
            const date = dayjs(inv.issueDate || inv.$createdAt);
            return (date.isAfter(startOfMonth) && date.isBefore(endOfMonth)) || date.isSame(startOfMonth, 'day') || date.isSame(endOfMonth, 'day');
          })
          .reduce((sum, inv) => sum + invoiceAmount(inv), 0);

        const monthUnbilled = entries
          .filter((e) => {
            if (!e.approved || e.freeOfCharge || e.invoiced) return false;
            const d = dayjs(e.workedDate || e.$createdAt);
            return (d.isAfter(startOfMonth) && d.isBefore(endOfMonth)) || d.isSame(startOfMonth, 'day') || d.isSame(endOfMonth, 'day');
          })
          .reduce((sum, e) => sum + (e.hours ?? 0) * (companyRateMap.get(e.companyId) ?? 85), 0);

        bars.push({
          label,
          invoiced: Math.round(monthInvoiced),
          unbilled: Math.round(monthUnbilled),
          total: Math.round(monthInvoiced + monthUnbilled),
        });
      }
    } else {
      // Custom / Overall breakdown
      bars.push(
        {
          label: 'Gefactureerd',
          invoiced: Math.round(totalInvoicedAmount),
          unbilled: 0,
          total: Math.round(totalInvoicedAmount),
        },
        {
          label: 'Te factureren',
          invoiced: 0,
          unbilled: Math.round(totalUnbilledAmount),
          total: Math.round(totalUnbilledAmount),
        },
        {
          label: 'Totaal',
          invoiced: Math.round(totalInvoicedAmount),
          unbilled: Math.round(totalUnbilledAmount),
          total: Math.round(grandTotalRevenue),
        },
      );
    }

    return bars;
  }, [period, invoices, entries, companyRateMap, totalInvoicedAmount, totalUnbilledAmount, grandTotalRevenue]);

  const maxBarTotal = useMemo(() => {
    const max = Math.max(...barData.map((b) => b.total), 100);
    return Math.ceil(max * 1.15);
  }, [barData]);

  return (
    <div className="admin-chart-card admin-revenue-card">
      <div className="admin-chart-header">
        <div className="admin-chart-title-group">
          <h3 className="admin-chart-title">
            <Trans>Omzet</Trans>
          </h3>
          <span className="admin-chart-subtitle">
            <Trans>Gefactureerd & Te factureren</Trans>
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
            className={`admin-chart-switch-btn ${period === 'custom' ? 'active' : ''}`}
            onClick={() => setPeriod('custom')}
          >
            <Trans>Totaal</Trans>
          </button>
        </div>
      </div>

      <div className="admin-chart-body">
        {/* Modern Bar Columns matching screenshot visual */}
        <div className="admin-columns-container" onMouseLeave={() => setHoveredBar(null)}>
          {barData.map((b, idx) => {
            const invoicedPct = Math.max(4, Math.round((b.invoiced / maxBarTotal) * 100));
            const unbilledPct = Math.max(4, Math.round((b.unbilled / maxBarTotal) * 100));

            return (
              <div
                key={`col-${idx}`}
                className="admin-column-wrapper"
                onMouseEnter={() => setHoveredBar(b)}
              >
                <div className="admin-column-bars">
                  {/* Invoiced Bar (Purple/Accent Gradient) */}
                  <div
                    className="admin-col-bar admin-col-invoiced"
                    style={{ height: `${invoicedPct}%` }}
                    title={`Gefactureerd: ${formatEuro(b.invoiced)}`}
                  />
                  {/* Unbilled Bar (Cyan/Teal Gradient) */}
                  {b.unbilled > 0 && (
                    <div
                      className="admin-col-bar admin-col-unbilled"
                      style={{ height: `${unbilledPct}%` }}
                      title={`Te factureren: ${formatEuro(b.unbilled)}`}
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
            <span><strong>{hoveredBar.label}:</strong> {formatEuro(hoveredBar.total)}</span>
            <small>Gefactureerd: {formatEuro(hoveredBar.invoiced)} · Te factureren: {formatEuro(hoveredBar.unbilled)}</small>
          </div>
        )}
      </div>

      {/* Bottom Summary Metric Pills */}
      <div className="admin-revenue-summary-pills">
        <div className="admin-revenue-pill">
          <span className="admin-rev-pill-dot invoiced" />
          <div className="admin-rev-pill-content">
            <span className="admin-rev-pill-label"><Trans>Gefactureerd</Trans></span>
            <strong className="admin-rev-pill-val">{formatEuro(totalInvoicedAmount)}</strong>
          </div>
        </div>

        <div className="admin-revenue-pill">
          <span className="admin-rev-pill-dot unbilled" />
          <div className="admin-rev-pill-content">
            <span className="admin-rev-pill-label"><Trans>Te factureren</Trans></span>
            <strong className="admin-rev-pill-val">{formatEuro(totalUnbilledAmount)}</strong>
          </div>
        </div>

        <div className="admin-revenue-pill admin-revenue-pill--total">
          <span className="admin-rev-pill-dot total" />
          <div className="admin-rev-pill-content">
            <span className="admin-rev-pill-label"><Trans>Totaal</Trans></span>
            <strong className="admin-rev-pill-val">{formatEuro(grandTotalRevenue)}</strong>
          </div>
        </div>
      </div>
    </div>
  );
}
