import {
  adminDataReset as invokeAdminDataReset,
  type AdminDataResetPreviewItem,
  type AdminDataResetType,
} from '../../lib/functions';
import { previewDataReset } from './previewDataReset';

export type { AdminDataResetPreviewItem, AdminDataResetType };

export type AdminDataResetResult = {
  success: boolean;
  resetType: AdminDataResetType;
  companyId: string;
  projectId: string | null;
  releasedEntries?: number;
  deletedInvoiceItems?: number;
  deletedInvoices?: number;
  unapprovedEntries?: number;
  deletedEntries?: number;
  deletedTasks?: number;
  deletedProjects?: number;
};

export type AdminDataResetPreviewResult = {
  success: boolean;
  dryRun: boolean;
  resetType: AdminDataResetType;
  companyId: string;
  projectId: string | null;
  items: AdminDataResetPreviewItem[];
};

export function adminDataReset(input: {
  resetType: AdminDataResetType;
  companyId: string;
  projectId?: string;
}) {
  return invokeAdminDataReset({
    action: 'dataReset',
    dryRun: false,
    ...input,
  });
}

export function adminDataResetPreview(input: {
  resetType: AdminDataResetType;
  companyId: string;
  projectId?: string;
}) {
  return previewDataReset(input);
}
