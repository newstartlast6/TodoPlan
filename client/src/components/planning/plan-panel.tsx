import React, { useMemo, useState } from 'react';
import { useLists } from '@/hooks/use-lists';
import { useQuery } from '@tanstack/react-query';
import { Task } from '@shared/schema';
import { SelectableTodoItem } from '@/components/calendar/selectable-todo-item';
import { useUpdateTask } from '@/hooks/use-list-tasks';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { DND_TYPES, type DragTaskItem } from '@/lib/dnd';
import { useDrag } from 'react-dnd';
import { CalendarDays, X, Grip } from 'lucide-react';

interface PlanPanelProps {
  className?: string;
  variant?: 'inline' | 'floating';
  onClose?: () => void;
}

export function PlanPanel({ className, variant = 'inline', onClose }: PlanPanelProps) {
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

  // Unscheduled bucket removed: tasks appear only under their lists.

  const rootClasses = variant === 'floating'
    ? 'relative w-96 h-full bg-white rounded-xl shadow-2xl border border-border flex flex-col overflow-hidden'
    : 'w-80 border-r border-border bg-surface h-full flex flex-col';

  return (
    <div className={cn(rootClasses, className)} data-testid="plan-panel">
      {/* Header */}
      <div className="sticky top-0 z-10 p-3 border-b border-border bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
        <div className="flex items-center justify-between">
          <div className="text-base font-semibold text-foreground">Plan</div>
          {onClose && (
            <button
              aria-label="Close plan"
              onClick={onClose}
              className="h-8 w-8 inline-flex items-center justify-center rounded-md hover:bg-muted"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="mt-2">
          <span className="inline-flex items-center gap-1 px-2 py-1 text-[11px] rounded-full bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200">
            <CalendarDays className="h-3 w-3" />
            Drag to calendar to schedule
          </span>
        </div>
        <div className="mt-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tasks"
            className="w-full text-sm px-3 py-2 rounded-md border bg-background"
          />
        </div>
      </div>

      {/* Lists */}
      <div className="flex-1 overflow-y-auto p-2 space-y-3">
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
                        onToggleComplete={(id, completed) => {
                          updateTaskMutation.mutate({ taskId: id, updates: { completed: !completed } });
                        }}
                        onUpdate={(id, updates) => updateTaskMutation.mutate({ taskId: id, updates })}
                        variant="compact"
                        showTime={false}
                        showDate={false}
                        showTimer={false}
                        enableMoveMenu
                        className="!cursor-grab active:!cursor-grabbing select-none"
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
    <div ref={dragRef} className="group relative rounded-md hover:bg-accent/60 cursor-grab active:cursor-grabbing transition-colors">
      <div className="absolute left-1 top-1/2 -translate-y-1/2 text-muted-foreground/60 group-hover:text-muted-foreground">
        <Grip className="h-4 w-4" />
      </div>
      <div className="pl-6">
        {children}
      </div>
    </div>
  );
}


