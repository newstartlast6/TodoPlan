import React, { useMemo, useState } from 'react';
import { useLists } from '@/hooks/use-lists';
import { useQuery } from '@tanstack/react-query';
import { Task } from '@shared/schema';
import { SelectableTodoItem } from '@/components/calendar/selectable-todo-item';
import { useUpdateTask } from '@/hooks/use-list-tasks';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { DND_TYPES, type DragTaskItem } from '@/lib/dnd';
import { useDrag, useDrop } from 'react-dnd';

interface PlanPanelProps {
  className?: string;
  variant?: 'inline' | 'floating';
}

export function PlanPanel({ className, variant = 'inline' }: PlanPanelProps) {
  const { data: lists = [] } = useLists();
  const { data: tasks = [] } = useQuery<Task[]>({
    queryKey: ['/api/tasks', 'plan-panel', 'includeUnscheduled'],
    queryFn: async () => {
      const res = await fetch('/api/tasks?includeUnscheduled=true');
      if (!res.ok) throw new Error('Failed to fetch tasks');
      return res.json();
    },
    staleTime: 60_000,
  });

  const updateTaskMutation = useUpdateTask();
  const { toast } = useToast();

  const [query, setQuery] = useState('');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const filteredTasks = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return tasks;
    return tasks.filter(t => (t.title || '').toLowerCase().includes(q));
  }, [tasks, query]);

  const tasksByList = useMemo(() => {
    const map = new Map<string | null, Task[]>();
    for (const t of filteredTasks) {
      const key = t.listId ?? null;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    }
    return map;
  }, [filteredTasks]);

  const unscheduledTasks = useMemo(() => filteredTasks.filter(t => !t.scheduledDate), [filteredTasks]);

  // Unscheduled drop target clears scheduledDate
  const [, unscheduleDrop] = useDrop<DragTaskItem, void, unknown>({
    accept: DND_TYPES.TASK,
    drop: (item) => {
      const previous = tasks.find(t => t.id === item.taskId);
      updateTaskMutation.mutate(
        { taskId: item.taskId, updates: { scheduledDate: null } },
        {
          onSuccess: () => {
            const undo = toast({
              title: 'Task unscheduled',
              description: 'Moved to Unscheduled. Undo?',
              action: (
                <button
                  aria-label="Undo unschedule"
                  className="px-2 py-1 text-xs rounded border"
                  onClick={() => {
                    if (previous?.scheduledDate) {
                      updateTaskMutation.mutate({ taskId: item.taskId, updates: { scheduledDate: previous.scheduledDate as any } });
                    }
                    undo.dismiss();
                  }}
                >
                  Undo
                </button>
              ),
            });
          },
        }
      );
    },
  });

  const rootClasses = variant === 'floating'
    ? 'relative w-96 h-full bg-white rounded-xl shadow-2xl border border-border flex flex-col overflow-hidden'
    : 'w-80 border-r border-border bg-surface h-full flex flex-col';

  return (
    <div className={cn(rootClasses, className)} data-testid="plan-panel">
      {variant === 'floating' && (
        <div className="absolute inset-y-0 -left-3 w-3 bg-gradient-to-r from-black/10 to-transparent rounded-l-xl pointer-events-none" />
      )}
      {/* Header */}
      <div className="p-3 border-b border-border">
        <div className="text-xs font-semibold text-muted-foreground mb-2">Plan</div>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search tasks"
          className="w-full text-sm px-2 py-1 rounded-md border bg-background"
        />
      </div>

      {/* Unscheduled bucket */}
      <div ref={unscheduleDrop} className="mx-3 my-3 p-2 rounded-md border border-dashed text-xs text-muted-foreground">
        Drop here to unschedule
      </div>

      {/* Lists */}
      <div className="flex-1 overflow-y-auto p-2 space-y-3">
        {/* Unscheduled section */}
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-xs font-medium text-muted-foreground">Unscheduled</div>
            <div className="text-[10px] text-muted-foreground">{unscheduledTasks.length}</div>
          </div>
          <div className="space-y-1">
            {unscheduledTasks.map((task) => (
              <DraggableTask key={task.id} task={task}>
                <SelectableTodoItem
                  task={task}
                  isSelected={false}
                  onSelect={() => {}}
                  onToggleComplete={() => {}}
                  onUpdate={(id, updates) => updateTaskMutation.mutate({ taskId: id, updates })}
                  variant="compact"
                  showTime={false}
                  showDate={false}
                  showTimer={false}
                  enableMoveMenu
                  showUnscheduledBadge
                />
              </DraggableTask>
            ))}
          </div>
        </section>

        {/* Lists with tasks */}
        {lists.map((list) => {
          const listTasks = (tasksByList.get(list.id) || []).filter(t => !!t.title);
          return (
            <section key={list.id} className="space-y-2">
              <button
                className="w-full flex items-center justify-between text-left"
                onClick={() => setCollapsed((c) => ({ ...c, [list.id]: !c[list.id] }))}
              >
                <div className="flex items-center gap-2">
                  <span className="text-base">{list.emoji}</span>
                  <span className="text-sm font-medium text-foreground">{list.name}</span>
                </div>
                <span className="text-[10px] text-muted-foreground">{listTasks.length}</span>
              </button>
              {!collapsed[list.id] && (
                <div className="space-y-1">
                  {listTasks.map((task) => (
                    <DraggableTask key={task.id} task={task}>
                      <SelectableTodoItem
                        task={task}
                        isSelected={false}
                        onSelect={() => {}}
                        onToggleComplete={() => {}}
                        onUpdate={(id, updates) => updateTaskMutation.mutate({ taskId: id, updates })}
                        variant="compact"
                        showTime={false}
                        showDate={false}
                        showTimer={false}
                        enableMoveMenu
                        showUnscheduledBadge
                      />
                    </DraggableTask>
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

function DraggableTask({ task, children }: { task: Task; children: React.ReactNode }) {
  const [, dragRef] = useDrag<DragTaskItem>(() => ({
    type: DND_TYPES.TASK,
    item: { type: DND_TYPES.TASK, taskId: task.id, source: 'plan-panel' },
  }), [task.id]);
  return (
    <div ref={dragRef} className="rounded-md hover:bg-accent">
      {children}
    </div>
  );
}


