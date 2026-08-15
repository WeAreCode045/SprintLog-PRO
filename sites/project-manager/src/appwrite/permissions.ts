import { Permission, Role } from 'appwrite';
import { ADMIN_LABEL, DEVELOPER_LABEL } from './constants';

/** Clients get row-level update so they can maintain their own contact details
 * (name, email, address, phone, vatNumber) via the client company settings page.
 * Appwrite has no column-level permissions, so this technically also covers admin-only fields like
 * hourlyRate and paymentTermDays — the UI never exposes those to clients, matching how the rest of
 * this app trusts client-side gating for lower-stakes fields (see e.g. updateOpenTask). */
export const companyPermissions = (teamId: string) => [
  Permission.read(Role.label(ADMIN_LABEL)),
  Permission.read(Role.team(teamId)),
  Permission.update(Role.label(ADMIN_LABEL)),
  Permission.update(Role.team(teamId)),
  Permission.delete(Role.label(ADMIN_LABEL)),
];

/** Client-safe company ACL when the actor cannot grant team:* (typical for platform admins). */
export const adminOnlyCompanyPermissions = () => [
  Permission.read(Role.label(ADMIN_LABEL)),
  Permission.update(Role.label(ADMIN_LABEL)),
  Permission.delete(Role.label(ADMIN_LABEL)),
];

export const projectPermissions = (teamId: string, assigneeUserIds: string[] = []) => [
  Permission.read(Role.label(ADMIN_LABEL)),
  Permission.read(Role.team(teamId)),
  Permission.update(Role.label(ADMIN_LABEL)),
  Permission.delete(Role.label(ADMIN_LABEL)),
  ...assigneeUserIds.flatMap((userId) => [
    Permission.read(Role.user(userId)),
    Permission.update(Role.user(userId)),
  ]),
];

/** Client-safe project ACL when the actor cannot grant team:* (typical for platform admins). */
export const adminOnlyProjectPermissions = () => [
  Permission.read(Role.label(ADMIN_LABEL)),
  Permission.update(Role.label(ADMIN_LABEL)),
  Permission.delete(Role.label(ADMIN_LABEL)),
];

export const taskGroupPermissions = (teamId: string, assigneeUserIds: string[] = []) => [
  Permission.read(Role.label(ADMIN_LABEL)),
  Permission.read(Role.team(teamId)),
  Permission.update(Role.label(ADMIN_LABEL)),
  Permission.delete(Role.label(ADMIN_LABEL)),
  ...assigneeUserIds.map((userId) => Permission.read(Role.user(userId))),
];

/** Client-safe task group ACL when the actor cannot grant team:* (typical for platform admins). */
export const adminOnlyTaskGroupPermissions = () => [
  Permission.read(Role.label(ADMIN_LABEL)),
  Permission.update(Role.label(ADMIN_LABEL)),
  Permission.delete(Role.label(ADMIN_LABEL)),
];

/**
 * Client-safe row ACL for open tasks.
 * Appwrite only allows granting roles the actor holds:
 * - Admins can grant label:admin (even when not on the company team).
 * - Team members can grant team:*.
 * Never grant label:developer or other users' user:* from the Web SDK.
 * Table-level permissions cover staff labels; a server sync can attach full team ACL.
 */
export const adminOnlyTaskPermissions = () => [
  Permission.read(Role.label(ADMIN_LABEL)),
  Permission.update(Role.label(ADMIN_LABEL)),
  Permission.delete(Role.label(ADMIN_LABEL)),
];

export const openTaskPermissions = (
  teamId: string,
  _createdBy: string,
  _assigneeUserIds: string[] = [],
) => [
  ...adminOnlyTaskPermissions(),
  Permission.read(Role.team(teamId)),
  Permission.update(Role.team(teamId)),
];

/** Client-safe row ACL for a newly created task: team-only. Any team member (a client) can
 * grant this. Staff get row access via table-level label:admin/label:developer regardless —
 * the post-create server sync (assign-project-developer syncPermissions) attaches the full
 * team+staff+assignee ACL, so this only needs to get the row created without erroring. */
export const clientSafeOpenTaskPermissions = (teamId: string) => [
  Permission.read(Role.team(teamId)),
  Permission.update(Role.team(teamId)),
];

/** Universal fallback when the actor holds neither the target team role nor a staff label
 * (e.g. a developer creating a task for a company they're not a team member of) — granting
 * permissions about yourself is always allowed. A subsequent server sync corrects the ACL. */
export const selfOnlyPermissions = (userId: string) => [
  Permission.read(Role.user(userId)),
  Permission.update(Role.user(userId)),
  Permission.delete(Role.user(userId)),
];

/** Client-safe row ACL for finished tasks — staff via table-level + admin label. */
export const finishedTaskPermissions = (teamId: string, _assigneeUserIds: string[] = []) => [
  ...adminOnlyTaskPermissions(),
  Permission.read(Role.team(teamId)),
];

/** Row-level only — never use Permission.create on rows (Appwrite rejects the write).
 * Web SDK actors may only grant roles they hold. Prefer team + self; staff labels come from
 * table-level ACL. Admins who are not on the company team fall back to admin-only grants. */
export const adminOnlyDiscussionPermissions = () => [
  Permission.read(Role.label(ADMIN_LABEL)),
  Permission.update(Role.label(ADMIN_LABEL)),
  Permission.delete(Role.label(ADMIN_LABEL)),
];

/** Full discussion ACL for server/API-key grants (team + staff + author). */
export const fullDiscussionPermissions = (teamId: string, createdBy: string) => [
  Permission.read(Role.label(ADMIN_LABEL)),
  Permission.read(Role.label(DEVELOPER_LABEL)),
  Permission.read(Role.team(teamId)),
  Permission.read(Role.user(createdBy)),
  Permission.update(Role.label(ADMIN_LABEL)),
  Permission.update(Role.label(DEVELOPER_LABEL)),
  Permission.update(Role.team(teamId)),
  Permission.update(Role.user(createdBy)),
  Permission.delete(Role.label(ADMIN_LABEL)),
  Permission.delete(Role.user(createdBy)),
];

/** Client-safe: team + author only (Web SDK actors may only grant roles they hold). */
export const discussionPermissions = (
  teamId: string,
  createdBy: string,
  options?: {
    participantUserIds?: string[];
    canGrantStaffRoles?: boolean;
  },
) => {
  if (options?.canGrantStaffRoles) {
    return fullDiscussionPermissions(teamId, createdBy);
  }
  return [
    Permission.read(Role.team(teamId)),
    Permission.update(Role.team(teamId)),
    Permission.read(Role.user(createdBy)),
    Permission.update(Role.user(createdBy)),
    Permission.delete(Role.user(createdBy)),
  ];
};

/** Client-safe row/file ACL for a newly uploaded project file: team read + uploader delete —
 * both grantable by any team member (a client). Staff read/delete comes from table/bucket-level
 * label:admin and label:developer grants, not from this row ACL (Appwrite only allows an actor
 * to grant roles they themselves hold — never label:admin or another user's user:* from the
 * Web SDK; see clientSafeOpenTaskPermissions for the same pattern applied to tasks). */
export const projectFilePermissions = (teamId: string, uploaderId: string) => [
  Permission.read(Role.team(teamId)),
  Permission.delete(Role.user(uploaderId)),
];

export const notificationPermissions = (userId: string) => [
  Permission.read(Role.user(userId)),
  Permission.update(Role.user(userId)),
  Permission.delete(Role.user(userId)),
  Permission.read(Role.label(ADMIN_LABEL)),
  Permission.update(Role.label(ADMIN_LABEL)),
  Permission.delete(Role.label(ADMIN_LABEL)),
];

export const userProfilePermissions = (userId: string) => [
  Permission.read(Role.user(userId)),
  Permission.update(Role.user(userId)),
  Permission.read(Role.label(ADMIN_LABEL)),
  Permission.update(Role.label(ADMIN_LABEL)),
  Permission.delete(Role.label(ADMIN_LABEL)),
];

export const assignmentPermissions = (userId: string, teamId: string) => [
  Permission.read(Role.label(ADMIN_LABEL)),
  Permission.read(Role.user(userId)),
  Permission.read(Role.team(teamId)),
  Permission.update(Role.label(ADMIN_LABEL)),
  Permission.delete(Role.label(ADMIN_LABEL)),
];

/** Client-safe time entry ACL when the actor cannot grant team:*. */
export const clientSafeTimeEntryPermissions = (ownerUserId: string) => [
  Permission.read(Role.label(ADMIN_LABEL)),
  Permission.update(Role.label(ADMIN_LABEL)),
  Permission.delete(Role.label(ADMIN_LABEL)),
  Permission.read(Role.user(ownerUserId)),
  Permission.update(Role.user(ownerUserId)),
  Permission.delete(Role.user(ownerUserId)),
];

/** Approved (billable) time entry: admin can still fix mistakes via unlock-time-entries,
 * everyone else — including the entry's own developer-owner — loses update/delete.
 * Team keeps read so approved hours remain visible in Reports/Invoices. */
export const lockedTimeEntryPermissions = (teamId: string) => [
  Permission.read(Role.label(ADMIN_LABEL)),
  Permission.update(Role.label(ADMIN_LABEL)),
  Permission.delete(Role.label(ADMIN_LABEL)),
  Permission.read(Role.team(teamId)),
];

/** Admin-only invoice/invoiceItems row ACL used while an invoice is a draft — clients must
 * never see a draft, enforced here at the row-permission level rather than only by UI filtering. */
export const draftInvoicePermissions = () => [
  Permission.read(Role.label(ADMIN_LABEL)),
  Permission.update(Role.label(ADMIN_LABEL)),
  Permission.delete(Role.label(ADMIN_LABEL)),
];

/** Invoice/invoiceItems row ACL once an invoice has been sent — adds client team read.
 * Only the send-invoice function (API key) upgrades a row from draft to this. */
export const sentInvoicePermissions = (teamId: string) => [
  ...draftInvoicePermissions(),
  Permission.read(Role.team(teamId)),
];

/** Row-level only — never use Permission.create on rows.
 * Clients/developers may only grant roles they hold; staff labels are covered by table-level ACL. */
export const timeEntryPermissions = (
  teamId: string,
  ownerUserId: string,
  options?: { canGrantStaffRoles?: boolean },
) => {
  const canGrantStaffRoles = options?.canGrantStaffRoles ?? true;
  if (!canGrantStaffRoles) {
    return [
      Permission.read(Role.team(teamId)),
      Permission.read(Role.user(ownerUserId)),
      Permission.update(Role.user(ownerUserId)),
      Permission.delete(Role.user(ownerUserId)),
    ];
  }
  return [
    Permission.read(Role.label(ADMIN_LABEL)),
    Permission.read(Role.label(DEVELOPER_LABEL)),
    Permission.read(Role.team(teamId)),
    Permission.read(Role.user(ownerUserId)),
    Permission.update(Role.label(ADMIN_LABEL)),
    Permission.update(Role.user(ownerUserId)),
    Permission.delete(Role.label(ADMIN_LABEL)),
    Permission.delete(Role.user(ownerUserId)),
  ];
};
