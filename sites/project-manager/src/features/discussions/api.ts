import { Channel, ID, Query } from 'appwrite';
import { client, tablesDB } from '../../appwrite/client';
import { DATABASE_ID, TABLES } from '../../appwrite/constants';
import {
  adminOnlyDiscussionPermissions,
  discussionPermissions,
} from '../../appwrite/permissions';
import type {
  DiscussionCategoryType,
  DiscussionReplyRow,
  DiscussionRow,
} from '../../appwrite/types';
import {
  DISCUSSION_CATEGORY_IDS,
  DISCUSSION_NO_PROJECT_ID,
} from '../../appwrite/types';
import { assignProjectDeveloper } from '../../lib/functions';

function isPermissionGrantError(err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  return message.includes('Permissions must be one of');
}

async function syncDiscussionAcl(input: {
  companyId: string;
  teamId: string;
  projectId?: string | null;
}) {
  try {
    await assignProjectDeveloper({
      action: 'syncDiscussionPermissions',
      companyId: input.companyId,
      teamId: input.teamId,
      projectId:
        input.projectId && input.projectId !== DISCUSSION_NO_PROJECT_ID
          ? input.projectId
          : undefined,
    });
  } catch {
    // Row exists; ACL sync is best-effort via API key.
  }
}

export type DiscussionListFilter = {
  categoryType?: DiscussionCategoryType;
  projectId?: string;
};

function categoryFields(input: {
  categoryType: DiscussionCategoryType;
  projectId?: string | null;
}): { categoryType: DiscussionCategoryType; categoryId: string; projectId: string } {
  if (input.categoryType === 'project') {
    const projectId = input.projectId?.trim();
    if (!projectId) {
      throw new Error('projectId is required for project discussions');
    }
    return {
      categoryType: 'project',
      categoryId: projectId,
      projectId,
    };
  }
  if (input.categoryType === 'general') {
    return {
      categoryType: 'general',
      categoryId: DISCUSSION_CATEGORY_IDS.general,
      projectId: DISCUSSION_NO_PROJECT_ID,
    };
  }
  return {
    categoryType: 'idea',
    categoryId: DISCUSSION_CATEGORY_IDS.ideas,
    projectId: DISCUSSION_NO_PROJECT_ID,
  };
}

export async function listDiscussionsByCompany(
  companyId: string,
  filter?: DiscussionListFilter,
) {
  return listDiscussionsForCompanies([companyId], filter);
}

export async function listDiscussionsForCompanies(
  companyIds: string[],
  filter?: DiscussionListFilter,
) {
  if (companyIds.length === 0) return [];
  const queries = [
    Query.equal('companyId', companyIds),
    Query.orderDesc('$createdAt'),
    Query.limit(500),
  ];
  if (filter?.categoryType) {
    queries.push(Query.equal('categoryType', filter.categoryType));
  }
  if (filter?.projectId) {
    queries.push(Query.equal('projectId', filter.projectId));
  }
  const result = await tablesDB.listRows<DiscussionRow>({
    databaseId: DATABASE_ID,
    tableId: TABLES.discussions,
    queries,
  });
  return result.rows;
}

/** @deprecated Prefer listDiscussionsByProject — kept for callers that pass only projectId. */
export async function listDiscussions(projectId: string) {
  return listDiscussionsByProject(projectId);
}

export async function listDiscussionsByProject(projectId: string) {
  const result = await tablesDB.listRows<DiscussionRow>({
    databaseId: DATABASE_ID,
    tableId: TABLES.discussions,
    queries: [
      Query.equal('projectId', projectId),
      Query.equal('categoryType', 'project'),
      Query.orderDesc('$createdAt'),
      Query.limit(100),
    ],
  });
  return result.rows;
}

export async function getDiscussionByTaskId(taskId: string) {
  const result = await tablesDB.listRows<DiscussionRow>({
    databaseId: DATABASE_ID,
    tableId: TABLES.discussions,
    queries: [
      Query.equal('taskId', taskId),
      Query.orderDesc('$createdAt'),
      Query.limit(1),
    ],
  });
  return result.rows[0] ?? null;
}

export async function getDiscussion(discussionId: string) {
  return tablesDB.getRow<DiscussionRow>({
    databaseId: DATABASE_ID,
    tableId: TABLES.discussions,
    rowId: discussionId,
  });
}

export async function listDiscussionReplies(discussionId: string) {
  const result = await tablesDB.listRows<DiscussionReplyRow>({
    databaseId: DATABASE_ID,
    tableId: TABLES.discussionReplies,
    queries: [
      Query.equal('discussionId', discussionId),
      Query.orderAsc('$createdAt'),
      Query.limit(200),
    ],
  });
  return result.rows;
}

export async function createDiscussion(input: {
  companyId: string;
  teamId: string;
  title: string;
  body: string;
  createdBy: string;
  categoryType: DiscussionCategoryType;
  projectId?: string | null;
  taskId?: string | null;
  assigneeUserIds?: string[];
  canGrantStaffRoles?: boolean;
}) {
  const categories = categoryFields(input);
  const rowId = ID.unique();
  const taskId = input.taskId?.trim();
  const data = {
    companyId: input.companyId,
    title: input.title,
    body: input.body,
    createdBy: input.createdBy,
    totalReplies: 0,
    ...categories,
    ...(taskId ? { taskId } : {}),
  };

  try {
    return await tablesDB.createRow<DiscussionRow>({
      databaseId: DATABASE_ID,
      tableId: TABLES.discussions,
      rowId,
      data,
      permissions: discussionPermissions(input.teamId, input.createdBy, {
        participantUserIds: input.assigneeUserIds,
        canGrantStaffRoles: input.canGrantStaffRoles,
      }),
    });
  } catch (err) {
    if (!isPermissionGrantError(err)) throw err;
    const created = await tablesDB.createRow<DiscussionRow>({
      databaseId: DATABASE_ID,
      tableId: TABLES.discussions,
      rowId,
      data,
      permissions: adminOnlyDiscussionPermissions(),
    });
    await syncDiscussionAcl({
      companyId: input.companyId,
      teamId: input.teamId,
      projectId: categories.projectId,
    });
    return created;
  }
}

async function bumpTotalReplies(discussionId: string) {
  try {
    const discussion = await getDiscussion(discussionId);
    const next = (discussion.totalReplies ?? 0) + 1;
    await tablesDB.updateRow<DiscussionRow>({
      databaseId: DATABASE_ID,
      tableId: TABLES.discussions,
      rowId: discussionId,
      data: { totalReplies: next },
    });
  } catch {
    // Reply already saved; counter is best-effort.
  }
}

export async function createDiscussionReply(input: {
  discussionId: string;
  companyId: string;
  projectId?: string | null;
  teamId: string;
  body: string;
  createdBy: string;
  assigneeUserIds?: string[];
  canGrantStaffRoles?: boolean;
}) {
  const rowId = ID.unique();
  const projectId =
    input.projectId && input.projectId !== DISCUSSION_NO_PROJECT_ID
      ? input.projectId
      : DISCUSSION_NO_PROJECT_ID;
  const data = {
    discussionId: input.discussionId,
    companyId: input.companyId,
    projectId,
    body: input.body,
    createdBy: input.createdBy,
  };

  let created: DiscussionReplyRow;
  let needsAclSync = false;
  try {
    created = await tablesDB.createRow<DiscussionReplyRow>({
      databaseId: DATABASE_ID,
      tableId: TABLES.discussionReplies,
      rowId,
      data,
      permissions: discussionPermissions(input.teamId, input.createdBy, {
        participantUserIds: input.assigneeUserIds,
        canGrantStaffRoles: input.canGrantStaffRoles,
      }),
    });
  } catch (err) {
    if (!isPermissionGrantError(err)) throw err;
    created = await tablesDB.createRow<DiscussionReplyRow>({
      databaseId: DATABASE_ID,
      tableId: TABLES.discussionReplies,
      rowId,
      data,
      permissions: adminOnlyDiscussionPermissions(),
    });
    needsAclSync = true;
  }

  await bumpTotalReplies(input.discussionId);
  if (needsAclSync) {
    await syncDiscussionAcl({
      companyId: input.companyId,
      teamId: input.teamId,
      projectId,
    });
  }
  return created;
}

/** Update an existing discussion reply body. */
export async function updateDiscussionReply(input: {
  replyId: string;
  body: string;
}) {
  return tablesDB.updateRow<DiscussionReplyRow>({
    databaseId: DATABASE_ID,
    tableId: TABLES.discussionReplies,
    rowId: input.replyId,
    data: {
      body: input.body,
    },
  });
}

/** Delete a discussion topic and cascade-delete its replies. Requires admin table permission. */
export async function deleteDiscussion(discussionId: string) {
  let cursor: string | undefined;
  for (;;) {
    const queries = [Query.equal('discussionId', discussionId), Query.limit(100)];
    if (cursor) queries.push(Query.cursorAfter(cursor));
    const page = await tablesDB.listRows<DiscussionReplyRow>({
      databaseId: DATABASE_ID,
      tableId: TABLES.discussionReplies,
      queries,
    });
    if (page.rows.length === 0) break;
    await Promise.all(
      page.rows.map((reply) =>
        tablesDB.deleteRow({
          databaseId: DATABASE_ID,
          tableId: TABLES.discussionReplies,
          rowId: reply.$id,
        }),
      ),
    );
    if (page.rows.length < 100) break;
    cursor = page.rows[page.rows.length - 1].$id;
  }

  await tablesDB.deleteRow({
    databaseId: DATABASE_ID,
    tableId: TABLES.discussions,
    rowId: discussionId,
  });
}

/** Subscribe to reply creates/updates for a discussion. Returns an unsubscribe fn. */
export function subscribeToReplies(
  discussionId: string,
  onChange: (payload: DiscussionReplyRow) => void,
): () => void {
  return client.subscribe<DiscussionReplyRow>(
    Channel.tablesdb(DATABASE_ID).table(TABLES.discussionReplies),
    (event) => {
      const row = event.payload;
      if (!row || row.discussionId !== discussionId) return;
      onChange(row);
    },
  );
}
