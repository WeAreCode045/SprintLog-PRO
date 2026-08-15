/**
 * Single Source of Truth for Appwrite TablesDB row shapes and domain enums.
 * Frontend and Appwrite Functions must import from this module only.
 */

export const DATABASE_ID = 'main' as const;

export const TABLES = {
  companies: 'companies',
  projects: 'projects',
  taskGroups: 'taskGroups',
  tasks: 'tasks',
  timeEntries: 'timeEntries',
  userProfiles: 'userProfiles',
  projectAssignments: 'projectAssignments',
  discussions: 'discussions',
  discussionReplies: 'discussionReplies',
  projectFiles: 'projectFiles',
  notifications: 'notifications',
  invoices: 'invoices',
  invoiceItems: 'invoiceItems',
  invoiceSettings: 'invoiceSettings',
  functionResults: 'functionResults',
  /** Grouped JSON-blob replacement for invoiceSettings — see AdminSettingsRawRow. */
  adminSettings: 'adminSettings',
} as const;

export type TableId = (typeof TABLES)[keyof typeof TABLES];

export const BUCKETS = {
  projectFiles: 'project-files',
  invoicePdfs: 'invoice-pdfs',
} as const;

export const ADMIN_LABEL = 'admin' as const;
export const DEVELOPER_LABEL = 'developer' as const;

export const TEAM_ROLES = {
  client: 'client',
  owner: 'owner',
} as const;

export type TaskStatus = 'open' | 'finished' | 'requested' | 'archived';
export type TaskAudience = 'internal' | 'client';
export type ProjectStatus = 'active' | 'on_hold' | 'completed' | 'archived';
export type ProjectPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TaskPriority = ProjectPriority;
export type TaskType =
  | 'development'
  | 'debugging'
  | 'testing'
  | 'updates'
  | 'install'
  | 'seo'
  | 'sea'
  | 'design'
  | 'training'
  | 'meeting'
  | 'other';

export const TASK_TYPES: TaskType[] = [
  'development',
  'debugging',
  'testing',
  'updates',
  'install',
  'seo',
  'sea',
  'design',
  'training',
  'meeting',
  'other',
];

export const TASK_TYPE_LABELS: Record<TaskType, string> = {
  development: 'Development',
  debugging: 'Debugging',
  testing: 'Testing',
  updates: 'Updates',
  install: 'Install',
  seo: 'SEO',
  sea: 'SEA',
  design: 'Design',
  training: 'Training',
  meeting: 'Meeting',
  other: 'Other',
};
export type GlobalRole = 'admin' | 'developer' | 'client';
export type TeamMemberRole = 'client';
export type ResolvedRole = GlobalRole;
export type DiscussionCategoryType = 'general' | 'idea' | 'project';

/** Sentinel projectId for non-project discussions (Appwrite column stays required). */
export const DISCUSSION_NO_PROJECT_ID = '__none__' as const;

export const DISCUSSION_CATEGORY_TYPES: DiscussionCategoryType[] = ['general', 'idea', 'project'];

export const DISCUSSION_CATEGORY_LABELS: Record<DiscussionCategoryType, string> = {
  general: 'Algemeen',
  idea: 'Ideeën',
  project: 'Projecten',
};

export const DISCUSSION_CATEGORY_IDS = {
  general: 'general',
  ideas: 'ideas',
} as const;
export type NotificationType =
  | 'task_completed'
  | 'task_assigned'
  | 'file_requested'
  | 'file_uploaded'
  | 'discussion_active'
  | 'task_created'
  | 'hours_approved'
  | 'hours_unlocked'
  | 'invoice_sent';

/** Appwrite TablesDB row system fields. */
export interface RowMeta {
  $id: string;
  $sequence: string;
  $tableId: string;
  $databaseId: string;
  $createdAt: string;
  $updatedAt: string;
  $permissions: string[];
}

export interface CompanyRow extends RowMeta {
  name: string;
  teamId: string;
  email?: string | null;
  address?: string | null;
  postalCode?: string | null;
  city?: string | null;
  country?: string | null;
  phone?: string | null;
  /** Billing rate used by generate-invoices; unset companies are skipped during generation. */
  hourlyRate?: number | null;
  /** Client-editable VAT/BTW number, shown on the invoice's recipient ("Naar") block. */
  vatNumber?: string | null;
  vatExempt?: boolean | null;
  invoiceAddress?: string | null;
  invoicePostalCode?: string | null;
  invoiceCity?: string | null;
  invoiceCountry?: string | null;
  invoiceEmail?: string | null;
  autoApproveHours?: boolean | null;
  /** Admin-only default invoice footer for this customer. Pre-fills new invoices
   * before the global invoiceSettings.footerText fallback. */
  generalTerms?: string | null;
  /** Client-editable default payment term (days) for this company. Pre-fills new invoices
   * before the global invoiceSettings.paymentTermDays fallback. */
  paymentTermDays?: number | null;
}

export interface ProjectRow extends RowMeta {
  companyId: string;
  name: string;
  description?: string | null;
  /** Custom external URL set by admin (website, staging, docs, etc.). */
  link?: string | null;
  status?: ProjectStatus | null;
  priority?: ProjectPriority | null;
}

export interface TaskGroupRow extends RowMeta {
  projectId: string;
  companyId: string;
  name: string;
  order?: number | null;
}

export interface TaskRow extends RowMeta {
  companyId: string;
  projectId: string;
  taskGroupId?: string | null;
  title: string;
  description?: string | null;
  status: TaskStatus;
  /** Denormalized sum of timeEntries.hours for this task. */
  hours?: number | null;
  completedDate?: string | null;
  createdBy?: string | null;
  order?: number | null;
  parentTaskId?: string | null;
  audience?: TaskAudience | null;
  assigneeIds?: string[] | null;
  requiresFileUpload?: boolean | null;
  priority?: TaskPriority | null;
  taskType?: TaskType | null;
  dueDate?: string | null;
}

/** Individual hours log against an internal task. */
export interface TimeEntryRow extends RowMeta {
  companyId: string;
  projectId: string;
  taskId: string;
  userId: string;
  hours: number;
  workedDate: string;
  comment?: string | null;
  /** Client sign-off via approve-time-entries; locks the row (see lockedTimeEntryPermissions). */
  approved?: boolean | null;
  /** Set by generate-invoices once billed; approved+invoiced rows can no longer be unlocked. */
  invoiced?: boolean | null;
  invoiceId?: string | null;
  /** Staff-marked hours that skip client approval and are excluded from invoicing. */
  freeOfCharge?: boolean | null;
}

export interface UserProfileRow extends RowMeta {
  userId: string;
  displayName: string;
  email: string;
  globalRole: GlobalRole;
  avatarFileId?: string | null;
}

export interface ProjectAssignmentRow extends RowMeta {
  companyId: string;
  projectId: string;
  userId: string;
  assignedBy: string;
}

export interface DiscussionRow extends RowMeta {
  companyId: string;
  /**
   * Real project id when categoryType is project.
   * For general/idea rows this is DISCUSSION_NO_PROJECT_ID (column remains required in Appwrite).
   */
  projectId: string;
  categoryType: DiscussionCategoryType;
  /** 'general' | 'ideas' | projectId */
  categoryId: string;
  title: string;
  body: string;
  createdBy: string;
  totalReplies?: number | null;
  /** When set, this topic is the discussion thread for a task. */
  taskId?: string | null;
}

export interface DiscussionReplyRow extends RowMeta {
  discussionId: string;
  companyId: string;
  projectId: string;
  body: string;
  createdBy: string;
}

export interface ProjectFileRow extends RowMeta {
  companyId: string;
  projectId: string;
  taskId?: string | null;
  bucketFileId: string;
  name: string;
  mimeType: string;
  size: number;
  uploadedBy: string;
}

export interface NotificationRow extends RowMeta {
  userId: string;
  companyId: string;
  projectId?: string | null;
  type: NotificationType;
  title: string;
  body?: string | null;
  href?: string | null;
  readAt?: string | null;
  sourceId?: string | null;
}

export type InvoiceStatus = 'draft' | 'sent' | 'void';

export const INVOICE_STATUSES: InvoiceStatus[] = ['draft', 'sent', 'void'];

/** Admin-composed invoice: a companyId, a set of invoiceItems, and draft/sent/void status.
 * Line items live in InvoiceItemRow — this row only carries computed totals + metadata. */
export interface InvoiceRow extends RowMeta {
  companyId: string;
  /** "INV-<year>-####", assigned only when the invoice is sent (keeps the sequence gapless). */
  invoiceNumber?: string | null;
  /** ISO datetime; min workedDate across hour-sourced line items, null for manual-only invoices. */
  periodStart?: string | null;
  /** ISO datetime; max workedDate across hour-sourced line items, null for manual-only invoices. */
  periodEnd?: string | null;
  /** Sum of invoiceItems.quantity. */
  totalHours: number;
  /** Subtotal excl. VAT — sum of invoiceItems.quantity * unitPrice. */
  totalAmount: number;
  currency: string;
  status: InvoiceStatus;
  pdfFileId?: string | null;
  /** ISO datetime the invoice was issued — distinct from periodStart/periodEnd (the billed work period). */
  issueDate?: string | null;
  /** issueDate + paymentTermDays. */
  dueDate?: string | null;
  /** ISO datetime the invoice was sent to the client. */
  sentAt?: string | null;
  /** Per-invoice snapshot/override of invoiceSettings.paymentTermDays. */
  paymentTermDays?: number | null;
  /** Per-invoice override of invoiceSettings.defaultInstructionsText, pre-filled on creation. */
  instructionsText?: string | null;
  /** Per-invoice override of invoiceSettings.footerText, pre-filled on creation. */
  footerText?: string | null;
  /** Sum across invoiceItems of quantity * unitPrice * vatRate / 100 (items may carry different rates). */
  vatAmount?: number | null;
  /** totalAmount + vatAmount — the actual amount due. */
  totalWithVat?: number | null;
  /** Set on a credit note: the invoice it reverses. Amounts mirror that invoice's totals
   * (positive magnitudes — the column min:0 constraint rules out signed storage), the
   * `creditForInvoiceId` presence is what marks it as a reversal, not the original. */
  creditForInvoiceId?: string | null;
  /** Set on the original invoice once a credit note has been issued against it. */
  creditedByInvoiceId?: string | null;
}

/** One billable line on an InvoiceRow. Created directly by the admin (manual line) or via
 * "Voeg goedgekeurde uren toe" (sourceTimeEntryIds populated, quantity = aggregated hours). */
export interface InvoiceItemRow extends RowMeta {
  invoiceId: string;
  /** Denormalized from the parent invoice, matching every other table's convention. */
  companyId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  /** Resolved percentage (0/9/21/…), not a tier enum — snapshot so historic invoices stay
   * accurate even if invoiceSettings.vatRateHigh/vatRateLow change later. */
  vatRate: number;
  order?: number | null;
  /** timeEntries this line represents when added via the approved-hours modal; null/empty for
   * manual lines. Drives releasing those entries back to billable when the row is removed. */
  sourceTimeEntryIds?: string[] | null;
}

/** Global, admin-only invoice template/billing configuration — a single row (rowId 'default'). */
export interface InvoiceSettingsRow extends RowMeta {
  senderName?: string | null;
  senderAddress?: string | null;
  senderPostalCode?: string | null;
  senderCity?: string | null;
  senderCountry?: string | null;
  senderVatNumber?: string | null;
  senderRegistrationNumber?: string | null;
  contactPerson?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
  contactWebsite?: string | null;
  bankName?: string | null;
  bankIban?: string | null;
  bankSwiftBic?: string | null;
  vatEnabled?: boolean | null;
  /** "Hoog" tariff percentage, e.g. 21 for 21%. Default for invoiceItems.vatRate. */
  vatRateHigh?: number | null;
  /** "Laag" tariff percentage, e.g. 9 for 9%. */
  vatRateLow?: number | null;
  /** Display label for the VAT line, e.g. "BTW" or "VAT". */
  vatLabel?: string | null;
  paymentTermDays?: number | null;
  currency?: string | null;
  /** Optional note shown near the totals/footer (payment terms, legal text). Also the default
   * that pre-fills a new invoice's own footerText, editable per invoice. */
  footerText?: string | null;
  /** Optional default "order info" block shown near the top of the invoice. Also the default
   * that pre-fills a new invoice's own instructionsText, editable per invoice. */
  defaultInstructionsText?: string | null;
  /** footerText equivalent used on credit note PDFs instead of footerText. */
  creditFooterText?: string | null;
  /** defaultInstructionsText equivalent used on credit note PDFs instead of defaultInstructionsText. */
  creditInstructionsText?: string | null;
}

/**
 * Raw shape of the `adminSettings` table row — one JSON-string column per AdminSettingsPage tab,
 * so adding/renaming a field is a pure code change (no Appwrite schema migration). Flattened into
 * (and split back out of) the app-wide `InvoiceSettingsRow` shape by the invoiceSettings feature's
 * api.ts — every other consumer (AdminSettingsPage, InvoiceForm, InvoicePreviewDocument, the
 * invoices function) still works with the flat shape and never sees this directly.
 */
export interface AdminSettingsRawRow extends RowMeta {
  /** JSON-encoded: senderName, contactPerson, senderAddress, senderPostalCode, senderCity,
   * senderCountry, senderRegistrationNumber, contactPhone, contactEmail, contactWebsite. */
  company?: string | null;
  /** JSON-encoded: bankName, bankIban, bankSwiftBic. */
  bank?: string | null;
  /** JSON-encoded: vatEnabled, vatRateHigh, vatRateLow, vatLabel, senderVatNumber,
   * paymentTermDays, currency. */
  vat?: string | null;
  /** JSON-encoded: defaultInstructionsText, footerText, creditInstructionsText, creditFooterText. */
  texts?: string | null;
}

export interface AccessibleCompany {
  companyId: string;
  teamId: string;
  role: TeamMemberRole;
}

export interface AccessibleProject {
  companyId: string;
  projectId: string;
}

/** Admin Users page: Appwrite account + profile + client company links. */
export interface AdminUserCompany {
  companyId: string;
  teamId: string;
  name: string;
}

/** A single Appwrite team membership, for the "Teams" panel on the user detail page. */
export interface AdminUserMembership {
  membershipId: string;
  teamId: string;
  teamName: string;
  roles: string[];
  confirm: boolean;
}

export interface AdminUser {
  userId: string;
  email: string;
  displayName: string;
  role: GlobalRole;
  companies: AdminUserCompany[];
  memberships: AdminUserMembership[];
  profileId?: string | null;
  status?: boolean;
  lastLoginAt?: string | null;
}

export const MAX_TASK_NEST_DEPTH = 3;

export const NOTIFICATION_TYPES: NotificationType[] = [
  'task_completed',
  'task_assigned',
  'file_requested',
  'file_uploaded',
  'discussion_active',
  'task_created',
  'hours_approved',
  'hours_unlocked',
  'invoice_sent',
];
