import { useMemo } from 'react';
import { useLingui } from '@lingui/react/macro';
import type { InvoiceRow, ResolvedRole } from '../../appwrite/types';
import { isStaffRole } from '../../auth/RequireStaff';
import { formatHours } from '../../lib/formatHours';
import { useInvoices } from '../invoices/hooks';
import { useNotifications } from '../notifications/hooks';
import { useTasksForCompanies } from '../tasks/hooks';
import { entryNeedsApproval, isBillableUninvoicedEntry } from '../timeEntries/timeEntryBilling';
import { useTimeEntriesForCompanies } from '../timeEntries/hooks';
import {
  buildPendingHoursNotification,
  PENDING_HOURS_NOTIFICATION_ID,
} from './dashboardNotificationUtils';
import { useDashboardOverview } from './useDashboardOverview';

function allTimeRange() {
  const end = new Date();
  end.setDate(end.getDate() + 1);
  const start = new Date(end);
  start.setFullYear(start.getFullYear() - 3);
  return { start, end };
}

export function invoiceAmount(invoice: InvoiceRow): number {
  const withVat = invoice.totalWithVat;
  let amount = 0;
  if (withVat != null && Number(withVat) > 0) {
    amount = Number(withVat);
  } else {
    const subtotal = Number(invoice.totalAmount) || 0;
    const vat = Number(invoice.vatAmount) || 0;
    const withVatComputed = Math.round((subtotal + vat) * 100) / 100;
    amount = withVatComputed > 0 ? withVatComputed : subtotal;
  }
  return invoice.creditForInvoiceId ? -Math.abs(amount) : amount;
}

export interface DashboardTimeEntryListItem {
  id: string;
  date: string;
  taskName: string;
  hours: number;
}

export interface DashboardTimeEntryLists {
  pendingApproval: DashboardTimeEntryListItem[];
  pendingInvoice: DashboardTimeEntryListItem[];
}

export interface DashboardFinancialInvoiceItem {
  id: string;
  invoiceNumber: string;
  companyId: string;
  status: InvoiceRow['status'];
  totalAmount: number;
  currency: string;
}

export interface DashboardFinancialStats {
  recentInvoices: DashboardFinancialInvoiceItem[];
  totalOutstanding: number;
  totalInvoiced: number;
  currency: string;
}

export function useDashboardPageData(enabledCompanyIds: string[], role: ResolvedRole, userId: string) {
  const { t } = useLingui();
  const overview = useDashboardOverview(enabledCompanyIds, role);
  const { data: allTasks = [], isLoading: tasksLoading } = useTasksForCompanies(
    enabledCompanyIds,
    'all',
  );
  const allTime = useMemo(allTimeRange, []);
  const { data: allEntries = [], isLoading: entriesLoading } = useTimeEntriesForCompanies(
    enabledCompanyIds,
    allTime,
  );
  const { data: allInvoices = [], isLoading: invoicesLoading } = useInvoices();
  const { data: notifications = [] } = useNotifications(userId);

  const companyIdSet = useMemo(() => new Set(enabledCompanyIds), [enabledCompanyIds]);

  const scopedInvoices = useMemo(
    () => allInvoices.filter((invoice) => companyIdSet.has(invoice.companyId)),
    [allInvoices, companyIdSet],
  );

  const taskById = useMemo(() => new Map(allTasks.map((task) => [task.$id, task])), [allTasks]);

  const timeEntryLists = useMemo((): DashboardTimeEntryLists => {
    const scoped = allEntries.filter((entry) => companyIdSet.has(entry.companyId));

    const pendingApproval = scoped
      .filter((entry) => entryNeedsApproval(entry))
      .filter((entry) => (taskById.get(entry.taskId)?.audience ?? 'internal') !== 'client')
      .sort((left, right) => right.$createdAt.localeCompare(left.$createdAt))
      .map((entry) => ({
        id: entry.$id,
        date: entry.$createdAt,
        taskName: taskById.get(entry.taskId)?.title ?? entry.taskId,
        hours: entry.hours ?? 0,
      }));

    const pendingInvoice = scoped
      .filter((entry) => isBillableUninvoicedEntry(entry))
      .sort((left, right) => right.$updatedAt.localeCompare(left.$updatedAt))
      .map((entry) => ({
        id: entry.$id,
        date: entry.$updatedAt,
        taskName: taskById.get(entry.taskId)?.title ?? entry.taskId,
        hours: entry.hours ?? 0,
      }));

    return { pendingApproval, pendingInvoice };
  }, [allEntries, companyIdSet, taskById]);

  const financialStats = useMemo((): DashboardFinancialStats => {
    const visibleInvoices =
      role === 'client' ? scopedInvoices.filter((invoice) => invoice.status !== 'draft') : scopedInvoices;
    const nonVoid = visibleInvoices.filter(
      (invoice) => invoice.status !== 'void' || Boolean(invoice.creditedByInvoiceId),
    );
    const sent = nonVoid.filter(
      (invoice) => invoice.status === 'sent' || Boolean(invoice.creditedByInvoiceId),
    );
    const drafts = nonVoid.filter((invoice) => invoice.status === 'draft');

    const recentInvoices = [...visibleInvoices]
      .sort((left, right) => {
        const leftDate = left.issueDate ?? left.$createdAt;
        const rightDate = right.issueDate ?? right.$createdAt;
        return rightDate.localeCompare(leftDate);
      })
      .map((invoice) => ({
        id: invoice.$id,
        invoiceNumber: invoice.invoiceNumber ?? invoice.$id,
        companyId: invoice.companyId,
        status: invoice.status,
        totalAmount: invoiceAmount(invoice),
        currency: invoice.currency,
      }))
      .slice(0, 5);

    const sentTotal = sent.reduce((sum, invoice) => sum + invoiceAmount(invoice), 0);
    const draftTotal = drafts.reduce((sum, invoice) => sum + invoiceAmount(invoice), 0);

    return {
      recentInvoices,
      totalOutstanding: role === 'client' ? sentTotal : sentTotal + draftTotal,
      totalInvoiced: sentTotal,
      currency: sent[0]?.currency ?? drafts[0]?.currency ?? visibleInvoices[0]?.currency ?? 'EUR',
    };
  }, [scopedInvoices, role]);

  const pendingHoursLatestAt = useMemo(() => {
    if (role !== 'client') return new Date().toISOString();
    let latest = '';
    for (const entry of allEntries) {
      if (!companyIdSet.has(entry.companyId)) continue;
      if (entry.approved) continue;
      if (entry.freeOfCharge) continue;
      if ((taskById.get(entry.taskId)?.audience ?? 'internal') === 'client') continue;
      const candidate = entry.workedDate ?? entry.$createdAt;
      if (candidate > latest) latest = candidate;
    }
    return latest || new Date().toISOString();
  }, [allEntries, companyIdSet, taskById, role]);

  const pendingHoursNotification = useMemo(() => {
    if (role !== 'client' || overview.hoursToApprove <= 0) return null;
    const body =
      overview.hoursToApproveByCompany.size > 1
        ? t`Je hebt uren die goedkeuring nodig hebben (${formatHours(overview.hoursToApprove)} totaal).`
        : t`Je hebt ${formatHours(overview.hoursToApprove)} uren die goedkeuring nodig hebben.`;
    const companyId =
      [...overview.hoursToApproveByCompany.keys()][0] ?? enabledCompanyIds[0] ?? '';
    return buildPendingHoursNotification(companyId, body, pendingHoursLatestAt);
  }, [
    role,
    overview.hoursToApprove,
    overview.hoursToApproveByCompany,
    enabledCompanyIds,
    pendingHoursLatestAt,
    t,
  ]);

  const recentNotifications = useMemo(() => {
    const unread = notifications
      .filter(
        (notification) =>
          companyIdSet.has(notification.companyId) &&
          !notification.readAt &&
          notification.$id !== PENDING_HOURS_NOTIFICATION_ID,
      )
      .slice()
      .sort((left, right) => right.$createdAt.localeCompare(left.$createdAt));
    if (pendingHoursNotification) {
      return [pendingHoursNotification, ...unread];
    }
    return unread;
  }, [notifications, companyIdSet, pendingHoursNotification]);

  const staff = isStaffRole(role);
  const loading = overview.loading || tasksLoading || entriesLoading || invoicesLoading;

  return {
    loading,
    staff,
    overview,
    timeEntryLists,
    financialStats,
    recentNotifications,
    allTasks,
    allEntries,
    scopedInvoices,
    enabledCompanyIds,
    companyIdSet,
  };
}

export type DashboardPageData = ReturnType<typeof useDashboardPageData>;
