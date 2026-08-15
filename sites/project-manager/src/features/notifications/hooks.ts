import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../lib/queryKeys';
import { deleteNotification, listNotifications, markNotificationRead } from './api';

export function useNotifications(userId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.notifications(userId ?? ''),
    queryFn: () => listNotifications(userId!),
    enabled: Boolean(userId),
    refetchInterval: 30_000,
  });
}

export function useMarkNotificationRead(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: markNotificationRead,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications(userId) });
    },
  });
}

export function useDeleteNotification(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteNotification,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications(userId) });
    },
  });
}
