import { useMemo, useState, type FormEvent } from 'react';
import { ArrowLeft, MessageSquare } from 'lucide-react';
import { Trans, useLingui } from '@lingui/react/macro';
import dayjs from 'dayjs';
import { useAuth } from '../../auth/AuthContext';
import { IconEdit, IconTrash } from '../../components/icons';
import { MentionTextarea } from '../../components/MentionTextarea';
import { extractMentions, renderMentionText, type MentionableUser } from '../../lib/mentions';
import { useDeveloperProfiles, useUserProfiles } from '../profiles/hooks';
import {
  DISCUSSION_CATEGORY_LABELS,
  DISCUSSION_NO_PROJECT_ID,
  type DiscussionReplyRow,
  type ResolvedRole,
} from '../../appwrite/types';
import { authorInitials, formatDiscussionDate } from './TopicList';
import {
  useCreateDiscussionReply,
  useDeleteDiscussion,
  useDiscussion,
  useDiscussionReplies,
  useSubscribeDiscussionReplies,
  useUpdateDiscussionReply,
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
  const { data: profiles = [] } = useUserProfiles(true);
  const { data: developers = [] } = useDeveloperProfiles(true);
  useSubscribeDiscussionReplies(discussionId);

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

  const createReply = useCreateDiscussionReply({
    discussionId,
    companyId,
    projectId: discussion?.projectId,
  });
  const updateReply = useUpdateDiscussionReply({
    discussionId,
  });
  const deleteDiscussion = useDeleteDiscussion();

  const [replyBody, setReplyBody] = useState('');
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

  async function handleDelete() {
    if (!discussion) return;
    if (!confirm(t`Topic "${discussion.title}" en alle reacties verwijderen?`)) return;
    await deleteDiscussion.mutateAsync(discussion.$id);
    onBack();
  }

  const categoryLabel = useMemo(() => {
    if (!discussion) return '';
    return DISCUSSION_CATEGORY_LABELS[discussion.categoryType ?? 'project'] ?? t`Discussie`;
  }, [discussion, t]);

  async function handleReply(event: FormEvent) {
    event.preventDefault();
    if (!user || !discussion || !replyBody.trim()) return;
    setError(null);
    try {
      const tagged = extractMentions(replyBody, mentionableUsers);
      const assigneeUserIds = tagged.length > 0 ? tagged.map((u) => u.id) : undefined;

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
        assigneeUserIds,
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
        {role === 'admin' && (
          <button
            type="button"
            className="icon-button forum-detail-delete"
            title={t`Topic verwijderen`}
            disabled={deleteDiscussion.isPending}
            onClick={() => void handleDelete()}
          >
            <IconTrash />
          </button>
        )}
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
        <div className="forum-message-body">{renderMentionText(discussion.body, mentionableUsers)}</div>
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
      </section>

      {user && (
        <form className="forum-composer" onSubmit={(event) => void handleReply(event)}>
          <div className="forum-composer-header">
            <span className="forum-topic-avatar" aria-hidden>
              {authorInitials(user.name || user.email || 'U')}
            </span>
            <label htmlFor={`forum-reply-${discussionId}`}><Trans>Plaats reactie</Trans></label>
          </div>
          <MentionTextarea
            id={`forum-reply-${discussionId}`}
            rows={4}
            placeholder={t`Schrijf een reactie… Type @ om een collega te taggen`}
            value={replyBody}
            onChange={setReplyBody}
            users={mentionableUsers}
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

