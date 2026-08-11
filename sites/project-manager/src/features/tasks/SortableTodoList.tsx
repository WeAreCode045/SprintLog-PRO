import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useLingui } from '@lingui/react/macro';
import { IconGrip } from '../../components/icons';
import type { TaskRow } from '../../appwrite/types';
import { useReorderTasks } from './hooks';

interface SortableTodoListProps {
  companyId: string;
  tasks: TaskRow[];
  canDrag: (task: TaskRow) => boolean;
  renderItem: (task: TaskRow, dragHandle: ReactNode) => ReactNode;
}

function SortableTodoItem({
  task,
  canDrag,
  renderItem,
}: {
  task: TaskRow;
  canDrag: boolean;
  renderItem: (task: TaskRow, dragHandle: ReactNode) => ReactNode;
}) {
  const { t } = useLingui();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.$id,
    disabled: !canDrag,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: transition ?? undefined,
    opacity: isDragging ? 0.45 : 1,
  };

  const dragHandle = canDrag ? (
    <span className="drag-handle" title={t`Sleep om prioriteit te wijzigen`} {...attributes} {...listeners}>
      <IconGrip />
    </span>
  ) : null;

  return (
    <li ref={setNodeRef} style={style} className="todo-item">
      {renderItem(task, dragHandle)}
    </li>
  );
}

export function SortableTodoList({ companyId, tasks, canDrag, renderItem }: SortableTodoListProps) {
  const reorderTasks = useReorderTasks(companyId);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const [orderedIds, setOrderedIds] = useState(() => tasks.map((task) => task.$id));

  const taskById = useMemo(() => new Map(tasks.map((task) => [task.$id, task])), [tasks]);

  useEffect(() => {
    setOrderedIds(tasks.map((task) => task.$id));
  }, [tasks]);

  const orderedTasks = useMemo(
    () => orderedIds.map((id) => taskById.get(id)).filter((task): task is TaskRow => Boolean(task)),
    [orderedIds, taskById],
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = orderedIds.indexOf(String(active.id));
    const newIndex = orderedIds.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    const nextIds = arrayMove(orderedIds, oldIndex, newIndex);
    setOrderedIds(nextIds);
    void reorderTasks.mutateAsync(nextIds.map((taskId, order) => ({ taskId, order })));
  }

  if (orderedTasks.length === 0) return null;

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={orderedIds} strategy={verticalListSortingStrategy}>
        <ul className="todo-list">
          {orderedTasks.map((task) => (
            <SortableTodoItem
              key={task.$id}
              task={task}
              canDrag={canDrag(task)}
              renderItem={renderItem}
            />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}
