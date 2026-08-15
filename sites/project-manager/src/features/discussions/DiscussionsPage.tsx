import { useMemo, useState } from 'react';
import { MessageSquarePlus } from 'lucide-react';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { Trans, useLingui } from '@lingui/react/macro';
import { useAuth } from '../../auth/AuthContext';
import { DISCUSSION_CATEGORY_LABELS } from '../../appwrite/types';
import { PageBreadcrumb } from '../../components/PageBreadcrumb';
import { PageHeader } from '../../components/PageHeader';
import type { PortalContext } from '../../layouts/PortalLayout';
import { CompanyScopeControl } from '../companies/CompanyScopeControl';
import { useProjectsForCompanies } from '../projects/hooks';
import { useDeveloperProfiles, useUserProfiles } from '../profiles/hooks';
import { DiscussionCategorySidebar } from './DiscussionCategorySidebar';
import { NewTopicDialog } from './NewTopicDialog';
import { TopicDetailPanel } from './TopicDetailPanel';
import { TopicList, groupDiscussionsByCategory, type DiscussionCategoryFilter } from './TopicList';
import { useDiscussionsForCompanies } from './hooks';

export function DiscussionsPage() {
  const { t } = useLingui();
  const { role, enabledCompanyIds, companyById, isMultiCompany } =
    useOutletContext<PortalContext>();
  const { discussionId } = useParams<{ discussionId?: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [filter, setFilter] = useState<DiscussionCategoryFilter>('all');
  const [showNew, setShowNew] = useState(false);
  const [formCompanyId, setFormCompanyId] = useState(enabledCompanyIds[0] ?? '');

  const listFilter = filter === 'all' ? undefined : { categoryType: filter };
  const { data: discussions = [], isLoading } = useDiscussionsForCompanies(
    enabledCompanyIds,
    listFilter,
  );
  const { data: allDiscussions = [] } = useDiscussionsForCompanies(enabledCompanyIds);
  const { data: projects = [] } = useProjectsForCompanies(enabledCompanyIds);
  const { data: profiles = [] } = useUserProfiles(true);
  const { data: developers = [] } = useDeveloperProfiles(true);

  const primaryCompanyId = formCompanyId || enabledCompanyIds[0] || '';
  const primaryCompany = companyById(primaryCompanyId);

  const nameByUserId = useMemo(() => {
    const map = new Map<string, string>();
    for (const profile of profiles) map.set(profile.userId, profile.displayName);
    for (const profile of developers) map.set(profile.userId, profile.displayName);
    if (user) map.set(user.$id, user.name || user.email || user.$id);
    return map;
  }, [profiles, developers, user]);

  const projectNameById = useMemo(() => {
    const map = new Map(projects.map((project) => [project.$id, project.name]));
    return (projectId: string) => map.get(projectId) ?? t`Project`;
  }, [projects, t]);

  const sidebarCounts = useMemo(() => {
    const grouped = groupDiscussionsByCategory(allDiscussions);
    return {
      all: allDiscussions.length,
      general: grouped.general.length,
      idea: grouped.idea.length,
      project: grouped.project.length,
    } satisfies Partial<Record<DiscussionCategoryFilter, number>>;
  }, [allDiscussions]);

  function displayName(userId: string) {
    return nameByUserId.get(userId) ?? userId;
  }

  function handleCategoryChange(next: DiscussionCategoryFilter) {
    setFilter(next);
    if (discussionId) {
      navigate('/app/discussions');
    }
  }

  function handleBackToList() {
    navigate('/app/discussions');
  }

  if (!user || !primaryCompany) return null;

  const detailDiscussionCompany = discussionId
    ? allDiscussions.find((row) => row.$id === discussionId)
    : undefined;
  const detailCompanyId = detailDiscussionCompany?.companyId ?? primaryCompany.$id;
  const detailCompany = companyById(detailCompanyId) ?? primaryCompany;

  return (
    <div className="content-card">
      <div className="content-inner">
        <PageHeader
          title={<Trans>Discussies</Trans>}
          description={
            isMultiCompany ? (
              <Trans>Algemeen, ideeën en projectthreads voor geselecteerde bedrijven.</Trans>
            ) : (
              <Trans>Algemeen, ideeën en projectthreads voor {primaryCompany.name}.</Trans>
            )
          }
          breadcrumb={
            <PageBreadcrumb
              items={
                discussionId && detailDiscussionCompany
                  ? [
                      { label: t`Dashboard`, to: '/app/dashboard' },
                      { label: t`Discussies`, to: '/app/discussions' },
                      {
                        label:
                          DISCUSSION_CATEGORY_LABELS[detailDiscussionCompany.categoryType ?? 'project'] ??
                          t`Discussie`,
                      },
                      { label: detailDiscussionCompany.title },
                    ]
                  : [{ label: t`Dashboard`, to: '/app/dashboard' }, { label: t`Discussies` }]
              }
            />
          }
          actions={<CompanyScopeControl />}
        />

        <div className="forum-layout">
          <DiscussionCategorySidebar
            active={filter}
            onChange={handleCategoryChange}
            counts={sidebarCounts}
          />
          <div className={`forum-main ${discussionId ? 'forum-main--detail' : ''}`}>
            {discussionId ? (
              <TopicDetailPanel
                discussionId={discussionId}
                companyId={detailCompany.$id}
                teamId={detailCompany.teamId}
                role={role}
                displayName={displayName}
                onBack={handleBackToList}
              />
            ) : (
              <>
                <div className="pane-header pane-header--actions-only">
                  <button type="button" className="btn-accent" onClick={() => setShowNew(true)}>
                    <MessageSquarePlus size={16} /> <Trans>Nieuw topic</Trans>
                  </button>
                </div>
                <TopicList
                  companyId={primaryCompany.$id}
                  discussions={filter === 'all' ? allDiscussions : discussions}
                  filter={filter}
                  isLoading={isLoading}
                  displayName={displayName}
                  projectName={projectNameById}
                  grouped={filter === 'all'}
                  detailPath={(id) => `/app/discussions/${id}`}
                />
              </>
            )}
          </div>
        </div>
      </div>

      {showNew && (
        <NewTopicDialog
          companyId={primaryCompany.$id}
          teamId={primaryCompany.teamId}
          userId={user.$id}
          projects={projects.filter((project) => project.companyId === primaryCompany.$id)}
          defaultCategoryType={filter === 'all' ? 'general' : filter}
          canGrantStaffRoles={role === 'admin' || role === 'developer'}
          companyOptions={
            isMultiCompany
              ? enabledCompanyIds.map((id) => ({
                  id,
                  name: companyById(id)?.name ?? id,
                }))
              : undefined
          }
          onCompanyChange={setFormCompanyId}
          onClose={() => setShowNew(false)}
          onCreated={(id) => navigate(`/app/discussions/${id}`)}
        />
      )}
    </div>
  );
}
