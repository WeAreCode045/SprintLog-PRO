import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import dayjs from 'dayjs';
import { ArrowRight, ClipboardCheck, Receipt } from 'lucide-react';
import { Trans } from '@lingui/react/macro';
import { formatHours } from '../../lib/formatHours';
import type { DashboardTimeEntryLists } from './useDashboardPageData';

interface DashboardTimeEntriesCardProps {
  timeEntryLists: DashboardTimeEntryLists;
  showPendingInvoice?: boolean;
}

function TimeEntryRows({
  items,
  emptyLabel,
}: {
  items: DashboardTimeEntryLists['pendingApproval'];
  emptyLabel: ReactNode;
}) {
  if (items.length === 0) {
    return <p className="dashboard-v2-empty dashboard-v2-time-empty">{emptyLabel}</p>;
  }

  return (
    <>
      <div className="dashboard-v2-time-list-header">
        <span><Trans>Datum</Trans></span>
        <span><Trans>Taak</Trans></span>
        <span><Trans>Uren</Trans></span>
      </div>
      <ul className="dashboard-v2-time-list">
        {items.map((item) => (
          <li key={item.id} className="dashboard-v2-time-row">
            <span className="dashboard-v2-time-date">{dayjs(item.date).format('D MMM YYYY')}</span>
            <span className="dashboard-v2-time-task">{item.taskName}</span>
            <span className="dashboard-v2-time-hours">{formatHours(item.hours)}</span>
          </li>
        ))}
      </ul>
    </>
  );
}

export function DashboardTimeEntriesCard({
  timeEntryLists,
  showPendingInvoice = true,
}: DashboardTimeEntriesCardProps) {
  return (
    <article className="dashboard-v2-card">
      <header className="dashboard-v2-card-header">
        <Trans>Urenregistratie status</Trans>
      </header>
      <div className="dashboard-v2-card-body dashboard-v2-time-entries-body">
        <section className="dashboard-v2-time-subcard">
          <header className="dashboard-v2-time-subcard-header">
            <ClipboardCheck size={14} aria-hidden />
            <Trans>Wachtend op Goedkeuring</Trans>
          </header>
          <p className="dashboard-v2-time-subcard-description">
            <Trans>Ingediende uren die nog goedgekeurd moeten worden.</Trans>
          </p>
          <div className="dashboard-v2-time-subcard-body">
            <TimeEntryRows
              items={timeEntryLists.pendingApproval}
              emptyLabel={<Trans>Geen uren wachtend op goedkeuring.</Trans>}
            />
          </div>
        </section>

        {showPendingInvoice ? (
          <section className="dashboard-v2-time-subcard">
            <header className="dashboard-v2-time-subcard-header">
              <Receipt size={14} aria-hidden />
              <Trans>Wachtend op Facturatie</Trans>
            </header>
            <p className="dashboard-v2-time-subcard-description">
              <Trans>Goedgekeurde uren die nog gefactureerd moeten worden.</Trans>
            </p>
            <div className="dashboard-v2-time-subcard-body">
              <TimeEntryRows
                items={timeEntryLists.pendingInvoice}
                emptyLabel={<Trans>Geen uren wachtend op facturatie.</Trans>}
              />
            </div>
          </section>
        ) : null}

        <Link to="/app/reports" className="dashboard-v2-card-action">
          <Trans>Bekijk urenregistratie</Trans>
          <ArrowRight size={14} />
        </Link>
      </div>
    </article>
  );
}
