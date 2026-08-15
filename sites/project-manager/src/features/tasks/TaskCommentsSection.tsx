import { useState, type FormEvent } from 'react';
import { ExternalLink, MessageSquare } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Trans, useLingui } from '@lingui/react/macro';
import { useAuth } from '../../auth/AuthContext';
import type { ResolvedRole, TaskRow } from '../../appwrite/types';
import { authorInitials, formatDiscussionDate } from '../discussions/TopicList';
import {
  useCreateDiscussion,
  useCreateDiscussionReply,
  useDiscussionByTask,
  useDiscussionReplies,
  useSubscribeDiscussionReplies,
} from '../discussions/hooks';

interface TaskCommentsSectionProps {
  task: TaskRow;
  companyId: string;
  teamId: string;
  role: ResolvedRole;
  displayName: (userId: string) => string;
}

export function TaskCommentsSection({
  task,
  companyId,
  teamId,
  role,
  displayName,
}: TaskCommentsSectionProps) {
  const { t } = useLingui();
  const { user } = useAuth();
  const { data: discussion, isLoading: discussionLoading } = useDiscussionByTask(task.$id);
  const { data: replies = [], isLoading: repliesLoading } = useDiscussionReplies(discussion?.$id);
  useSubscribeDiscussionReplies(discussion?.$id);

  const createDiscussion = useCreateDiscussion({
    projectId: task.projectId,
    companyId,
    taskId: task.$id,
  });
  const createReply = useCreateDiscussionReply({
    discussionId: discussion?.$id ?? '',
    projectId: task.projectId,
    companyId,
  });

  const [commentBody, setCommentBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const canGrantStaffRoles = role === 'admin' || role === 'developer';
  const isPending = createDiscussion.isPending || createReply.isPending;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!user || !commentBody.trim()) return;
    setError(null);
    try {
      if (discussion) {
        await createReply.mutateAsync({
          discussionId: discussion.$id,
          companyId,
          projectId: task.projectId,
          teamId,
          body: commentBody.trim(),
          createdBy: user.$id,
          canGrantStaffRoles,
        });
      } else {
        await createDiscussion.mutateAsync({
          companyId,
          teamId,
          title: t`Taak: ${task.title}`,
          body: commentBody.trim(),
          createdBy: user.$id,
          categoryType: 'project',
          projectId: task.projectId,
          taskId: task.$id,
          canGrantStaffRoles,
        });
      }
      setCommentBody('');
    } catch (err) {
      setError(err instanceof Error ? err.message : t`Comment plaatsen mislukt.`);
    }
  }

  return (
    <section className="task-comments-section" aria-label={t`Opmerkingen`}>
      <div className="task-comments-header">
        <div className="task-comments-heading">
          <MessageSquare size={18} aria-hidden />
          <h2><Trans>Opmerkingen</Trans></h2>
        </div>
        {discussion ? (
          <Link
            className="task-comments-forum-link"
            to={`/app/discussions/${discussion.$id}`}
          >
            <ExternalLink size={14} aria-hidden />
            <Trans>Bekijk in discussies</Trans>
          </Link>
        ) : null}
      </div>

      {discussionLoading ? (
        <p className="forum-loading"><Trans>Laden…</Trans></p>
      ) : discussion ? (
        <>
          <article className="forum-message forum-message--op task-comment-op">
            <header className="forum-message-header">
              <span className="forum-topic-avatar" aria-hidden>
                {authorInitials(displayName(discussion.createdBy))}
              </span>
              <strong className="forum-message-author">{displayName(discussion.createdBy)}</strong>
              <span className="forum-message-meta">
                {formatDiscussionDate(discussion.$createdAt)}
              </span>
            </header>
            <div className="forum-message-body">{discussion.body}</div>
          </article>

          <div className="forum-replies-heading task-comments-replies-heading">
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
              <Trans>Nog geen reacties op dit topic.</Trans>
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
        </>
      ) : (
        <p className="empty-state task-comments-empty">
          <Trans>Nog geen opmerkingen. Plaats de eerste opmerking hieronder.</Trans>
        </p>
      )}

      {user ? (
        <form className="forum-composer task-comments-composer" onSubmit={(event) => void handleSubmit(event)}>
          <div className="forum-composer-header">
            <span className="forum-topic-avatar" aria-hidden>
              {authorInitials(user.name || user.email || 'U')}
            </span>
            <label htmlFor={`task-comment-${task.$id}`}>
              {discussion ? <Trans>Plaats reactie</Trans> : <Trans>Plaats opmerking</Trans>}
            </label>
          </div>
          <textarea
            id={`task-comment-${task.$id}`}
            rows={4}
            placeholder={discussion ? t`Schrijf een reactie…` : t`Schrijf een opmerking…`}
            value={commentBody}
            onChange={(event) => setCommentBody(event.target.value)}
          />
          {error ? <p className="form-error">{error}</p> : null}
          <div className="form-actions">
            <button
              type="submit"
              className="btn-accent"
              disabled={isPending || !commentBody.trim()}
            >
              <Trans>Plaatsen</Trans>
            </button>
          </div>
        </form>
      ) : null}
    </section>
  );
}
