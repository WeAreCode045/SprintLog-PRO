import { Fragment, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Trans, useLingui } from '@lingui/react/macro';
import { t as staticT } from '@lingui/core/macro';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useQueries } from '@tanstack/react-query';
import {
  MAX_TASK_NEST_DEPTH,
  TASK_TYPE_LABELS,
  type ResolvedRole,
  type TaskRow,
  type TaskStatus,
  type TaskType,
} from '../../appwrite/types';
import { isStaffRole } from '../../auth/RequireStaff';
import {
  IconCheck,
  IconChevronDown,
  IconChevronRight,
  IconClock,
  IconGrip,
  IconLockOpen,
  IconPlus,
} from '../../components/icons';
import { queryKeys } from '../../lib/queryKeys';
import { listAssignmentsByProject } from '../assignments/api';
import { useDeveloperProfiles } from '../profiles/hooks';
import { TaskHoursDialog } from '../timeEntries/TaskHoursDialog';
import { effectiveTaskAssigneeIds, taskNestDepth } from './api';
import { useReorderTasks } from './hooks';
import { formatHours } from '../../lib/formatHours';

const STATUS_RANK: Record<TaskStatus, number> = {
  requested: 0,
  open: 1,
  finished: 2,
  archived: 3,
};

const ROOT_PARENT_KEY = '__root__';

type SortKey = 'order' | 'title' | 'type' | 'status' | 'developer' | 'hours' | 'project' | 'company';
type SortDir = 'asc' | 'desc';

function statusLabel(status: TaskRow['status']) {
  switch (status) {
    case 'requested':
      return staticT`Aangevraagd`;
    case 'open':
      return staticT`Open`;
    case 'finished':
      return staticT`Afgerond`;
    case 'archived':
      return staticT`Gearchiveerd`;
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

function byOrder(a: TaskRow, b: TaskRow) {
  const ao = a.order ?? Number.MAX_SAFE_INTEGER;
  const bo = b.order ?? Number.MAX_SAFE_INTEGER;
  if (ao !== bo) return ao - bo;
  return a.$createdAt.localeCompare(b.$createdAt);
}

function parentKeyOf(task: TaskRow, taskIds: Set<string>) {
  const parentId = task.parentTaskId;
  if (parentId && taskIds.has(parentId)) return parentId;
  return ROOT_PARENT_KEY;
}

function PaginationDroppableBtn({
  id,
  disabled,
  onClick,
  children,
}: {
  id: string;
  disabled: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id,
    disabled,
  });

  return (
    <button
      ref={setNodeRef}
      type="button"
      className={`data-table-pagination-btn ${isOver ? 'data-table-pagination-btn--drop-target' : ''}`}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function assigneeSortKey(
  assigneeIds: string[],
  developerById: Map<string, { displayName: string }>,
) {
  if (assigneeIds.length === 0) return '';
  return assigneeIds
    .map((id) => developerById.get(id)?.displayName ?? id)
    .sort((a, b) => a.localeCompare(b, 'nl'))
    .join(', ');
}

function compareTasks(
  a: TaskRow,
  b: TaskRow,
  sortKey: SortKey,
  sortDir: SortDir,
  developerById: Map<string, { displayName: string }>,
  projectAssigneesByProjectId: Map<string, string[]>,
  projectName?: (projectId: string) => string,
  companyName?: (companyId: string) => string,
) {
  let cmp = 0;
  switch (sortKey) {
    case 'title':
      cmp = a.title.localeCompare(b.title, 'nl');
      break;
    case 'type':
      cmp = (a.taskType ?? 'development').localeCompare(b.taskType ?? 'development');
      break;
    case 'status':
      cmp = STATUS_RANK[a.status] - STATUS_RANK[b.status];
      break;
    case 'developer':
      cmp = assigneeSortKey(
        effectiveTaskAssigneeIds(a, projectAssigneesByProjectId),
        developerById,
      ).localeCompare(
        assigneeSortKey(effectiveTaskAssigneeIds(b, projectAssigneesByProjectId), developerById),
        'nl',
      );
      break;
    case 'hours':
      cmp = (a.hours ?? 0) - (b.hours ?? 0);
      break;
    case 'project':
      cmp = (projectName?.(a.projectId) ?? a.projectId).localeCompare(
        projectName?.(b.projectId) ?? b.projectId,
        'nl',
      );
      break;
    case 'company':
      cmp = (companyName?.(a.companyId) ?? a.companyId).localeCompare(
        companyName?.(b.companyId) ?? b.companyId,
        'nl',
      );
      break;
    case 'order':
      return byOrder(a, b);
    default: {
      const _exhaustive: never = sortKey;
      return _exhaustive;
    }
  }
  if (cmp === 0) return byOrder(a, b);
  return sortDir === 'asc' ? cmp : -cmp;
}

function withAncestors(matching: TaskRow[], allTasks: TaskRow[]): TaskRow[] {
  const byId = new Map(allTasks.map((task) => [task.$id, task]));
  const included = new Map<string, TaskRow>();
  for (const task of matching) {
    let current: TaskRow | undefined = task;
    const seen = new Set<string>();
    while (current && !seen.has(current.$id)) {
      seen.add(current.$id);
      included.set(current.$id, current);
      current = current.parentTaskId ? byId.get(current.parentTaskId) : undefined;
    }
  }
  return [...included.values()];
}

/** Build sibling order maps and a depth-first flat list for rendering. */
function buildTaskTree(
  tasks: TaskRow[],
  sortKey: SortKey,
  sortDir: SortDir,
  developerById: Map<string, { displayName: string }>,
  projectAssigneesByProjectId: Map<string, string[]>,
  projectName?: (projectId: string) => string,
  companyName?: (companyId: string) => string,
) {
  const taskIds = new Set(tasks.map((task) => task.$id));
  const byId = new Map(tasks.map((task) => [task.$id, task]));
  const orderByParent: Record<string, string[]> = { [ROOT_PARENT_KEY]: [] };

  for (const task of tasks) {
    const key = parentKeyOf(task, taskIds);
    if (!orderByParent[key]) orderByParent[key] = [];
    orderByParent[key].push(task.$id);
  }

  for (const siblingIds of Object.values(orderByParent)) {
    siblingIds.sort((a, b) =>
      compareTasks(
        byId.get(a)!,
        byId.get(b)!,
        sortKey,
        sortDir,
        developerById,
        projectAssigneesByProjectId,
        projectName,
        companyName,
      ),
    );
  }

  const flat: TaskRow[] = [];
  function walk(parentKey: string) {
    for (const id of orderByParent[parentKey] ?? []) {
      const task = byId.get(id);
      if (!task) continue;
      flat.push(task);
      walk(id);
    }
  }
  walk(ROOT_PARENT_KEY);

  return { byId, orderByParent, flat };
}

function ordersEqual(a: Record<string, string[]>, b: Record<string, string[]>) {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  for (const key of aKeys) {
    const aList = a[key] ?? [];
    const bList = b[key] ?? [];
    if (aList.length !== bList.length) return false;
    for (let index = 0; index < aList.length; index += 1) {
      if (aList[index] !== bList[index]) return false;
    }
  }
  return true;
}

function SortableHeader({
  label,
  column,
  sortKey,
  sortDir,
  onSort,
  className,
}: {
  label: string;
  column: Exclude<SortKey, 'order'>;
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (column: Exclude<SortKey, 'order'>) => void;
  className?: string;
}) {
  const active = sortKey === column;
  return (
    <th className={className}>
      <button
        type="button"
        className={`data-table-sort ${active ? 'data-table-sort--active' : ''}`}
        onClick={() => onSort(column)}
      >
        <span>{label}</span>
        <span className="data-table-sort-indicator" aria-hidden>
          {active ? (sortDir === 'asc' ? '↑' : '↓') : ''}
        </span>
      </button>
    </th>
  );
}

export interface DeveloperTasksTableProps {
  companyId: string;
  teamId: string;
  userId: string;
  role: ResolvedRole;
  tasks: TaskRow[];
  projectName?: (projectId: string) => string;
  showProjectColumn?: boolean;
  companyName?: (companyId: string) => string;
  showCompanyColumn?: boolean;
  canFinish: (task: TaskRow) => boolean;
  canAccept: (task: TaskRow) => boolean;
  canEdit: (task: TaskRow) => boolean;
  canAddSubtask?: (task: TaskRow) => boolean;
  onFinish: (task: TaskRow) => void;
  onReopen: (task: TaskRow) => void;
  onAccept: (task: TaskRow) => void;
  onView: (task: TaskRow) => void;
  onAddSubtask?: (task: TaskRow) => void;
  hideActions?: boolean;
  companion?: ReactNode;
  statusFilter?: TaskStatus | 'all';
  typeFilter?: TaskType | 'all';
  companyFilter?: string;
  excludedStatuses?: Set<TaskStatus>;
  excludedTypes?: Set<TaskType>;
  excludedCompanyIds?: Set<string>;
}

function isSubtaskVisible(
  task: TaskRow,
  taskById: Map<string, TaskRow>,
  collapsedSubtaskIds: Set<string>,
) {
  let current: TaskRow | undefined = task;
  const seen = new Set<string>();
  while (current?.parentTaskId && !seen.has(current.$id)) {
    seen.add(current.$id);
    if (collapsedSubtaskIds.has(current.parentTaskId)) return false;
    current = taskById.get(current.parentTaskId);
  }
  return true;
}

interface SortableTaskRowProps {
  task: TaskRow;
  parentKey: string;
  depth: number;
  canDrag: boolean;
  showProjectColumn: boolean;
  projectName?: (projectId: string) => string;
  showCompanyColumn: boolean;
  companyName?: (companyId: string) => string;
  hasChildren: boolean;
  childCount: number;
  subtasksExpanded: boolean;
  onToggleSubtasks: () => void;
  onView: () => void;
  assigneeLabel: string;
  canFinish: boolean;
  canAccept: boolean;
  showAddSub: boolean;
  canLogHours: boolean;
  canReopen: boolean;
  onFinish: () => void;
  onReopen: () => void;
  onAccept: () => void;
  onAddSubtask?: () => void;
  onLogHours: () => void;
  hideActions?: boolean;
}

function SortableTaskRow({
  task,
  parentKey,
  depth,
  canDrag,
  showProjectColumn,
  projectName,
  showCompanyColumn,
  companyName,
  hasChildren,
  childCount,
  subtasksExpanded,
  onToggleSubtasks,
  onView,
  assigneeLabel,
  canFinish,
  canAccept,
  showAddSub,
  canLogHours,
  canReopen,
  onFinish,
  onReopen,
  onAccept,
  onAddSubtask,
  onLogHours,
  hideActions = false,
}: SortableTaskRowProps) {
  const { t } = useLingui();
  const taskType = (task.taskType ?? 'development') as TaskType;
  const hoursClosed = task.status === 'finished';

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.$id,
    data: { type: 'task', parentKey },
    disabled: !canDrag,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: transition ?? undefined,
    opacity: isDragging ? 0.35 : 1,
  };

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={`${hoursClosed ? 'data-table-row--closed' : ''} ${isDragging ? 'data-table-row--dragging' : ''}`}
    >
      <td>
        <div
          className="data-table-title-cell"
          style={{ paddingLeft: depth > 0 ? `${depth * 1.1}rem` : undefined }}
        >
          {canDrag ? (
            <span className="drag-handle data-table-drag-handle" title={t`Sleep om prioriteit te wijzigen`} {...attributes} {...listeners}>
              <IconGrip />
            </span>
          ) : (
            <span className="data-table-drag-spacer" aria-hidden />
          )}
          {hasChildren ? (
            <button
              type="button"
              className="data-table-toggle"
              title={subtasksExpanded ? t`Verberg subtaken` : t`Toon subtaken`}
              onClick={onToggleSubtasks}
            >
              {subtasksExpanded ? <IconChevronDown /> : <IconChevronRight />}
            </button>
          ) : (
            <span className="data-table-toggle-spacer" aria-hidden />
          )}
          <div className="data-table-title-row">
            <button type="button" className="data-table-title-button" onClick={onView}>
              {task.parentTaskId ? <span className="badge badge-subtask">{t`Sub`}</span> : null} {task.title}
            </button>
            {hasChildren && !subtasksExpanded && (
              <button
                type="button"
                className="data-table-subtask-count"
                onClick={onToggleSubtasks}
              >
                {childCount} {childCount === 1 ? t`subtaak` : t`subtaken`}
              </button>
            )}
          </div>
        </div>
      </td>
      {showCompanyColumn && (
        <td className="data-table-muted">
          <Link to={`/app/projects/${task.projectId}`}>{companyName?.(task.companyId) ?? '—'}</Link>
        </td>
      )}
      {showProjectColumn && (
        <td className="data-table-muted">
          <Link to={`/app/projects/${task.projectId}`}>{projectName?.(task.projectId) ?? '—'}</Link>
        </td>
      )}
      <td>
        <span className="badge">{TASK_TYPE_LABELS[taskType]}</span>
      </td>
      <td>
        <span className={`badge badge-status badge-status--${task.status}`}>{statusLabel(task.status)}</span>
      </td>
      <td>{assigneeLabel}</td>
      <td className={`data-table-num ${hoursClosed ? 'data-table-hours--total' : ''}`}>
        <Link to="/app/reports" title={t`Urenregistratie / rapportages`}>
          {formatHours(task.hours)}
        </Link>
        {!hideActions && (
          <div className="data-table-actions">
            {canAccept && (
              <button type="button" className="btn-link" onClick={onAccept}>
                <Trans>Accepteren</Trans>
              </button>
            )}
            {canLogHours && (
              <button type="button" className="icon-button" title={t`Uren`} onClick={onLogHours}>
                <IconClock />
              </button>
            )}
            {canFinish && (
              <button type="button" className="icon-button" title={t`Afronden`} onClick={onFinish}>
                <IconCheck />
              </button>
            )}
            {canReopen && (
              <button type="button" className="icon-button" title={t`Heropenen`} onClick={onReopen}>
                <IconLockOpen />
              </button>
            )}
            {showAddSub && (
              <button
                type="button"
                className="icon-button icon-button--accent"
                title={t`Subtaak toevoegen`}
                onClick={onAddSubtask}
              >
                <IconPlus />
              </button>
            )}
          </div>
        )}
      </td>
    </tr>
  );
}

export function flattenTasksForTable(tasks: TaskRow[]): TaskRow[] {
  return buildTaskTree(tasks, 'order', 'asc', new Map(), new Map()).flat;
}

export function DeveloperTasksTable({
  companyId,
  teamId,
  userId,
  role,
  tasks,
  projectName,
  showProjectColumn = false,
  companyName,
  showCompanyColumn = false,
  canFinish,
  canAccept,
  canEdit,
  canAddSubtask,
  onFinish,
  onReopen,
  onAccept,
  onView,
  onAddSubtask,
  hideActions = false,
  companion,
  statusFilter: propStatusFilter,
  typeFilter: propTypeFilter,
  companyFilter: propCompanyFilter,
  excludedStatuses,
  excludedTypes,
  excludedCompanyIds,
}: DeveloperTasksTableProps) {
  const { t } = useLingui();
  const { data: developers = [] } = useDeveloperProfiles(true);
  const reorderTasksMutation = useReorderTasks(companyId);
  const [collapsedSubtaskIds, setCollapsedSubtaskIds] = useState<Set<string>>(new Set());
  const [loggingTask, setLoggingTask] = useState<TaskRow | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [orderByParent, setOrderByParent] = useState<Record<string, string[]>>({
    [ROOT_PARENT_KEY]: [],
  });

  const [internalStatusFilter] = useState<TaskStatus | 'all'>('open');
  const [internalTypeFilter] = useState<TaskType | 'all'>('all');
  const [internalCompanyFilter] = useState<string>('all');

  const statusFilter = propStatusFilter ?? (excludedStatuses ? 'all' : internalStatusFilter);
  const typeFilter = propTypeFilter ?? internalTypeFilter;
  const companyFilter = propCompanyFilter ?? internalCompanyFilter;

  const PAGE_SIZE = 8;
  const [currentPage, setCurrentPage] = useState(1);
  const [sortKey, setSortKey] = useState<SortKey>('order');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const staff = isStaffRole(role);

  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, typeFilter, companyFilter, excludedStatuses, excludedTypes, excludedCompanyIds, sortKey, sortDir]);

  const developerById = useMemo(
    () => new Map(developers.map((profile) => [profile.userId, profile])),
    [developers],
  );

  const projectIds = useMemo(
    () => [...new Set(tasks.map((task) => task.projectId))],
    [tasks],
  );

  const assignmentQueries = useQueries({
    queries: projectIds.map((projectId) => ({
      queryKey: queryKeys.assignmentsByProject(projectId),
      queryFn: () => listAssignmentsByProject(projectId),
      enabled: Boolean(projectId),
    })),
  });

  const projectAssigneeSignature = assignmentQueries
    .map((query) => (query.data ?? []).map((row) => row.userId).join(','))
    .join('|');

  const projectAssigneesByProjectId = useMemo(() => {
    const map = new Map<string, string[]>();
    const perProject = projectAssigneeSignature.split('|');
    projectIds.forEach((projectId, index) => {
      const ids = (perProject[index] ?? '').split(',').filter(Boolean);
      map.set(projectId, [...new Set(ids)]);
    });
    return map;
  }, [projectIds, projectAssigneeSignature]);

  const matchingTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (excludedStatuses?.has(task.status as TaskStatus)) return false;
      if (statusFilter !== 'all' && task.status !== statusFilter) return false;

      if (excludedTypes?.has((task.taskType ?? 'development') as TaskType)) return false;
      if (typeFilter !== 'all' && (task.taskType ?? 'development') !== typeFilter) return false;

      if (excludedCompanyIds?.has(task.companyId)) return false;
      if (companyFilter !== 'all' && task.companyId !== companyFilter) return false;

      return true;
    });
  }, [tasks, excludedStatuses, statusFilter, excludedTypes, typeFilter, excludedCompanyIds, companyFilter]);

  const scopedTasks = useMemo(
    () => withAncestors(matchingTasks, tasks),
    [matchingTasks, tasks],
  );

  const filtersActive =
    (excludedTypes && excludedTypes.size > 0) ||
    typeFilter !== 'all' ||
    (excludedCompanyIds && excludedCompanyIds.size > 0) ||
    companyFilter !== 'all';

  const dragEnabled = sortKey === 'order' && !filtersActive;

  const treeFromProps = useMemo(
    () =>
      buildTaskTree(
        scopedTasks,
        sortKey,
        sortDir,
        developerById,
        projectAssigneesByProjectId,
        projectName,
        companyName,
      ),
    [
      scopedTasks,
      sortKey,
      sortDir,
      developerById,
      projectAssigneesByProjectId,
      projectName,
      companyName,
    ],
  );
  const taskById = treeFromProps.byId;

  useEffect(() => {
    setOrderByParent((prev) =>
      ordersEqual(prev, treeFromProps.orderByParent) ? prev : treeFromProps.orderByParent,
    );
  }, [treeFromProps.orderByParent]);

  const orderedTasks = useMemo(() => {
    const flat: TaskRow[] = [];
    function walk(parentKey: string) {
      for (const id of orderByParent[parentKey] ?? []) {
        const task = taskById.get(id);
        if (!task) continue;
        flat.push(task);
        walk(id);
      }
    }
    walk(ROOT_PARENT_KEY);
    return flat;
  }, [orderByParent, taskById]);

  const visibleOrderedTasks = useMemo(
    () => orderedTasks.filter((task) => isSubtaskVisible(task, taskById, collapsedSubtaskIds)),
    [orderedTasks, taskById, collapsedSubtaskIds],
  );

  const totalTasks = visibleOrderedTasks.length;
  const totalPages = Math.ceil(totalTasks / PAGE_SIZE) || 1;
  const safePage = Math.min(Math.max(1, currentPage), totalPages);
  const startItem = totalTasks === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const endItem = Math.min(safePage * PAGE_SIZE, totalTasks);

  const paginatedTasks = useMemo(
    () => visibleOrderedTasks.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [visibleOrderedTasks, safePage],
  );

  const sortableIds = useMemo(
    () => paginatedTasks.map((task) => task.$id),
    [paginatedTasks],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
  );

  const activeTask = activeId ? taskById.get(activeId) ?? null : null;

  function canLogHours(task: TaskRow) {
    if ((task.audience ?? 'internal') !== 'internal') return false;
    if (task.status !== 'open') return false;
    if (staff) return true;
    return false;
  }

  function canDrag(task: TaskRow) {
    if (!dragEnabled || task.status === 'finished' || task.status === 'archived') return false;
    // Clients may reorder open/requested tasks for priority (including developer tasks).
    if (role === 'client') {
      return task.status === 'open' || task.status === 'requested';
    }
    return canEdit(task);
  }

  function toggleSubtasks(taskId: string) {
    setCollapsedSubtaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  }

  function assigneeNames(task: TaskRow) {
    const ids = effectiveTaskAssigneeIds(task, projectAssigneesByProjectId);
    if (ids.length === 0) return '—';
    return ids.map((id) => developerById.get(id)?.displayName ?? id).join(', ');
  }

  function handleSort(column: Exclude<SortKey, 'order'>) {
    if (sortKey !== column) {
      setSortKey(column);
      setSortDir(column === 'hours' ? 'desc' : 'asc');
      return;
    }
    if (sortDir === 'asc') {
      setSortDir('desc');
      return;
    }
    setSortKey('order');
    setSortDir('asc');
  }

  function handleDragStart(event: DragStartEvent) {
    if (!dragEnabled) return;
    setActiveId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    if (!dragEnabled) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const taskIds = new Set(taskById.keys());
    const activeTaskRow = taskById.get(String(active.id));
    if (!activeTaskRow) return;

    const activeParentKey = String(
      active.data.current?.parentKey ?? parentKeyOf(activeTaskRow, taskIds),
    );
    const siblings = orderByParent[activeParentKey] ?? [];
    const oldIndex = siblings.indexOf(String(active.id));
    if (oldIndex < 0) return;

    if (over.id === 'pagination-prev') {
      if (safePage <= 1) return;
      const currentPaginatedSet = new Set(paginatedTasks.map((t) => t.$id));
      const firstCurrentIndex = siblings.findIndex((id) => currentPaginatedSet.has(id));
      const targetIndex = firstCurrentIndex >= 0 ? firstCurrentIndex : 0;
      const newIndex = Math.max(0, targetIndex - 1);

      if (oldIndex !== newIndex) {
        const reordered = arrayMove(siblings, oldIndex, newIndex);
        setOrderByParent((prev) => ({ ...prev, [activeParentKey]: reordered }));
        void reorderTasksMutation.mutateAsync(
          reordered.map((taskId, order) => ({ taskId, order })),
        );
      }
      setCurrentPage((p) => Math.max(1, p - 1));
      return;
    }

    if (over.id === 'pagination-next') {
      if (safePage >= totalPages) return;
      const currentPaginatedSet = new Set(paginatedTasks.map((t) => t.$id));
      let lastCurrentIndex = -1;
      for (let i = siblings.length - 1; i >= 0; i--) {
        if (currentPaginatedSet.has(siblings[i])) {
          lastCurrentIndex = i;
          break;
        }
      }
      const targetIndex = lastCurrentIndex >= 0 ? lastCurrentIndex : siblings.length - 1;
      const newIndex = oldIndex <= targetIndex ? targetIndex : targetIndex + 1;

      if (oldIndex !== newIndex) {
        const reordered = arrayMove(siblings, oldIndex, newIndex);
        setOrderByParent((prev) => ({ ...prev, [activeParentKey]: reordered }));
        void reorderTasksMutation.mutateAsync(
          reordered.map((taskId, order) => ({ taskId, order })),
        );
      }
      setCurrentPage((p) => Math.min(totalPages, p + 1));
      return;
    }

    const overTaskRow = taskById.get(String(over.id));
    if (!overTaskRow) return;

    const overParentKey = String(
      over.data.current?.parentKey ?? parentKeyOf(overTaskRow, taskIds),
    );
    if (activeParentKey !== overParentKey) return;

    const newIndex = siblings.indexOf(String(over.id));
    if (newIndex < 0 || oldIndex === newIndex) return;

    const reordered = arrayMove(siblings, oldIndex, newIndex);
    setOrderByParent((prev) => ({ ...prev, [activeParentKey]: reordered }));
    void reorderTasksMutation.mutateAsync(
      reordered.map((taskId, order) => ({ taskId, order })),
    );
  }

  function handleDragCancel() {
    setActiveId(null);
  }

  if (tasks.length === 0) {
    const emptyState = <p className="empty-state"><Trans>Geen projecttaken in deze weergave.</Trans></p>;
    if (!companion) return emptyState;
    return (
      <>
        {emptyState}
        {companion}
      </>
    );
  }

  const tableBody =
    visibleOrderedTasks.length === 0 ? (
      <p className="empty-state"><Trans>Geen taken voor deze filters.</Trans></p>
    ) : (
      <div className="data-table-wrap">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          <table className="data-table">
            <thead>
              <tr>
                <SortableHeader
                  label={t`Titel`}
                  column="title"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={handleSort}
                  className="data-table-col-wide"
                />
                {showCompanyColumn && (
                  <SortableHeader
                    label={t`Bedrijf`}
                    column="company"
                    sortKey={sortKey}
                    sortDir={sortDir}
                    onSort={handleSort}
                  />
                )}
                {showProjectColumn && (
                  <SortableHeader
                    label={t`Project`}
                    column="project"
                    sortKey={sortKey}
                    sortDir={sortDir}
                    onSort={handleSort}
                    className="data-table-col-project"
                  />
                )}
                <SortableHeader
                  label={t`Type`}
                  column="type"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={handleSort}
                  className="data-table-col-type"
                />
                <SortableHeader
                  label={t`Status`}
                  column="status"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={handleSort}
                  className="data-table-col-status"
                />
                <SortableHeader
                  label={t`Developer`}
                  column="developer"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={handleSort}
                  className="data-table-col-developer"
                />
                <SortableHeader
                  label={t`Uren`}
                  column="hours"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={handleSort}
                  className="data-table-num"
                />
              </tr>
            </thead>
            <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
              <tbody>
                {paginatedTasks.map((task) => {
                  const taskIds = new Set(taskById.keys());
                  const parentKey = parentKeyOf(task, taskIds);
                  const depth = taskNestDepth(task, taskById);
                  const childIds = orderByParent[task.$id] ?? [];
                  const showAddSub =
                    Boolean(canAddSubtask?.(task) && onAddSubtask) &&
                    depth < MAX_TASK_NEST_DEPTH - 1;
                  const draggable = canDrag(task);

                  return (
                    <Fragment key={task.$id}>
                      <SortableTaskRow
                        task={task}
                        parentKey={parentKey}
                        depth={depth}
                        canDrag={draggable}
                        showProjectColumn={showProjectColumn}
                        projectName={projectName}
                        showCompanyColumn={showCompanyColumn}
                        companyName={companyName}
                        hasChildren={childIds.length > 0}
                        childCount={childIds.length}
                        subtasksExpanded={!collapsedSubtaskIds.has(task.$id)}
                        onToggleSubtasks={() => toggleSubtasks(task.$id)}
                        onView={() => onView(task)}
                        assigneeLabel={assigneeNames(task)}
                        canFinish={canFinish(task)}
                        canAccept={canAccept(task)}
                        showAddSub={showAddSub}
                        canLogHours={canLogHours(task)}
                        canReopen={task.status === 'finished' && staff}
                        onFinish={() => onFinish(task)}
                        onReopen={() => onReopen(task)}
                        onAccept={() => onAccept(task)}
                        onAddSubtask={showAddSub ? () => onAddSubtask?.(task) : undefined}
                        onLogHours={() => setLoggingTask(task)}
                        hideActions={hideActions}
                      />
                    </Fragment>
                  );
                })}
              </tbody>
            </SortableContext>
          </table>
          <DragOverlay>
            {activeTask ? (
              <div className="data-table-drag-overlay">
                {activeTask.parentTaskId ? <span className="badge badge-subtask">{t`Sub`}</span> : null}{' '}
                {activeTask.title}
              </div>
            ) : null}
          </DragOverlay>
          {totalPages > 1 && (
            <div className="data-table-pagination">
              <span className="data-table-pagination-info">
                <Trans>
                  Tonen {startItem}–{endItem} van {totalTasks} taken
                </Trans>
              </span>
              <div className="data-table-pagination-controls">
                <PaginationDroppableBtn
                  id="pagination-prev"
                  disabled={safePage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                >
                  <Trans>Vorige</Trans>
                </PaginationDroppableBtn>
                <span className="data-table-pagination-page">
                  {safePage} / {totalPages}
                </span>
                <PaginationDroppableBtn
                  id="pagination-next"
                  disabled={safePage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                >
                  <Trans>Volgende</Trans>
                </PaginationDroppableBtn>
              </div>
            </div>
          )}
        </DndContext>
      </div>
    );

  return (
    <>
      {!dragEnabled && (
        <p className="data-table-hint">
          <Trans>
            Extra filters of kolomsortering actief — sleepvolgorde is tijdelijk uitgeschakeld. Zet
            filters op Alle en/of klik opnieuw op de actieve kolomtitel voor handmatige volgorde.
          </Trans>
        </p>
      )}

      {companion ? (
        <div className="developer-tasks-with-companion">
          <div className="developer-tasks-with-companion-main">{tableBody}</div>
          {companion}
        </div>
      ) : (
        tableBody
      )}
      {!hideActions && loggingTask && (
        <TaskHoursDialog
          companyId={companyId}
          teamId={teamId}
          task={loggingTask}
          userId={userId}
          role={role}
          onClose={() => setLoggingTask(null)}
        />
      )}
    </>
  );
}
