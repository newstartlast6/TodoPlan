import { format, isToday, isSameDay, isPast, addDays } from "date-fns";
import { useMemo } from "react";
import { CheckCircle, Clock, Circle, XCircle, PartyPopper, ChevronLeft, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { UrgencyViewSimple } from "@/components/ui/urgency-view-simple";
import { SelectableTodoItem } from "@/components/calendar/selectable-todo-item";
// import { DailySummary } from "@/components/timer/daily-summary";
import { useSelectedTodo } from "@/hooks/use-selected-todo";
import { useTimerStore } from "@/hooks/use-timer-store";
import { Task } from "@shared/schema";
import { useDrop } from 'react-dnd';
import { DND_TYPES, type DragTaskItem } from '@/lib/dnd';
import { useToast } from '@/hooks/use-toast';
import { GoalInline } from "@/components/calendar/goal-inline";
import { TimerCalculator } from "@shared/services/timer-store";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface DayViewProps {
  tasks: Task[];
  currentDate: Date;
  onTaskUpdate: (taskId: string, updates: Partial<Task>) => void;
  onAddTask: () => void;
  onTaskDelete?: (taskId: string) => void;
  onChangeDate?: (date: Date) => void;
}

export function DayView({ tasks, currentDate, onTaskUpdate, onAddTask: _onAddTask, onTaskDelete, onChangeDate }: DayViewProps) {
  const { selectedTodoId, selectTodo, selectReview } = useSelectedTodo();
  const { toast } = useToast();
  const dayTasks = tasks
    .filter(task => {
      const st = new Date(task.startTime);
      const sd = task.scheduledDate ? new Date(task.scheduledDate) : null;
      return isSameDay(st, currentDate) || (sd ? isSameDay(sd, currentDate) : false);
    })
    .sort((a, b) => {
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
      <Card 
        className={cn(
          "overflow-hidden transition-all duration-200",
          !isCurrentDay && isPastDay && "crossed-out",
          isCurrentDay && "border-2 border-primary shadow-md"
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
              <h3 className="text-lg font-semibold text-foreground" data-testid="day-title">
                {format(currentDate, "EEEE, MMM d")}
              </h3>
              {getStatusBadge(dayStatus)}
            </div>
            <div className="text-sm text-muted-foreground" data-testid="day-schedule-summary">
              {!isCurrentDay && isPastDay ? '100%' : Math.round(dayProgressPercent) + '%'} • {dayTasks.length} tasks
            </div>
          </div>
          <div className="mt-1 flex items-center justify-between">
            <GoalInline type="daily" date={currentDate} label="GOAL:" />
            <div className="text-sm text-muted-foreground font-semibold" data-testid="day-total-time">
              Total Time: {dayTotalFormatted}
            </div>
          </div>
        </CardHeader>

        <DroppableDay onDropTask={(taskId) => {
          const previous = tasks.find(t => t.id === taskId);
          onTaskUpdate(taskId, { scheduledDate: currentDate });
          const undo = toast({
            title: 'Task scheduled',
            description: `Moved to ${format(currentDate, 'EEE, MMM d')}. Undo?`,
            action: (
              <button
                aria-label="Undo schedule"
                className="px-2 py-1 text-xs rounded border"
                onClick={() => {
                  onTaskUpdate(taskId, { scheduledDate: previous?.scheduledDate ?? null });
                  undo.dismiss();
                }}
              >
                Undo
              </button>
            ),
          });
        }}>
          <CardContent className="p-6 space-y-4">
            {dayTasks.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground" data-testid="no-tasks">
                No tasks scheduled for this day
              </div>
            ) : (
              <div className="space-y-2">
                {dayTasks.map((task) => (
                  <SelectableTodoItem
                    key={task.id}
                    task={task}
                    isSelected={selectedTodoId === task.id}
                    onSelect={selectTodo}
                    onToggleComplete={toggleTaskCompletion}
                    onUpdate={(id, updates) => onTaskUpdate(id, updates)}
                    onDelete={onTaskDelete}
                    variant="compact"
                    showTime={false}
                    showLoggedTime={true}
                    startEditing={task.title === ""}
                  />
                ))}
              </div>
            )}

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
        </DroppableDay>
      </Card>

    </div>
  );
}

function DroppableDay({ onDropTask, children }: { onDropTask: (taskId: string) => void; children: React.ReactNode }) {
  const [{ isOver, canDrop }, drop] = useDrop<DragTaskItem, void, { isOver: boolean; canDrop: boolean }>({
    accept: DND_TYPES.TASK,
    drop: (item) => {
      onDropTask(item.taskId);
    },
    collect: (monitor) => ({
      isOver: monitor.isOver({ shallow: true }),
      canDrop: monitor.canDrop(),
    }),
  });
  return (
    <div ref={drop} className={isOver && canDrop ? 'ring-2 ring-primary/40 rounded-md' : ''}>
      {children}
    </div>
  );
}
