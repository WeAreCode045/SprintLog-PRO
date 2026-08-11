import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import { useLingui } from '@lingui/react/macro';
import { isStaffRole } from '../../auth/RequireStaff';
import type { ResolvedRole } from '../../appwrite/types';
import { listDiscussionReplies } from '../discussions/api';
import { useDiscussionsForCompanies } from '../discussions/hooks';
import { useProjectsForCompanies } from '../projects/hooks';
import { useTasksForCompanies } from '../tasks/hooks';
import { useUserProfiles } from '../profiles/hooks';
import { useTimeEntriesForCompanies } from '../timeEntries/hooks';
import { getDateRange } from '../../lib/dateRanges';
import { queryKeys } from '../../lib/queryKeys';

/** No upper bound on how far back pending (unapproved) hours can go — a task can run for
 * months before a client gets around to approving it. Wide static window stands in for
 * "all time" (same approach as the Time Approvals tab itself). */
function allTimeRange() {
  const end = new Date();
  end.setDate(end.getDate() + 1);
  const start = new Date(end);
  start.setFullYear(start.getFullYear() - 3);
  return { start, end };
}

/** Data + computed stats behind the dashboard chrome (top stat cards + right sidebar) —
 * shared by the Dashboard, Projects, and Discussions pages so all three carry the same
 * "action needed" / running-projects / activity companion. */
export function useDashboardOverview(enabledCompanyIds: string[], role: ResolvedRole) {
  const { t } = useLingui();
  const { data: projects = [], isLoading: projectsLoading } =
    useProjectsForCompanies(enabledCompanyIds);
  const { data: profiles = [] } = useUserProfiles(true);
  const { isLoading: openTasksLoading } = useTasksForCompanies(enabledCompanyIds, 'open');
  const { data: allTasks = [], isLoading: allTasksLoading } = useTasksForCompanies(
    enabledCompanyIds,
    'all',
  );
  const { data: discussions = [] } = useDiscussionsForCompanies(enabledCompanyIds);

  const recentDiscussions = discussions.slice(0, 12);

  const replyQueries = useQueries({
    queries: recentDiscussions.map((discussion) => ({
      queryKey: queryKeys.discussionReplies(discussion.$id),
      queryFn: () => listDiscussionReplies(discussion.$id),
      enabled: recentDiscussions.length > 0,
    })),
  });

  const profileNameById = useMemo(
    () => new Map(profiles.map((p) => [p.userId, p.displayName])),
    [profiles],
  );

  const projectNameById = useMemo(
    () => new Map(projects.map((project) => [project.$id, project.name])),
    [projects],
  );

  const weekRange = getDateRange('thisWeek');
  const monthRange = getDateRange('thisMonth');

  const { data: weekEntries = [] } = useTimeEntriesForCompanies(enabledCompanyIds, {
    start: weekRange.start,
    end: weekRange.end,
  });
  const { data: monthEntries = [] } = useTimeEntriesForCompanies(enabledCompanyIds, {
    start: monthRange.start,
    end: monthRange.end,
  });

  const staff = isStaffRole(role);
  const approvalsRange = useMemo(allTimeRange, []);
  const { data: approvalsRangeEntries = [] } = useTimeEntriesForCompanies(
    enabledCompanyIds,
    approvalsRange,
    role === 'client',
  );

  const taskById = useMemo(() => new Map(allTasks.map((task) => [task.$id, task])), [allTasks]);

  const hoursToApproveByCompany = useMemo(() => {
    const map = new Map<string, number>();
    if (role !== 'client') return map;
    for (const entry of approvalsRangeEntries) {
      if (entry.approved) continue;
      if ((taskById.get(entry.taskId)?.audience ?? 'internal') === 'client') continue;
      map.set(entry.companyId, (map.get(entry.companyId) ?? 0) + (entry.hours ?? 0));
    }
    return map;
  }, [approvalsRangeEntries, taskById, role]);

  const hoursToApprove = useMemo(
    () => [...hoursToApproveByCompany.values()].reduce((sum, hours) => sum + hours, 0),
    [hoursToApproveByCompany],
  );

  const pendingRequestedTasks = useMemo(() => {
    if (!staff) return [];
    return allTasks.filter(
      (task) => task.status === 'requested' && (task.audience ?? 'internal') === 'internal',
    );
  }, [allTasks, staff]);

  const activeProjects = useMemo(
    () => projects.filter((project) => (project.status ?? 'active') === 'active'),
    [projects],
  );

  const projectStats = useMemo(() => {
    return activeProjects.map((project) => {
      const projectTasks = allTasks.filter((task) => task.projectId === project.$id);
      const openCount = projectTasks.filter(
        (task) => task.status === 'open' || task.status === 'requested',
      ).length;
      const hours = projectTasks
        .filter((task) => (task.audience ?? 'internal') === 'internal')
        .reduce((sum, task) => sum + (task.hours ?? 0), 0);
      return { project, openCount, hours };
    });
  }, [activeProjects, allTasks]);

  const weekHours = weekEntries.reduce((sum, entry) => sum + (entry.hours ?? 0), 0);
  const monthHours = monthEntries.reduce((sum, entry) => sum + (entry.hours ?? 0), 0);

  const discussionFeed = useMemo(() => {
    const items: Array<{
      id: string;
      title: string;
      createdAt: string;
      href: string;
      kind: 'topic' | 'reply';
    }> = [];

    const allowed = new Set(enabledCompanyIds);
    const scopedDiscussions = discussions.filter((d) => allowed.has(d.companyId));

    for (const d of scopedDiscussions) {
      const author = profileNameById.get(d.createdBy) ?? t`Gebruiker`;
      items.push({
        id: `topic-${d.$id}`,
        title: t`${author} startte een nieuw topic: ${d.title}`,
        createdAt: d.$createdAt,
        href: `/app/discussions/${d.$id}`,
        kind: 'topic',
      });
    }

    replyQueries.forEach((q, index) => {
      const discussion = recentDiscussions[index];
      if (!discussion || !allowed.has(discussion.companyId)) return;
      for (const r of q.data ?? []) {
        const author = profileNameById.get(r.createdBy) ?? t`Gebruiker`;
        items.push({
          id: `reply-${r.$id}`,
          title: t`${author} reageerde op: ${discussion.title}`,
          createdAt: r.$createdAt,
          href: `/app/discussions/${discussion.$id}`,
          kind: 'reply',
        });
      }
    });

    items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return items.slice(0, 5);
  }, [discussions, replyQueries, recentDiscussions, profileNameById, enabledCompanyIds, t]);

  const statsForRange = (start: Date, end: Date) => {
    const startIso = start.toISOString();
    const endIso = end.toISOString();
    const startKey = start.toISOString().slice(0, 10);
    const endKey = end.toISOString().slice(0, 10);

    const allowed = new Set(enabledCompanyIds);
    const scopedProjects = projects.filter((p) => allowed.has(p.companyId));
    const scopedTasks = allTasks.filter((t) => allowed.has(t.companyId));
    const scopedDiscussions = discussions.filter((d) => allowed.has(d.companyId));

    const newProjects = scopedProjects.filter(
      (p) => p.$createdAt >= startIso && p.$createdAt <= endIso,
    ).length;
    const newTasks = scopedTasks.filter(
      (t) => t.$createdAt >= startIso && t.$createdAt <= endIso,
    ).length;
    const tasksCompleted = scopedTasks.filter(
      (t) =>
        t.status === 'finished' &&
        t.completedDate &&
        t.completedDate >= startKey &&
        t.completedDate <= endKey,
    ).length;
    const taskRequests = scopedTasks.filter(
      (t) => t.status === 'requested' && t.$createdAt >= startIso && t.$createdAt <= endIso,
    ).length;

    const entriesInRange = (start === weekRange.start ? weekEntries : monthEntries).filter((e) =>
      allowed.has(e.companyId),
    );
    const totalHours = entriesInRange.reduce((sum, e) => sum + (e.hours ?? 0), 0);
    const avgHoursPerTask = newTasks > 0 ? totalHours / newTasks : 0;
    const avgHoursPerProject = scopedProjects.length > 0 ? totalHours / scopedProjects.length : 0;

    const totalNewTopics = scopedDiscussions.filter(
      (d) => d.$createdAt >= startIso && d.$createdAt <= endIso,
    ).length;

    let totalReplies = 0;
    replyQueries.forEach((q, index) => {
      const discussion = recentDiscussions[index];
      if (!discussion || !allowed.has(discussion.companyId)) return;
      for (const r of q.data ?? []) {
        if (r.$createdAt >= startIso && r.$createdAt <= endIso) {
          totalReplies += 1;
        }
      }
    });

    return {
      totalProjects: scopedProjects.length,
      newProjects,
      newTasks,
      tasksCompleted,
      taskRequests,
      totalHours,
      avgHoursPerTask,
      avgHoursPerProject,
      totalNewTopics,
      totalReplies,
    };
  };

  const currentStats = statsForRange(weekRange.start, weekRange.end);
  const loading = projectsLoading || openTasksLoading || allTasksLoading;

  return {
    loading,
    staff,
    projectNameById,
    projectStats,
    weekHours,
    monthHours,
    discussionFeed,
    currentStats,
    hoursToApprove,
    hoursToApproveByCompany,
    pendingRequestedTasks,
  };
}

export type DashboardOverview = ReturnType<typeof useDashboardOverview>;
