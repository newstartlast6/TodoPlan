import { format, isToday, isSameDay } from "date-fns";
import { Clock, Plus, Play } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { UrgencyViewSimple } from "@/components/ui/urgency-view-simple";
import { SelectableTodoItem } from "@/components/calendar/selectable-todo-item";
// import { DailySummary } from "@/components/timer/daily-summary";
import { useSelectedTodo } from "@/hooks/use-selected-todo";
import { useDailyTimerStats, useTimerState } from "@/hooks/use-timer-state";
import { Task } from "@shared/schema";
import { useDrop } from 'react-dnd';
import { DND_TYPES, type DragTaskItem } from '@/lib/dnd';
import { useToast } from '@/hooks/use-toast';
import { GoalInline } from "@/components/calendar/goal-inline";
import { formatTimeRange } from "@/lib/time-utils";

interface DayViewProps {
  tasks: Task[];
  currentDate: Date;
  onTaskUpdate: (taskId: string, updates: Partial<Task>) => void;
  onAddTask: () => void;
  onTaskDelete?: (taskId: string) => void;
}

export function DayView({ tasks, currentDate, onTaskUpdate, onAddTask, onTaskDelete }: DayViewProps) {
  const { selectedTodoId, selectTodo } = useSelectedTodo();
  const { toast } = useToast();
  const dayTasks = tasks
    .filter(task => {
      const st = new Date(task.startTime);
      const sd = task.scheduledDate ? new Date(task.scheduledDate) : null;
      return isSameDay(st, currentDate) || (sd ? isSameDay(sd, currentDate) : false);
    })
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

  const completedTasks = dayTasks.filter(task => task.completed);
  const isCurrentDay = isToday(currentDate);
  const dayProgressPercent = dayTasks.length === 0 
    ? 0 
    : (completedTasks.length / dayTasks.length) * 100;

  // Timer statistics for the day
  const {
    totalSeconds: dayTimerSeconds,
    formattedTotal: dayTimerFormatted,
    taskCount: timerTaskCount,
    progressPercentage: timerProgress,
  } = useDailyTimerStats(currentDate);

  // Timer-based current task
  const { currentTaskId, isTimerRunning } = useTimerState();

  const toggleTaskCompletion = (taskId: string, completed: boolean) => {
    onTaskUpdate(taskId, { completed: !completed });
  };

  const currentTask = (
    isCurrentDay && isTimerRunning
      ? dayTasks.find(task => task.id === currentTaskId && !task.completed)
      : null
  );

  return (
    <div className="space-y-8" data-testid="day-view">
      {/* Day Header */}
      <div className="mb-10">
        <div className="flex items-center justify-between mb-3">
          <div className="space-y-1">
            <h2 className="text-3xl font-bold text-foreground" data-testid="day-title">
              {format(currentDate, "EEEE, MMMM d, yyyy")}
            </h2>
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

      {/* Current Task Highlight (timer-based) */}
      {currentTask && (
        <Card className="border-2 border-orange-200 bg-orange-50/40" data-testid="current-task-card">
          <CardHeader>
            <div className="flex items-center space-x-3">
              <Play className="text-primary w-5 h-5" />
              <h3 className="text-lg font-semibold text-foreground">Currently Working On</h3>
              <Badge className="bg-orange-500 text-white ring-1 ring-orange-600/20">In Progress</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-foreground" data-testid="current-task-title">{currentTask.title}</p>
                {currentTask.description && (
                  <p className="text-sm text-muted-foreground mt-1" data-testid="current-task-description">
                    {currentTask.description}
                  </p>
                )}
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground" data-testid="current-task-time">
                  {formatTimeRange(new Date(currentTask.startTime), new Date(currentTask.endTime))}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => toggleTaskCompletion(currentTask.id, currentTask.completed || false)}
                  className="mt-2"
                  data-testid="button-complete-current"
                >
                  Mark Complete
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tasks List */}
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
      <Card data-testid="tasks-list-card">
        <CardHeader>
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-foreground">Tasks</h3>
              {isCurrentDay && (
                <div className="text-sm text-muted-foreground" data-testid="day-schedule-summary">
                  {completedTasks.length === dayTasks.length && dayTasks.length > 0 
                    ? '100%'
                    : Math.round(dayProgressPercent) + '%'} 
                  • {dayTasks.length} tasks
                </div>
              )}
            </div>
            <GoalInline type="daily" date={currentDate} label="GOAL:" />
          </div>
        </CardHeader>
        <CardContent>
          {dayTasks.length === 0 ? (
            <div className="text-center py-12" data-testid="no-tasks">
              <Clock className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">No tasks yet</h3>
              <p className="text-muted-foreground mb-4">Add some tasks to get started with your day</p>
              <Button onClick={onAddTask} data-testid="button-add-first-task">
                <Plus className="w-4 h-4 mr-2" />
                Add Your First Task
              </Button>
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
                   variant="default"
                  showTime={false}
                   showLoggedTime={true}
                  startEditing={task.title === ""}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      </DroppableDay>


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
