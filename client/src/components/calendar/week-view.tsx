import { format, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, isToday, isPast } from "date-fns";
import { useEffect, useMemo, useState } from "react";
import { CheckCircle, Clock, Circle, XCircle, PartyPopper } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { UrgencyViewSimple } from "@/components/ui/urgency-view-simple";
import { SelectableTodoItem } from "@/components/calendar/selectable-todo-item";
import { useSelectedTodo } from "@/hooks/use-selected-todo";
import { Task } from "@shared/schema";
import { calculateWeekProgress, getUrgencyClass } from "@/lib/time-utils";
import { cn } from "@/lib/utils";
import { GoalInline } from "@/components/calendar/goal-inline";
import { useDrop } from 'react-dnd';
import { DND_TYPES, type DragTaskItem } from '@/lib/dnd';
import { useToast } from '@/hooks/use-toast';
import { useTimerStore } from '@/hooks/use-timer-store';
import { TimerCalculator } from '@shared/services/timer-store';
import { ReviewForm } from "@/components/ui/review-form";

interface WeekViewProps {
  tasks: Task[];
  currentDate: Date;
  onTaskUpdate: (taskId: string, updates: Partial<Task>) => void;
  onTaskDelete?: (taskId: string) => void;
}

export function WeekView({ tasks, currentDate, onTaskUpdate, onTaskDelete }: WeekViewProps) {
  const DAILY_TARGET_SECONDS = 8 * 60 * 60; // 8 hours target per day
  const [goalsRefresh, setGoalsRefresh] = useState(0);
  const { toast } = useToast();
  useEffect(() => {
    const handler = () => setGoalsRefresh((n) => n + 1);
    window.addEventListener('goals:updated', handler);
    return () => window.removeEventListener('goals:updated', handler);
  }, []);
  const { selectedTodoId, selectTodo, selectReview } = useSelectedTodo();
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });
  const weekProgress = calculateWeekProgress(currentDate);
  const timer = useTimerStore();
  const isTimerRunning = timer.isRunning;
  const currentTaskId = timer.activeTaskId;
  const currentElapsedSeconds = timer.displaySeconds;
  
  const completedTasks = tasks.filter(task => task.completed);
  const totalTasks = tasks.length;
  
  const getTasksForDay = (day: Date) => {
    return tasks
      .filter(task => {
        const st = new Date(task.startTime);
        const sd = task.scheduledDate ? new Date(task.scheduledDate) : null;
        return isSameDay(st, day) || (sd ? isSameDay(sd, day) : false);
      })
      .sort((a, b) => {
        const aKey = (a.createdAt ?? a.startTime) as unknown as string;
        const bKey = (b.createdAt ?? b.startTime) as unknown as string;
        return new Date(aKey).getTime() - new Date(bKey).getTime();
      });
  };

  const getDayStatus = (day: Date, dayTotalSeconds: number) => {
    if (isToday(day)) return 'current';
    if (isPast(day)) {
      return dayTotalSeconds >= DAILY_TARGET_SECONDS ? 'celebration' : 'lost';
    }
    return 'planned';
  };

  const getDayProgress = (day: Date) => {
    const dayTasks = getTasksForDay(day);
    if (dayTasks.length === 0) return 0;
    
    const completed = dayTasks.filter(task => task.completed).length;
    return (completed / dayTasks.length) * 100;
  };

  const toggleTaskCompletion = (taskId: string, completed: boolean) => {
    onTaskUpdate(taskId, { completed: !completed });
  };

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
    <div className="space-y-8" data-testid="week-view" data-goals-refresh={goalsRefresh}>
      {/* Week Header */}
      <div className="mb-10">
        <div className="flex items-center justify-between mb-3">
          <div className="space-y-1">
            <h2 className="text-2xl font-bold text-foreground" data-testid="week-title">
              Week of {format(weekStart, "MMMM d")} - {format(weekEnd, "d, yyyy")}
            </h2>
            <GoalInline type="weekly" date={currentDate} label="WEEKLY GOAL:" />
          </div>
          <div className="flex items-center space-x-4">
            <UrgencyViewSimple 
              tasks={tasks} 
              currentDate={currentDate} 
              view="week"
              className="w-64"
            />
          </div>
        </div>        
      </div>

      {/* Days List */}
      <div className="space-y-6">
        {weekDays.map((day, dayIndex) => {
          const dayTasks = getTasksForDay(day);
          // Total Time for this day: for the active task use live session total; others use persisted
          const dayTotalSeconds = dayTasks.reduce((sum, t) => {
            if (isTimerRunning && currentTaskId === t.id) {
              return sum + (currentElapsedSeconds || 0);
            }
            return sum + (Number((t as any).timeLoggedSeconds) || 0);
          }, 0);
          const dayStatus = getDayStatus(day, dayTotalSeconds);
          const dayProgressPercent = getDayProgress(day);
          const isCurrentDay = isToday(day);
          const isPastDay = isPast(day);
          const isLostDay = dayStatus === 'lost';
          const dayTotalFormatted = TimerCalculator.formatDuration(dayTotalSeconds);
          
            return (
              <Card 
              key={dayIndex} 
              className={cn(
                "overflow-hidden transition-all duration-200",
                  !isCurrentDay && isPastDay && "crossed-out",
                isCurrentDay && "border-2 border-primary shadow-md"
              )}
              data-testid={`day-card-${dayIndex}`}
            >
              <CardHeader className={cn(
                "border-b",
                !isCurrentDay && isPastDay && "bg-muted/50",
                isCurrentDay && "bg-accent"
              )}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    {getStatusIcon(dayStatus)}
                    <h3 className="text-lg font-semibold text-foreground" data-testid={`day-title-${dayIndex}`}>
                      {format(day, "EEEE, MMM d")}
                    </h3>
                    {getStatusBadge(dayStatus)}
                  </div>
                  <div className="text-sm text-muted-foreground" data-testid={`day-progress-${dayIndex}`}>
                    {!isCurrentDay && isPastDay ? '100%' : Math.round(dayProgressPercent) + '%'} • {dayTasks.length} tasks
                  </div>
                </div>
                 <div className="mt-1 flex items-center justify-between">
                  <GoalInline type="daily" date={day} label="GOAL:" />
                  <div className="text-sm text-muted-foreground font-semibold" data-testid={`day-total-time-${dayIndex}`}>
                    Total Time: {dayTotalFormatted}
                  </div>
                </div>
              </CardHeader>
              
              <DroppableDay onDropTask={(taskId) => {
                const previous = tasks.find(t => t.id === taskId);
                onTaskUpdate(taskId, { scheduledDate: day });
                const undo = toast({
                  title: 'Task scheduled',
                  description: `Moved to ${format(day, 'EEE, MMM d')}. Undo?`,
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
                  <div className="text-center py-8 text-muted-foreground" data-testid={`no-tasks-${dayIndex}`}>
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
                {/* Daily Review row (click to open review in detail pane) */}
                <button
                  className="w-full mt-3 group rounded-lg border border-dashed border-orange-300 hover:border-orange-400 hover:bg-orange-50/40 transition-colors p-3 flex items-center justify-between"
                  onClick={() => selectReview('daily', day)}
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
          );
        })}
      </div>

      {/* Week Summary */}
      <Card data-testid="week-summary-card">
        <CardContent className="p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">Week Summary</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600" data-testid="summary-completed">
                {completedTasks.length}
              </div>
              <div className="text-sm text-muted-foreground">Tasks Completed</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-primary" data-testid="summary-remaining">
                {totalTasks - completedTasks.length}
              </div>
              <div className="text-sm text-muted-foreground">Tasks Remaining</div>
            </div>
            <div className="text-center">
              <div className={`text-2xl font-bold ${getUrgencyClass(weekProgress.urgencyLevel)}`} data-testid="summary-productivity">
                {Math.round(weekProgress.percentage)}%
              </div>
              <div className="text-sm text-muted-foreground">Week Productivity</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Weekly Review row */}
      <button
        className="w-full group rounded-lg border border-dashed border-orange-300 hover:border-orange-400 hover:bg-orange-50/40 transition-colors p-4 flex items-center justify-between"
        onClick={() => selectReview('weekly', weekStart)}
        aria-label="Open Weekly Review"
      >
        <div className="flex items-center gap-3">
          <span className="inline-flex h-7 w-7 rounded-full bg-orange-100 text-orange-600 items-center justify-center text-xs font-semibold group-hover:bg-orange-200">WR</span>
          <div className="flex flex-col text-left">
            <span className="text-sm font-semibold text-foreground">Weekly Review</span>
            <span className="text-xs text-muted-foreground">Reflect on your week</span>
          </div>
        </div>
        <span className="text-xs text-muted-foreground">Click to reflect</span>
      </button>
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
    <div ref={drop} className={cn(
      'rounded-md transition-colors',
      isOver && canDrop ? 'ring-2 ring-primary/40' : ''
    )}>
      {children}
    </div>
  );
}
