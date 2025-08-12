export const DND_TYPES = {
  TASK: 'TASK',
} as const;

export type DndType = typeof DND_TYPES[keyof typeof DND_TYPES];

export interface DragTaskItem {
  type: typeof DND_TYPES.TASK;
  taskId: string;
  source: 'plan-panel' | 'calendar';
  fromDate?: string; // ISO string for date-only context when dragging from calendar
}


