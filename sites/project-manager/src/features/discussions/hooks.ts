import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../lib/queryKeys';
import type { DiscussionCategoryType, DiscussionReplyRow } from '../../appwrite/types';
import {
  createDiscussion,
  createDiscussionReply,
  deleteDiscussion,
  getDiscussion,
  getDiscussionByTaskId,
  listDiscussionReplies,
  listDiscussionsByCompany,
  listDiscussionsForCompanies,
  listDiscussionsByProject,
  subscribeToReplies,
  type DiscussionListFilter,
} from './api';

export function useDiscussions(projectId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.discussions(projectId ?? ''),
    queryFn: () => listDiscussionsByProject(projectId!),
    enabled: Boolean(projectId),
  });
}

export function useCompanyDiscussions(
  companyId: string | undefined,
  filter?: DiscussionListFilter,
) {
  return useQuery({
    queryKey: queryKeys.discussionsByCompany(
      companyId ?? '',
      filter?.categoryType ?? 'all',
      filter?.projectId ?? null,
    ),
    queryFn: () => listDiscussionsByCompany(companyId!, filter),
    enabled: Boolean(companyId),
  });
}

export function useDiscussionsForCompanies(
  companyIds: string[],
  filter?: DiscussionListFilter,
) {
  const sortedIds = companyIds.slice().sort();
  return useQuery({
    queryKey: queryKeys.discussionsByCompanies(
      sortedIds,
      filter?.categoryType ?? 'all',
      filter?.projectId ?? null,
    ),
    queryFn: () => listDiscussionsForCompanies(sortedIds, filter),
    enabled: sortedIds.length > 0,
  });
}

export function useDiscussion(discussionId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.discussion(discussionId ?? ''),
    queryFn: () => getDiscussion(discussionId!),
    enabled: Boolean(discussionId),
  });
}

export function useDiscussionByTask(taskId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.discussionByTask(taskId ?? ''),
    queryFn: () => getDiscussionByTaskId(taskId!),
    enabled: Boolean(taskId),
  });
}

export function useDiscussionReplies(discussionId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.discussionReplies(discussionId ?? ''),
    queryFn: () => listDiscussionReplies(discussionId!),
    enabled: Boolean(discussionId),
  });
}

/** Keep replies fresh via Appwrite realtime. */
export function useSubscribeDiscussionReplies(discussionId: string | undefined) {
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!discussionId) return;
    return subscribeToReplies(discussionId, (row) => {
      queryClient.setQueryData<DiscussionReplyRow[]>(
        queryKeys.discussionReplies(discussionId),
        (current) => {
          const existing = current ?? [];
          if (existing.some((item) => item.$id === row.$id)) {
            return existing.map((item) => (item.$id === row.$id ? row : item));
          }
          return [...existing, row].sort((a, b) => a.$createdAt.localeCompare(b.$createdAt));
        },
      );
      void queryClient.invalidateQueries({ queryKey: queryKeys.discussion(discussionId) });
      void queryClient.invalidateQueries({ queryKey: ['discussions'] });
    });
  }, [discussionId, queryClient]);
}

export function useCreateDiscussion(invalidateKey: {
  projectId?: string;
  companyId?: string;
  categoryType?: DiscussionCategoryType | 'all';
  taskId?: string;
}) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createDiscussion,
    onSuccess: () => {
      if (invalidateKey.projectId) {
        void queryClient.invalidateQueries({
          queryKey: queryKeys.discussions(invalidateKey.projectId),
        });
      }
      if (invalidateKey.companyId) {
        void queryClient.invalidateQueries({
          queryKey: ['discussions', 'company', invalidateKey.companyId],
        });
      }
      if (invalidateKey.taskId) {
        void queryClient.invalidateQueries({
          queryKey: queryKeys.discussionByTask(invalidateKey.taskId),
        });
      }
      void queryClient.invalidateQueries({ queryKey: ['discussions'] });
    },
  });
}

export function useDeleteDiscussion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteDiscussion,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['discussions'] });
      void queryClient.invalidateQueries({ queryKey: ['discussionReplies'] });
    },
  });
}

export function useCreateDiscussionReply(opts: {
  discussionId: string;
  projectId?: string;
  companyId?: string;
}) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createDiscussionReply,
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.discussionReplies(opts.discussionId),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.discussion(opts.discussionId),
      });
      if (opts.projectId) {
        void queryClient.invalidateQueries({
          queryKey: queryKeys.discussions(opts.projectId),
        });
      }
      if (opts.companyId) {
        void queryClient.invalidateQueries({
          queryKey: ['discussions', 'company', opts.companyId],
        });
      }
    },
  });
}
