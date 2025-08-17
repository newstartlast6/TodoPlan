import { format, isToday, isSameDay, isPast, addDays } from "date-fns";
import { useMemo, useRef, useState } from "react";
import { CheckCircle, Clock, Circle, XCircle, PartyPopper, ChevronLeft, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { UrgencyViewSimple } from "@/components/ui/urgency-view-simple";
import { SelectableTodoItem } from "@/components/calendar/selectable-todo-item";
// import { DailySummary } from "@/components/timer/daily-summary";
import { useSelectedTodo } from "@/hooks/use-selected-todo";
import { useTimerStore } from "@/hooks/use-timer-store";
import { Task, InsertTask } from "@shared/schema";
import { useDrop } from 'react-dnd';
import { DND_TYPES, type DragTaskItem } from '@/lib/dnd';
import { useToast } from '@/hooks/use-toast';
import { GoalInline } from "@/components/calendar/goal-inline";
import { TimerCalculator } from "@shared/services/timer-store";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useNotes } from "@/hooks/use-notes";
import { StickyNote } from "lucide-react";
import { DraggableCalendarTask } from "@/components/planning/draggable-calendar-task";
import { AddTaskInline } from "@/components/calendar/add-task-inline";
 

interface DayViewProps {
  tasks: Task[];
  currentDate: Date;
  onTaskUpdate: (taskId: string, updates: Partial<Task>) => void;
  onAddTask: () => void;
  onTaskDelete?: (taskId: string) => void;
  onChangeDate?: (date: Date) => void;
  onTaskCreate?: (newTask: InsertTask) => void;
}

export function DayView({ tasks, currentDate, onTaskUpdate, onAddTask: _onAddTask, onTaskDelete, onChangeDate, onTaskCreate }: DayViewProps) {
  const { selectedTodoId, selectTodo, selectReview, selectNotes } = useSelectedTodo();
  const { toast } = useToast();
  const [newTitle, setNewTitle] = useState("");
  const dayTasks = tasks
    .filter(task => {
      const st = new Date(task.startTime);
      const sd = task.scheduledDate ? new Date(task.scheduledDate) : null;
      return isSameDay(st, currentDate) || (sd ? isSameDay(sd, currentDate) : false);
    })
    .sort((a, b) => {
      const aOrder = (a as any).dayOrder;
      const bOrder = (b as any).dayOrder;
      const aHas = typeof aOrder === 'number';
      const bHas = typeof bOrder === 'number';
      if (aHas && bHas) return aOrder - bOrder;
      if (aHas) return -1;
      if (bHas) return 1;
      const aKey = (a.createdAt ?? a.startTime) as unknown as string;
      const bKey = (b.createdAt ?? b.startTime) as unknown as string;
      return new Date(aKey).getTime() - new Date(bKey).getTime();
    });

  const completedTasks = dayTasks.filter(task => task.completed);
  const isCurrentDay = isToday(currentDate);
  const dayProgressPercent = dayTasks.length === 0 
    ? 0 
    : (completedTasks.length / dayTasks.length) * 100;

  // Timer statistics for the day
  // Remove daily summary; we will compute total based on tasks and current session only

  // Timer-based current task
  const timer = useTimerStore();
  const currentTaskId = timer.activeTaskId;
  const isTimerRunning = timer.isRunning;
  const currentElapsedSeconds = timer.displaySeconds;

  const toggleTaskCompletion = (taskId: string, completed: boolean) => {
    onTaskUpdate(taskId, { completed: !completed });
  };

  // Total time for today's tasks (persisted + live running boost if active task is in today's list)
  const dayTotalLoggedSeconds = useMemo(() => {
    // If a session is active for a task in today's list, use its durationSeconds as that task's total; otherwise use persisted
    const activeTaskId = currentTaskId;
    return dayTasks.reduce((sum, t) => {
      if (isTimerRunning && activeTaskId === t.id) {
        // currentElapsedSeconds is the current session total (seeded base + elapsed)
        return sum + (currentElapsedSeconds || 0);
      }
      return sum + (Number((t as any).timeLoggedSeconds) || 0);
    }, 0);
  }, [dayTasks, isTimerRunning, currentTaskId, currentElapsedSeconds]);
  const dayTotalFormatted = TimerCalculator.formatDuration(dayTotalLoggedSeconds);

  // Match week-view day card behavior
  const DAILY_TARGET_SECONDS = 8 * 60 * 60;
  const isPastDay = isPast(currentDate);
  const dayStatus = isCurrentDay
    ? 'current'
    : (isPastDay ? (dayTotalLoggedSeconds >= DAILY_TARGET_SECONDS ? 'celebration' : 'lost') : 'planned');

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'celebration': return <PartyPopper className="text-pink-500" />;
      case 'lost': return <XCircle className="text-red-500" />;
      case 'completed': return <CheckCircle className="text-green-500" />;
      case 'current': return <Clock className="text-primary animate-pulse-subtle" />;
      default: return <Circle className="text-gray-400" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'celebration': return <Badge className="bg-green-100 text-green-700">Achieved • Keep it up!</Badge>;
      case 'lost': return <Badge className="bg-red-100 text-red-700 border-red-200">Lost</Badge>;
      case 'completed': return <Badge className="bg-green-100 text-green-700">Completed</Badge>;
      case 'current': return <Badge className="bg-primary text-primary-foreground">Today</Badge>;
      default: return <Badge variant="outline">Planned</Badge>;
    }
  };

  const handleReorder = (dragTaskId: string, insertIndex: number) => {
    const baseList = [...dayTasks];
    const clampedIndex = Math.max(0, Math.min(insertIndex, baseList.length));
    const dragged = tasks.find(t => t.id === dragTaskId);
    const withoutDragged = baseList.filter(t => t.id !== dragTaskId);
    const newOrder = [
      ...withoutDragged.slice(0, clampedIndex),
      dragged!,
      ...withoutDragged.slice(clampedIndex),
    ].filter(Boolean);
    newOrder.forEach((t, idx) => {
      const updates: Partial<Task> = { dayOrder: idx } as any;
      if (t.id === dragTaskId) {
        updates.scheduledDate = currentDate as any;
      }
      onTaskUpdate(t.id, updates);
    });
  };

  return (
    <div className="space-y-8" data-testid="day-view">
      {/* Day Header */}
      <div className="mb-10">
        <div className="flex items-center justify-between mb-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                aria-label="Previous day"
                onClick={() => onChangeDate?.(addDays(currentDate, -1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <h2 className="text-3xl font-bold text-foreground" data-testid="day-title">
                {format(currentDate, "EEEE, MMMM d, yyyy")}
              </h2>
              {/* Day notes button */}
              <DayNotesInline date={currentDate} onOpenDetail={() => selectNotes('daily', currentDate)} />
              <Button
                variant="outline"
                size="icon"
                aria-label="Next day"
                onClick={() => onChangeDate?.(addDays(currentDate, 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <GoalInline type="daily" date={currentDate} label="DAILY GOAL:" />
          </div>
          <div className="flex items-center space-x-4">
            <UrgencyViewSimple
              tasks={tasks}
              currentDate={currentDate}
              view="day"
              className="w-64"
            />
          </div>
        </div>
        {/* Removed separate goal row; goal now shown under title */}
      </div>

      {/* Today-like Day Card (matching week-view style) */}
      <DroppableDay
        currentDate={currentDate}
        onDropTask={(item) => {
          const taskId = item.taskId;
          const previous = tasks.find(t => t.id === taskId);
          // Skip update if dropping onto the same day
          if (item.source === 'calendar' && item.fromDate) {
            const fromKey = new Date(item.fromDate).toISOString().slice(0, 10);
            const targetKey = new Date(currentDate).toISOString().slice(0, 10);
            if (fromKey === targetKey) return;
          } else if (previous?.scheduledDate) {
            const prevKey = new Date(previous.scheduledDate as any).toISOString().slice(0, 10);
            const targetKey = new Date(currentDate).toISOString().slice(0, 10);
            if (prevKey === targetKey) return;
          }

          // Schedule to end of day when dropping on the card itself
          onTaskUpdate(taskId, { scheduledDate: currentDate as any, dayOrder: dayTasks.length } as any);
          const undo = toast({
            title: 'Task scheduled',
            description: `Moved to ${format(currentDate, 'EEE, MMM d')}. Undo?`,
            action: (
              <button
                aria-label="Undo schedule"
                className="px-2 py-1 text-xs rounded border"
                onClick={() => {
                  onTaskUpdate(taskId, { scheduledDate: previous?.scheduledDate ?? null } as any);
                  undo.dismiss();
                }}
              >
                Undo
              </button>
            ),
          });
        }}
      >
        {({ isOver, canDrop, isDragging }) => (
          <>
            <Card 
              className={cn(
                "overflow-hidden transition-all duration-200",
                !isCurrentDay && isPastDay && "crossed-out",
                isCurrentDay && "border-2 border-primary shadow-md",
                // Hide the card's own border while dragging so the outer dashed border replaces it
                isDragging && canDrop && "border-transparent"
              )}
              data-testid="day-card"
            >
              <CardHeader className={cn(
                "border-b",
                !isCurrentDay && isPastDay && "bg-muted/50",
                isCurrentDay && "bg-accent"
              )}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    {getStatusIcon(dayStatus)}
                    <h3 className="text-lg font-semibold text-foreground flex items-center gap-1" data-testid="day-title">
                      <span>{format(currentDate, "EEEE, MMM d")}</span>
                      <DayNotesFor date={currentDate} onOpenDetail={() => selectNotes('daily', currentDate)} />
                    </h3>
                    {getStatusBadge(dayStatus)}
                  </div>
                  <div className="text-sm text-muted-foreground" data-testid="day-schedule-summary">
                    {Math.round(dayProgressPercent)}% • {dayTasks.length} tasks
                  </div>
                </div>
                <div className="mt-1 flex items-center justify-between">
                  <GoalInline type="daily" date={currentDate} label="GOAL:" />
                  <div className="text-sm text-muted-foreground font-semibold" data-testid="day-total-time">
                    Total Time: {dayTotalFormatted}
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-6 space-y-4">
                {dayTasks.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground" data-testid="no-tasks">
                    No tasks scheduled for this day
                  </div>
                ) : (
                  <div className="space-y-3">
                    {dayTasks.map((task, idx) => (
                      <ReorderTarget
                        key={task.id}
                        index={idx}
                        totalCount={dayTasks.length}
                        onReorder={(dragTaskId, insertIndex) => handleReorder(dragTaskId, insertIndex)}
                      >
                        <DraggableCalendarTask task={task}>
                          <SelectableTodoItem
                            task={task}
                            isSelected={selectedTodoId === task.id}
                            onSelect={selectTodo}
                            onToggleComplete={toggleTaskCompletion}
                            onUpdate={(id, updates) => onTaskUpdate(id, updates)}
                            onDelete={onTaskDelete}
                            variant="list"
                            showTime={false}
                            showLoggedTime={true}
                            startEditing={task.title === ""}
                          />
                        </DraggableCalendarTask>
                      </ReorderTarget>
                    ))}
                  </div>
                )}

                <AddTaskInline
                  date={currentDate}
                  tasksCountForDay={dayTasks.length}
                  onCreate={(payload) => {
                    if (onTaskCreate) onTaskCreate(payload);
                    setNewTitle('');
                  }}
                  testId={`add-input-day`}
                />

                {/* Daily Review row (inside card content) */}
                <button
                  className="w-full mt-3 group rounded-lg border border-dashed border-orange-300 hover:border-orange-400 hover:bg-orange-50/40 transition-colors p-3 flex items-center justify-between"
                  onClick={() => selectReview('daily', currentDate)}
                  aria-label="Open Daily Review"
                >
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-6 w-6 rounded-full bg-orange-100 text-orange-600 items-center justify-center text-xs font-semibold group-hover:bg-orange-200">DR</span>
                    <span className="text-sm font-medium text-foreground">Daily Review</span>
                  </div>
                  <span className="text-xs text-muted-foreground">Click to reflect</span>
                </button>
              </CardContent>
            </Card>
          </>
        )}
      </DroppableDay>

    </div>
  );
}

function DroppableDay({ currentDate, onDropTask, children }: { currentDate: Date; onDropTask: (item: DragTaskItem) => void; children: React.ReactNode | ((state: { isOver: boolean; canDrop: boolean; isDragging: boolean }) => React.ReactNode) }) {
  const [{ isOver, canDrop, isDragging }, drop] = useDrop<DragTaskItem, void, { isOver: boolean; canDrop: boolean; isDragging: boolean }>({
    accept: DND_TYPES.TASK,
    drop: (item, monitor) => {
      // If a nested drop already handled this, skip
      if (typeof monitor.didDrop === 'function' && monitor.didDrop()) return;
      // If dropping from calendar and same date, ignore here (reordering handled by inner targets)
      if (item.source === 'calendar' && item.fromDate) {
        const fromKey = new Date(item.fromDate).toISOString().slice(0, 10);
        const targetKey = new Date(currentDate).toISOString().slice(0, 10);
        if (fromKey === targetKey) return;
      }
      onDropTask(item);
    },
    collect: (monitor) => ({
      isOver: monitor.isOver({ shallow: true }),
      canDrop: monitor.canDrop(),
      isDragging: !!monitor.getItemType(),
    }),
  });
  const content = typeof children === 'function' ? (children as (s: { isOver: boolean; canDrop: boolean; isDragging: boolean }) => React.ReactNode)({ isOver, canDrop, isDragging }) : children;
  return (
    <div
      ref={drop}
      className={cn(
        'relative rounded-lg transition-all',
        // Show dashed border on card while dragging tasks
        canDrop && isDragging && 'border-2 border-dashed border-orange-300',
        // Emphasize hovered
        isOver && canDrop && 'border-orange-500 shadow-[0_0_0_4px_rgba(251,146,60,0.15)]'
      )}
    >
      {content}
      {isOver && canDrop && (
        <>
          <div className="pointer-events-none absolute inset-0 z-10 bg-slate-900/5 dark:bg-slate-50/5" />
          <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
            <span className="text-orange-700 bg-orange-50/90 ring-1 ring-orange-300 shadow-sm px-3 py-1 rounded-full text-sm font-medium">
              Drop here to schedule
            </span>
          </div>
        </>
      )}
    </div>
  );
}

function DayNotesInline({ date, onOpenDetail }: { date: Date; onOpenDetail?: () => void }) {
  const { note } = useNotes("daily", date);
  const hasNotes = (note?.content ?? "").trim().length > 0;
  return (
    <button
      type="button"
      onClick={onOpenDetail}
      className={cn(
        "ml-1 inline-flex items-center justify-center h-7 w-7 rounded-full border border-transparent",
        hasNotes ? "bg-orange-100 text-orange-700 ring-1 ring-orange-300" : "text-orange-600 hover:bg-orange-50"
      )}
      aria-label="Open day notes"
    >
      <StickyNote className="h-3.5 w-3.5" />
    </button>
  );
}

function DayNotesFor({ date, onOpenDetail }: { date: Date; onOpenDetail?: () => void }) {
  const { note } = useNotes("daily", date);
  const hasNotes = (note?.content ?? "").trim().length > 0;
  return (
    <button
      type="button"
      onClick={onOpenDetail}
      className={cn(
        "ml-1 inline-flex items-center justify-center h-6 w-6 rounded-full border border-transparent",
        hasNotes ? "bg-orange-100 text-orange-700 ring-1 ring-orange-300" : "text-orange-600 hover:bg-orange-50"
      )}
      aria-label="Open day notes"
    >
      <StickyNote className="h-3.5 w-3.5" />
    </button>
  );
}

function ReorderTarget({
  index,
  totalCount,
  onReorder,
  children,
}: {
  index: number;
  totalCount: number;
  onReorder: (dragTaskId: string, insertIndex: number) => void;
  children: React.ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isAfter, setIsAfter] = useState(false);
  const [{ isOver }, drop] = useDrop<DragTaskItem, { handled: true }, { isOver: boolean }>(() => ({
    accept: DND_TYPES.TASK,
    hover: (_item, monitor) => {
      const el = containerRef.current;
      const client = monitor.getClientOffset();
      if (!el || !client) return;
      const rect = el.getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      setIsAfter(client.y > midY);
    },
    drop: (item) => {
      const insertIndex = Math.max(0, Math.min(index + (isAfter ? 1 : 0), totalCount));
      onReorder(item.taskId, insertIndex);
      return { handled: true };
    },
    collect: (monitor) => ({ isOver: monitor.isOver({ shallow: true }) }),
  }), [index, totalCount, isAfter, onReorder]);

  return (
    <div ref={drop} className="relative">
      <div ref={containerRef} className="relative">
        {children}
        {isOver && (
          <div className={cn(
            "pointer-events-none absolute left-0 right-0",
            isAfter ? "bottom-0" : "top-0"
          )}>
            <div className="h-0.5 bg-orange-500 shadow-[0_0_0_2px_rgba(251,146,60,0.25)]" />
          </div>
        )}
      </div>
    </div>
  );
}
