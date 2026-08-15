import { useMemo, useState, type FormEvent } from 'react';
import { ExternalLink, MessageSquare } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Trans, useLingui } from '@lingui/react/macro';
import dayjs from 'dayjs';
import { useAuth } from '../../auth/AuthContext';
import { IconEdit } from '../../components/icons';
import { MentionTextarea } from '../../components/MentionTextarea';
import { extractMentions, renderMentionText, type MentionableUser } from '../../lib/mentions';
import { useDeveloperProfiles, useUserProfiles } from '../profiles/hooks';
import type { DiscussionReplyRow, ResolvedRole, TaskRow } from '../../appwrite/types';
import { authorInitials, formatDiscussionDate } from '../discussions/TopicList';
import {
  useCreateDiscussion,
  useCreateDiscussionReply,
  useDiscussionByTask,
  useDiscussionReplies,
  useSubscribeDiscussionReplies,
  useUpdateDiscussionReply,
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
  const { data: profiles = [] } = useUserProfiles(true);
  const { data: developers = [] } = useDeveloperProfiles(true);
  useSubscribeDiscussionReplies(discussion?.$id);

  const mentionableUsers = useMemo(() => {
    const map = new Map<string, MentionableUser>();
    for (const p of profiles) {
      map.set(p.userId, {
        id: p.userId,
        name: p.displayName,
        email: p.email,
        role: p.globalRole,
        avatarFileId: p.avatarFileId,
      });
    }
    for (const d of developers) {
      if (!map.has(d.userId)) {
        map.set(d.userId, {
          id: d.userId,
          name: d.displayName,
          email: d.email,
          role: d.globalRole,
          avatarFileId: d.avatarFileId,
        });
      }
    }
    return [...map.values()];
  }, [profiles, developers]);

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
  const updateReply = useUpdateDiscussionReply({
    discussionId: discussion?.$id ?? '',
  });

  const [commentBody, setCommentBody] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Edit reply state
  const [editingReplyId, setEditingReplyId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState('');
  const [editError, setEditError] = useState<string | null>(null);

  function handleStartEdit(reply: DiscussionReplyRow) {
    setEditingReplyId(reply.$id);
    setEditBody(reply.body);
    setEditError(null);
  }

  function handleCancelEdit() {
    setEditingReplyId(null);
    setEditBody('');
    setEditError(null);
  }

  async function handleSaveEdit(event: FormEvent, replyId: string) {
    event.preventDefault();
    if (!editBody.trim()) return;
    setEditError(null);
    try {
      await updateReply.mutateAsync({
        replyId,
        body: editBody.trim(),
      });
      setEditingReplyId(null);
      setEditBody('');
    } catch (err) {
      setEditError(err instanceof Error ? err.message : t`Bewerken mislukt.`);
    }
  }

  const canGrantStaffRoles = role === 'admin' || role === 'developer';
  const isPending = createDiscussion.isPending || createReply.isPending;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!user || !commentBody.trim()) return;
    setError(null);
    try {
      const tagged = extractMentions(commentBody, mentionableUsers);
      const assigneeUserIds = tagged.length > 0 ? tagged.map((u) => u.id) : undefined;

      if (discussion) {
        await createReply.mutateAsync({
          discussionId: discussion.$id,
          companyId,
          projectId: task.projectId,
          teamId,
          body: commentBody.trim(),
          createdBy: user.$id,
          assigneeUserIds,
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
          assigneeUserIds,
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
            <div className="forum-message-body">{renderMentionText(discussion.body, mentionableUsers)}</div>
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
                const canEdit =
                  user &&
                  (user.$id === reply.createdBy || role === 'admin' || role === 'developer');
                const isEditing = editingReplyId === reply.$id;
                const isEdited =
                  reply.$updatedAt &&
                  reply.$createdAt &&
                  dayjs(reply.$updatedAt).diff(dayjs(reply.$createdAt), 'second') >= 300;

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
                        {canEdit && !isEditing && (
                          <div className="forum-message-actions">
                            <button
                              type="button"
                              className="icon-button forum-message-edit-btn"
                              title={t`Reactie bewerken`}
                              onClick={() => handleStartEdit(reply)}
                            >
                              <IconEdit />
                            </button>
                          </div>
                        )}
                      </header>

                      {isEditing ? (
                        <form
                          className="forum-edit-composer"
                          onSubmit={(e) => void handleSaveEdit(e, reply.$id)}
                        >
                          <MentionTextarea
                            rows={3}
                            value={editBody}
                            onChange={setEditBody}
                            users={mentionableUsers}
                            autoFocus
                          />
                          {editError && <p className="form-error">{editError}</p>}
                          <div className="forum-edit-actions">
                            <button
                              type="button"
                              className="btn-secondary"
                              onClick={handleCancelEdit}
                            >
                              <Trans>Annuleren</Trans>
                            </button>
                            <button
                              type="submit"
                              className="btn-accent"
                              disabled={updateReply.isPending || !editBody.trim()}
                            >
                              <Trans>Opslaan</Trans>
                            </button>
                          </div>
                        </form>
                      ) : (
                        <>
                          <div className="forum-message-body">
                            {renderMentionText(reply.body, mentionableUsers)}
                          </div>
                          {isEdited && (
                            <div className="forum-message-footer">
                              <span className="forum-message-edited">
                                <Trans>bewerkt door {author}</Trans>
                              </span>
                            </div>
                          )}
                        </>
                      )}
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
          <MentionTextarea
            id={`task-comment-${task.$id}`}
            rows={4}
            placeholder={discussion ? t`Schrijf een reactie… Type @ om een collega te taggen` : t`Schrijf een opmerking… Type @ om een collega te taggen`}
            value={commentBody}
            onChange={setCommentBody}
            users={mentionableUsers}
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

