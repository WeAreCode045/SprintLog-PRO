import { Trans } from '@lingui/react/macro';
import {
  FolderKanban,
  ListTodo,
  CheckCircle2,
  Clock,
  TrendingUp,
} from 'lucide-react';
import type { ProjectRow, TaskRow, TimeEntryRow } from '../../appwrite/types';
import { formatHours } from '../../lib/formatHours';

interface AdminStatCardsProps {
  projects: ProjectRow[];
  tasks: TaskRow[];
  entries: TimeEntryRow[];
  totalRevenue: number;
}

export function AdminStatCards({
  projects,
  tasks,
  entries,
  totalRevenue,
}: AdminStatCardsProps) {
  const totalProjects = projects.length;
  const openTasks = tasks.filter((t) => t.status === 'open' || t.status === 'requested');
  const completedTasks = tasks.filter((t) => t.status === 'finished').length;
  const totalHours = entries.reduce((sum, e) => sum + (e.hours ?? 0), 0);

  return (
    <div className="admin-stat-cards-grid">
      {/* 1. Number of Projects */}
      <div className="admin-stat-card">
        <span className="admin-stat-icon-wrap admin-stat-icon--sidebar">
          <FolderKanban size={20} />
        </span>
        <div className="admin-stat-main">
          <h4 className="admin-stat-value">{totalProjects}</h4>
          <span className="admin-stat-label"><Trans>Projecten</Trans></span>
        </div>
      </div>

      {/* 2. Open Tasks */}
      <div className="admin-stat-card">
        <span className="admin-stat-icon-wrap admin-stat-icon--sidebar">
          <ListTodo size={20} />
        </span>
        <div className="admin-stat-main">
          <h4 className="admin-stat-value">{openTasks.length}</h4>
          <span className="admin-stat-label"><Trans>Open Taken</Trans></span>
        </div>
      </div>

      {/* 3. Completed Tasks */}
      <div className="admin-stat-card">
        <span className="admin-stat-icon-wrap admin-stat-icon--sidebar">
          <CheckCircle2 size={20} />
        </span>
        <div className="admin-stat-main">
          <h4 className="admin-stat-value">{completedTasks}</h4>
          <span className="admin-stat-label"><Trans>Voltooide Taken</Trans></span>
        </div>
      </div>

      {/* 4. Total Booked Hours */}
      <div className="admin-stat-card">
        <span className="admin-stat-icon-wrap admin-stat-icon--sidebar">
          <Clock size={20} />
        </span>
        <div className="admin-stat-main">
          <h4 className="admin-stat-value">{formatHours(totalHours)}</h4>
          <span className="admin-stat-label"><Trans>Geboekte Uren</Trans></span>
        </div>
      </div>

      {/* 5. Total Revenue */}
      <div className="admin-stat-card">
        <span className="admin-stat-icon-wrap admin-stat-icon--sidebar">
          <TrendingUp size={20} />
        </span>
        <div className="admin-stat-main">
          <h4 className="admin-stat-value">€ {Math.round(totalRevenue).toLocaleString('nl-NL')}</h4>
          <span className="admin-stat-label"><Trans>Totale Omzet</Trans></span>
        </div>
      </div>
    </div>
  );
}
