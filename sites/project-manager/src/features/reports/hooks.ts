import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../../lib/queryKeys';
import { listReportTasks, type ReportScope } from './api';

export function useReportTasks(scope: ReportScope, enabled: boolean) {
  const key = [
    scope.start.toISOString(),
    scope.end.toISOString(),
    ...(scope.companyIds ?? []).slice().sort(),
  ].join('|');

  return useQuery({
    queryKey: queryKeys.reportTasks(key),
    queryFn: () => listReportTasks(scope),
    enabled,
  });
}
