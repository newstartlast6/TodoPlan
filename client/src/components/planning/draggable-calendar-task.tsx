import React from 'react';
import { Task } from '@shared/schema';
import { useDrag } from 'react-dnd';
import { DND_TYPES, type DragTaskItem } from '@/lib/dnd';

function dateOnlyISO(d: Date) {
  const year = d.getFullYear();
  const month = d.getMonth();
  const day = d.getDate();
  const local = new Date(year, month, day, 0, 0, 0, 0);
  return local.toISOString();
}

export function DraggableCalendarTask({ task, children }: { task: Task; children: React.ReactNode }) {
  const from = task.scheduledDate ? new Date(task.scheduledDate) : new Date(task.startTime);
  const [, dragRef] = useDrag<DragTaskItem>(() => ({
    type: DND_TYPES.TASK,
    item: {
      type: DND_TYPES.TASK,
      taskId: task.id,
      source: 'calendar',
      fromDate: dateOnlyISO(from),
    },
  }), [task.id, task.scheduledDate, task.startTime]);

  return <div ref={dragRef}>{children}</div>;
}


