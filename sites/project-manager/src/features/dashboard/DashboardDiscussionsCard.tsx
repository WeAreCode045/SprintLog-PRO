import dayjs from 'dayjs';
import { Link } from 'react-router-dom';
import { ArrowRight, MessageSquarePlus, MessagesSquare } from 'lucide-react';
import { Trans } from '@lingui/react/macro';
import { discussionCategoryLabel } from '../discussions/TopicList';
import type { DashboardOverview } from './useDashboardOverview';

interface DashboardDiscussionsCardProps {
  discussionFeed: DashboardOverview['discussionFeed'];
}

export function DashboardDiscussionsCard({ discussionFeed }: DashboardDiscussionsCardProps) {
  return (
    <article className="dashboard-v2-card">
      <header className="dashboard-v2-card-header">
        <Trans>Discussies</Trans>
      </header>
      <div className="dashboard-v2-card-body">
        <section className="dashboard-v2-card-section">
          <header className="dashboard-v2-card-section-header">
            <MessagesSquare size={14} aria-hidden />
            <Trans>Recente discussies</Trans>
          </header>
          <p className="dashboard-v2-card-description">
            <Trans>Overzicht van nieuwe topics en reacties in discussies.</Trans>
          </p>
        </section>
        {discussionFeed.length === 0 ? (
          <p className="dashboard-v2-empty"><Trans>Geen discussies.</Trans></p>
        ) : (
          <>
            <div className="dashboard-v2-discussions-list-header">
              <span><Trans>Discussie</Trans></span>
              <span><Trans>Categorie</Trans></span>
              <span><Trans>Datum</Trans></span>
            </div>
            <ul className="dashboard-v2-discussions-list">
              {discussionFeed.map((item) => (
                <li key={item.id} className="dashboard-v2-discussions-item">
                  <span className="dashboard-v2-discussions-title-cell">
                    <span className="dashboard-v2-discussions-icon" aria-hidden>
                      {item.kind === 'topic' ? <MessageSquarePlus size={14} /> : <MessagesSquare size={14} />}
                    </span>
                    <Link to={item.href} className="dashboard-v2-discussions-title">
                      {item.title}
                    </Link>
                  </span>
                  <span className="dashboard-v2-discussions-category">
                    {discussionCategoryLabel(item.categoryType)}
                  </span>
                  <span className="dashboard-v2-discussions-date">
                    {dayjs(item.createdAt).format('D MMM')}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
        <Link to="/app/discussions" className="dashboard-v2-card-action">
          <Trans>Bekijk discussies</Trans>
          <ArrowRight size={14} />
        </Link>
      </div>
    </article>
  );
}
