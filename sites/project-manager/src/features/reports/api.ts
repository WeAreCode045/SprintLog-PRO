import { Query } from 'appwrite';
import { tablesDB } from '../../appwrite/client';
import { DATABASE_ID, TABLES } from '../../appwrite/constants';
import type { TaskRow } from '../../appwrite/types';

export interface ReportScope {
  start: Date;
  end: Date;
  companyIds?: string[];
}

/** Time reports only include finished developer (internal) tasks — never Client Tasks. */
export async function listReportTasks(scope: ReportScope) {
  const queries = [
    Query.equal('status', 'finished'),
    Query.equal('audience', 'internal'),
    Query.greaterThanEqual('completedDate', scope.start.toISOString()),
    Query.lessThanEqual('completedDate', scope.end.toISOString()),
    Query.orderDesc('completedDate'),
    Query.limit(1000),
  ];
  if (scope.companyIds && scope.companyIds.length > 0) {
    queries.push(Query.equal('companyId', scope.companyIds));
  }
  const result = await tablesDB.listRows<TaskRow>({
    databaseId: DATABASE_ID,
    tableId: TABLES.tasks,
    queries,
  });
  return result.rows;
}
