import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Trans, useLingui } from '@lingui/react/macro';
import { BarChart3, CheckSquare } from 'lucide-react';
import { CompanyScopeControl } from '../features/companies/CompanyScopeControl';
import { ReportsTabPanel } from '../features/reports/ReportsTabPanel';
import { TimeApprovalsTabPanel } from '../features/timeEntries/TimeApprovalsTabPanel';
import { PageHeader } from '../components/PageHeader';
import { PageBreadcrumb } from '../components/PageBreadcrumb';

type TimeReportingTab = 'reports' | 'approvals';

export function TimeReportingPage() {
  const { t } = useLingui();
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState<TimeReportingTab>(
    searchParams.get('tab') === 'approvals' ? 'approvals' : 'reports',
  );

  return (
    <div className="content-card">
      <div className="content-inner">
        <PageHeader
          title={<Trans>Urenregistratie</Trans>}
          description={<Trans>Rapportages en goedkeuring van geboekte uren.</Trans>}
          breadcrumb={
            <PageBreadcrumb
              items={[{ label: t`Dashboard`, to: '/app/dashboard' }, { label: t`Urenregistratie` }]}
            />
          }
          actions={<CompanyScopeControl />}
          tabs={
            <div className="filter-bar task-view-tabs-bar">
              <div className="task-view-tabs" role="tablist" aria-label={t`Urenregistratie weergaven`}>
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab === 'reports'}
                  className={`task-view-tab${tab === 'reports' ? ' active' : ''}`}
                  onClick={() => setTab('reports')}
                >
                  <BarChart3 className="task-view-tab-icon" size={16} aria-hidden />
                  <span><Trans>Rapportages</Trans></span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab === 'approvals'}
                  className={`task-view-tab${tab === 'approvals' ? ' active' : ''}`}
                  onClick={() => setTab('approvals')}
                >
                  <CheckSquare className="task-view-tab-icon" size={16} aria-hidden />
                  <span><Trans>Uren goedkeuren</Trans></span>
                </button>
              </div>
            </div>
          }
        />

        {tab === 'reports' ? <ReportsTabPanel /> : <TimeApprovalsTabPanel />}
      </div>
    </div>
  );
}
