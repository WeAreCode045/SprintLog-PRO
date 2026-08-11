import { useMemo, useState } from 'react';
import { MessageSquarePlus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Trans, useLingui } from '@lingui/react/macro';
import { useAuth } from '../../auth/AuthContext';
import { useProjects } from '../projects/hooks';
import { useDeveloperProfiles, useUserProfiles } from '../profiles/hooks';
import type { ResolvedRole } from '../../appwrite/types';
import { NewTopicDialog } from './NewTopicDialog';
import { TopicList } from './TopicList';
import { useDiscussions } from './hooks';

interface DiscussionBoardProps {
  companyId: string;
  projectId: string;
  teamId: string;
  role: ResolvedRole;
  assigneeUserIds?: string[];
}

/** Project Discussion tab — project-filtered topic list. */
export function DiscussionBoard({
  companyId,
  projectId,
  teamId,
  role,
  assigneeUserIds,
}: DiscussionBoardProps) {
  const { t } = useLingui();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: discussions = [], isLoading } = useDiscussions(projectId);
  const { data: projects = [] } = useProjects(companyId);
  const { data: profiles = [] } = useUserProfiles(true);
  const { data: developers = [] } = useDeveloperProfiles(true);
  const [showNew, setShowNew] = useState(false);

  const nameByUserId = useMemo(() => {
    const map = new Map<string, string>();
    for (const profile of profiles) map.set(profile.userId, profile.displayName);
    for (const profile of developers) map.set(profile.userId, profile.displayName);
    if (user) map.set(user.$id, user.name || user.email || user.$id);
    return map;
  }, [profiles, developers, user]);

  if (!user) return null;

  return (
    <div className="discussion-board forum-project-board">
      <div className="pane-header pane-header--actions-only">
        <button type="button" className="btn-accent" onClick={() => setShowNew(true)}>
          <MessageSquarePlus size={16} /> <Trans>Nieuw topic</Trans>
        </button>
      </div>

      <TopicList
        companyId={companyId}
        discussions={discussions}
        filter="project"
        isLoading={isLoading}
        displayName={(userId) => nameByUserId.get(userId) ?? userId}
        grouped={false}
        emptyMessage={t`Nog geen discussies voor dit project.`}
        detailPath={(id) => `/app/discussions/${id}`}
      />

      {showNew && (
        <NewTopicDialog
          companyId={companyId}
          teamId={teamId}
          userId={user.$id}
          projects={projects}
          defaultCategoryType="project"
          defaultProjectId={projectId}
          lockCategory
          canGrantStaffRoles={role === 'admin' || role === 'developer'}
          assigneeUserIds={assigneeUserIds}
          onClose={() => setShowNew(false)}
          onCreated={(id) => navigate(`/app/discussions/${id}`)}
        />
      )}
    </div>
  );
}
