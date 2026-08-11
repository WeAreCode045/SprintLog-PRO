import { ExecutionMethod } from 'appwrite';
import type { Models } from 'appwrite';
import { functions } from '../appwrite/client';
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

async function waitForExecution(functionId: string, executionId: string): Promise<Models.Execution> {
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

async function invokeJson<TResponse>(functionId: string, body: unknown): Promise<TResponse> {
  const queued = await functions.createExecution({
    functionId,
    body: JSON.stringify(body),
    method: ExecutionMethod.POST,
    headers: { 'Content-Type': 'application/json' },
    // Sync hard-caps at ~30s on this host even when the function itself is fast.
    async: true,
  });

  const execution =
    TERMINAL_EXECUTION_STATUSES.has(queued.status)
      ? queued
      : await waitForExecution(functionId, queued.$id);

  const statusCode = execution.responseStatusCode ?? 500;
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

  if (execution.status === 'failed' || statusCode >= 400 || parsed.success === false) {
    throw new Error(
      parsed.message ||
        execution.errors ||
        `Function ${functionId} failed (${statusCode || execution.status})`,
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
  }>('manage-user-role', body);
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
  return invokeJson<{ success: boolean }>('assign-project-developer', body);
}

export function assignTaskAssignees(body: {
  taskId: string;
  teamId: string;
  assigneeIds: string[];
  createdBy?: string | null;
}) {
  return invokeJson<{ success: boolean }>('assign-task-assignees', body);
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
  }>('add-team-client', body);
}

export function approveTimeEntries(body: { entryIds: string[]; teamId: string }) {
  return invokeJson<{ success: boolean; approvedCount: number }>('approve-time-entries', body);
}

export function unlockTimeEntries(body: { entryIds: string[]; teamId: string; reason: string }) {
  return invokeJson<{ success: boolean; unlockedCount: number }>('unlock-time-entries', body);
}

export function runInvoiceGeneration(body?: { companyId?: string }) {
  return invokeJson<{ success: boolean; invoicesCreated: number }>(
    'generate-invoices',
    { action: 'run', ...body },
  );
}

export function regenerateInvoice(invoiceId: string) {
  return invokeJson<{ success: boolean; invoiceId: string; pdfFileId: string }>(
    'generate-invoices',
    { action: 'regenerate', invoiceId },
  );
}

export function createCreditInvoice(invoiceId: string) {
  return invokeJson<{ success: boolean; creditInvoiceId: string; creditInvoiceNumber: string }>(
    'create-credit-invoice',
    { invoiceId },
  );
}
