import { ExecutionMethod, ID } from 'appwrite';
import { functions, tablesDB } from '../appwrite/client';
import { DATABASE_ID, TABLES } from '../appwrite/constants';
import type { AdminUser, GlobalRole } from '../appwrite/types';

const EXECUTION_POLL_MAX_MS = 90_000;
const EXECUTION_POLL_INITIAL_MS = 200;
const EXECUTION_POLL_MAX_DELAY_MS = 2_000;
const TERMINAL_EXECUTION_STATUSES = new Set(['completed', 'failed']);

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Appwrite's GET /executions/{id} (used to poll an async execution) never returns
 * responseBody — only the initial createExecution call does — and synchronous execution
 * (async: false) reliably stalls ~30s on this project instead of returning fast. So the actual
 * function result travels via a `functionResults` row (written by the function, keyed by
 * requestId) that this client reads directly once the execution's status confirms success.
 * Functions that don't yet write that row (not every function has been migrated) fall back to
 * the (empty) execution responseBody, matching the previous behavior.
 */
async function fetchPersistedResult(requestId: string): Promise<unknown | undefined> {
  try {
    const row = await tablesDB.getRow({
      databaseId: DATABASE_ID,
      tableId: TABLES.functionResults,
      rowId: requestId,
    });
    void tablesDB
      .deleteRow({ databaseId: DATABASE_ID, tableId: TABLES.functionResults, rowId: requestId })
      .catch(() => {});
    return JSON.parse((row as unknown as { data: string }).data);
  } catch {
    return undefined;
  }
}

async function waitForExecution(functionId: string, executionId: string) {
  const startedAt = Date.now();
  let delayMs = EXECUTION_POLL_INITIAL_MS;

  while (Date.now() - startedAt < EXECUTION_POLL_MAX_MS) {
    const execution = await functions.getExecution({ functionId, executionId });
    if (TERMINAL_EXECUTION_STATUSES.has(execution.status)) {
      return execution;
    }
    await sleep(delayMs);
    delayMs = Math.min(Math.round(delayMs * 1.5), EXECUTION_POLL_MAX_DELAY_MS);
  }

  throw new Error(`Function ${functionId} timed out waiting for execution`);
}

async function invokeJson<TResponse>(
  functionId: string,
  body: unknown,
): Promise<TResponse> {
  const requestId = ID.unique();
  const queued = await functions.createExecution({
    functionId,
    body: JSON.stringify({ ...(body as object), requestId }),
    method: ExecutionMethod.POST,
    headers: { 'Content-Type': 'application/json' },
    async: true,
  });

  const execution =
    TERMINAL_EXECUTION_STATUSES.has(queued.status)
      ? queued
      : await waitForExecution(functionId, queued.$id);

  const statusCode = execution.responseStatusCode ?? 500;
  const failed = execution.status === 'failed' || statusCode >= 400;

  if (!failed) {
    const persisted = await fetchPersistedResult(requestId);
    if (persisted !== undefined) {
      return persisted as TResponse;
    }
  }

  let parsed: TResponse & { message?: string; success?: boolean };
  try {
    parsed = JSON.parse(execution.responseBody || '{}') as TResponse & {
      message?: string;
      success?: boolean;
    };
  } catch {
    throw new Error(
      execution.errors || execution.responseBody || `Function ${functionId} failed`,
    );
  }

  if (failed || parsed.success === false) {
    const errorsText = execution.errors?.trim();
    const errorsDetail = errorsText?.includes(':')
      ? errorsText.slice(errorsText.indexOf(':') + 1).trim()
      : errorsText;
    const detail =
      parsed.message ||
      errorsDetail ||
      (execution.responseBody && !execution.responseBody.startsWith('{')
        ? execution.responseBody
        : undefined);
    throw new Error(
      detail || `Function ${functionId} failed (${statusCode || execution.status})`,
    );
  }

  return parsed;
}

export function manageUserRole(
  body:
    | {
        action: 'setRole';
        userId: string;
        role: GlobalRole;
        displayName?: string;
        email?: string;
      }
    | {
        action: 'list';
      }
    | {
        action: 'get';
        userId: string;
      }
    | {
        action: 'update';
        userId: string;
        displayName?: string;
        email?: string;
        role?: GlobalRole;
        companyIds?: string[];
      }
    | {
        action: 'delete';
        userId: string;
      }
    | {
        action: 'listTeamMembers';
        teamId: string;
      }
    | {
        action: 'revokeTeamMember';
        teamId: string;
        membershipId: string;
      }
    | {
        action: 'inviteTeamMember';
        teamId: string;
        email: string;
        url: string;
      }
    | {
        action: 'resendTeamInvite';
        teamId: string;
        membershipId: string;
        email: string;
        url: string;
      }
    | {
        action: 'syncProfilePermissions';
      },
) {
  return invokeJson<{
    success: boolean;
    updated?: number;
    users?: AdminUser[];
    user?: AdminUser;
    memberships?: Array<{
      $id: string;
      userId: string;
      userName: string;
      userEmail: string;
      teamId: string;
      roles: string[];
      confirm: boolean;
    }>;
    membership?: { $id: string };
  }>('users', body);
}

export function listTeamMembers(teamId: string) {
  return manageUserRole({ action: 'listTeamMembers', teamId }).then((result) => result.memberships ?? []);
}

export function revokeTeamMember(teamId: string, membershipId: string) {
  return manageUserRole({ action: 'revokeTeamMember', teamId, membershipId });
}

export function inviteTeamMember(teamId: string, email: string, url: string) {
  return manageUserRole({ action: 'inviteTeamMember', teamId, email, url });
}

export function resendTeamInvite(teamId: string, membershipId: string, email: string, url: string) {
  return manageUserRole({ action: 'resendTeamInvite', teamId, membershipId, email, url });
}

export function listAdminUsers() {
  return manageUserRole({ action: 'list' }).then((result) => result.users ?? []);
}

export function getAdminUser(userId: string) {
  return manageUserRole({ action: 'get', userId }).then((result) => {
    if (!result.user) {
      throw new Error('User not found');
    }
    return result.user;
  });
}

export function updateAdminUser(body: {
  userId: string;
  displayName?: string;
  email?: string;
  role?: GlobalRole;
  companyIds?: string[];
}) {
  return manageUserRole({ action: 'update', ...body });
}

export function deleteAdminUser(userId: string) {
  return manageUserRole({ action: 'delete', userId });
}

export function assignProjectDeveloper(body: {
  action:
    | 'assign'
    | 'unassign'
    | 'syncPermissions'
    | 'syncDiscussionPermissions'
    | 'syncTimeEntryPermissions';
  companyId: string;
  projectId?: string;
  teamId: string;
  userId?: string;
}) {
  return invokeJson<{ success: boolean }>('projects', body);
}

export function assignTaskAssignees(body: {
  taskId: string;
  teamId: string;
  assigneeIds: string[];
  createdBy?: string | null;
}) {
  return invokeJson<{ success: boolean }>('tasks', { action: 'assignAssignees', ...body });
}

export function addTeamClient(body: {
  teamId: string;
  email: string;
  displayName?: string;
  password?: string;
}) {
  return invokeJson<{
    success: boolean;
    userId: string;
    membershipId: string;
    createdUser: boolean;
  }>('companies', { action: 'addTeamClient', ...body });
}

export function approveTimeEntries(body: { entryIds: string[]; teamId: string }) {
  return invokeJson<{ success: boolean; approvedCount: number }>('time-entries', {
    action: 'approve',
    ...body,
  });
}

export function unlockTimeEntries(body: { entryIds: string[]; teamId: string; reason: string }) {
  return invokeJson<{ success: boolean; unlockedCount: number }>('time-entries', {
    action: 'unlock',
    ...body,
  });
}

/** No-op (approved: false) unless the entry's company has autoApproveHours enabled — see
 * functions/time-entries/src/handlers/autoApprove.js for why this must run server-side. */
export function autoApproveTimeEntry(entryId: string) {
  return invokeJson<{ success: boolean; approved: boolean }>('time-entries', {
    action: 'autoApprove',
    entryId,
  });
}

export function sendInvoice(invoiceId: string) {
  return invokeJson<{ success: boolean; invoiceId: string; invoiceNumber: string; pdfFileId: string }>(
    'invoices',
    { action: 'send', invoiceId },
  );
}

export function regenerateInvoice(invoiceId: string) {
  return invokeJson<{ success: boolean; invoiceId: string; pdfFileId: string }>(
    'invoices',
    { action: 'regenerate', invoiceId },
  );
}

export function createCreditInvoice(invoiceId: string) {
  return invokeJson<{ success: boolean; creditInvoiceId: string; creditInvoiceNumber: string }>(
    'invoices',
    { action: 'createCredit', invoiceId },
  );
}

export type AdminDataResetType =
  | 'invoicing'
  | 'approvedHours'
  | 'bookedHours'
  | 'projects'
  | 'tasks';

export type AdminDataResetPreviewKind =
  | 'invoices'
  | 'invoiceItems'
  | 'invoicedEntriesReleased'
  | 'approvedEntries'
  | 'timeEntries'
  | 'tasks'
  | 'projects'
  | 'taskGroups'
  | 'discussions'
  | 'discussionReplies'
  | 'projectAssignments'
  | 'notifications'
  | 'projectFiles';

export type AdminDataResetPreviewItem = {
  kind: AdminDataResetPreviewKind;
  count: number;
};

export function adminDataReset(body: {
  action: 'dataReset';
  resetType: AdminDataResetType;
  companyId: string;
  projectId?: string;
  dryRun?: boolean;
}) {
  return invokeJson<{
    success: boolean;
    dryRun?: boolean;
    resetType: AdminDataResetType;
    companyId: string;
    projectId: string | null;
    items?: AdminDataResetPreviewItem[];
    releasedEntries?: number;
    deletedInvoiceItems?: number;
    deletedInvoices?: number;
    unapprovedEntries?: number;
    deletedEntries?: number;
    deletedTasks?: number;
    deletedProjects?: number;
  }>('companies', body);
}
