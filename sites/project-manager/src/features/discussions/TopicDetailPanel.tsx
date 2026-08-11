import { useMemo, useState, type FormEvent } from 'react';
import { ArrowLeft, MessageSquare } from 'lucide-react';
import { Trans, useLingui } from '@lingui/react/macro';
import { useAuth } from '../../auth/AuthContext';
import {
  DISCUSSION_CATEGORY_LABELS,
  DISCUSSION_NO_PROJECT_ID,
  type ResolvedRole,
} from '../../appwrite/types';
import { authorInitials, formatDiscussionDate } from './TopicList';
import {
  useCreateDiscussionReply,
  useDiscussion,
  useDiscussionReplies,
  useSubscribeDiscussionReplies,
} from './hooks';

interface TopicDetailPanelProps {
  discussionId: string;
  companyId: string;
  teamId: string;
  role: ResolvedRole;
  displayName: (userId: string) => string;
  onBack: () => void;
}

/** Topic OP + replies + composer — rendered inside the forum main panel. */
export function TopicDetailPanel({
  discussionId,
  companyId,
  teamId,
  role,
  displayName,
  onBack,
}: TopicDetailPanelProps) {
  const { t } = useLingui();
  const { user } = useAuth();
  const { data: discussion, isLoading } = useDiscussion(discussionId);
  const { data: replies = [], isLoading: repliesLoading } = useDiscussionReplies(discussionId);
  useSubscribeDiscussionReplies(discussionId);

  const createReply = useCreateDiscussionReply({
    discussionId,
    companyId,
    projectId: discussion?.projectId,
  });
  const [replyBody, setReplyBody] = useState('');
  const [error, setError] = useState<string | null>(null);

  const categoryLabel = useMemo(() => {
    if (!discussion) return '';
    return DISCUSSION_CATEGORY_LABELS[discussion.categoryType ?? 'project'] ?? t`Discussie`;
  }, [discussion, t]);

  async function handleReply(event: FormEvent) {
    event.preventDefault();
    if (!user || !discussion || !replyBody.trim()) return;
    setError(null);
    try {
      await createReply.mutateAsync({
        discussionId: discussion.$id,
        companyId,
        projectId:
          discussion.projectId === DISCUSSION_NO_PROJECT_ID
            ? DISCUSSION_NO_PROJECT_ID
            : discussion.projectId,
        teamId,
        body: replyBody.trim(),
        createdBy: user.$id,
        canGrantStaffRoles: role === 'admin' || role === 'developer',
      });
      setReplyBody('');
    } catch (err) {
      setError(err instanceof Error ? err.message : t`Reageren mislukt.`);
    }
  }

  if (isLoading) {
    return <p className="forum-loading"><Trans>Laden…</Trans></p>;
  }

  if (!discussion) {
    return (
      <div className="forum-detail-panel">
        <p className="empty-state"><Trans>Topic niet gevonden.</Trans></p>
        <button type="button" className="btn-link" onClick={onBack}>
          <Trans>← Terug naar overzicht</Trans>
        </button>
      </div>
    );
  }

  return (
    <div className="forum-detail-panel">
      <div className="forum-detail-toolbar">
        <button type="button" className="btn-link forum-detail-back" onClick={onBack}>
          <ArrowLeft size={16} aria-hidden /> <Trans>Overzicht</Trans>
        </button>
        <span className="forum-detail-category">{categoryLabel}</span>
      </div>

      <h2 className="forum-detail-title">{discussion.title}</h2>

      <article className="forum-message forum-message--op">
        <header className="forum-message-header">
          <span className="forum-topic-avatar" aria-hidden>
            {authorInitials(displayName(discussion.createdBy))}
          </span>
          <strong className="forum-message-author">{displayName(discussion.createdBy)}</strong>
          <span className="forum-message-meta">{formatDiscussionDate(discussion.$createdAt)}</span>
        </header>
        <div className="forum-message-body">{discussion.body}</div>
      </article>

      <section className="forum-replies" aria-label={t`Reacties`}>
        <div className="forum-replies-heading">
          <MessageSquare size={16} aria-hidden />
          <h3>
            {repliesLoading ? (
              <Trans>Reacties</Trans>
            ) : replies.length === 1 ? (
              <Trans>1 reactie</Trans>
            ) : (
              <Trans>{replies.length} reacties</Trans>
            )}
          </h3>
        </div>

        {repliesLoading ? (
          <p className="forum-loading"><Trans>Laden…</Trans></p>
        ) : replies.length === 0 ? (
          <p className="empty-state forum-replies-empty">
            <Trans>Nog geen reacties. Wees de eerste om te reageren.</Trans>
          </p>
        ) : (
          <ul className="forum-reply-list">
            {replies.map((reply) => {
              const author = displayName(reply.createdBy);
              return (
                <li key={reply.$id}>
                  <article className="forum-message forum-message--reply">
                    <header className="forum-message-header">
                      <span className="forum-topic-avatar" aria-hidden>
                        {authorInitials(author)}
                      </span>
                      <strong className="forum-message-author">{author}</strong>
                      <span className="forum-message-meta">
                        {formatDiscussionDate(reply.$createdAt)}
                      </span>
                    </header>
                    <div className="forum-message-body">{reply.body}</div>
                  </article>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {user && (
        <form className="forum-composer" onSubmit={(event) => void handleReply(event)}>
          <div className="forum-composer-header">
            <span className="forum-topic-avatar" aria-hidden>
              {authorInitials(user.name || user.email || 'U')}
            </span>
            <label htmlFor={`forum-reply-${discussionId}`}><Trans>Plaats reactie</Trans></label>
          </div>
          <textarea
            id={`forum-reply-${discussionId}`}
            rows={4}
            placeholder={t`Schrijf een reactie…`}
            value={replyBody}
            onChange={(event) => setReplyBody(event.target.value)}
          />
          {error && <p className="form-error">{error}</p>}
          <div className="form-actions">
            <button
              type="submit"
              className="btn-accent"
              disabled={createReply.isPending || !replyBody.trim()}
            >
              <Trans>Plaatsen</Trans>
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
