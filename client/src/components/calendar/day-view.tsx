import { format, isToday, isSameDay } from "date-fns";
import { Clock, Plus, Timer } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UrgencyViewSimple } from "@/components/ui/urgency-view-simple";
import { SelectableTodoItem } from "@/components/calendar/selectable-todo-item";
import { DailySummary } from "@/components/timer/daily-summary";
import { useSelectedTodo } from "@/hooks/use-selected-todo";
import { useDailyTimerStats } from "@/hooks/use-timer-state";
import { Task } from "@shared/schema";
import { GoalInline } from "@/components/calendar/goal-inline";

interface DayViewProps {
  tasks: Task[];
  currentDate: Date;
  onTaskUpdate: (taskId: string, updates: Partial<Task>) => void;
  onAddTask: () => void;
}

export function DayView({ tasks, currentDate, onTaskUpdate, onAddTask }: DayViewProps) {
  const { selectedTodoId, selectTodo } = useSelectedTodo();
  const dayTasks = tasks
    .filter(task => isSameDay(new Date(task.startTime), currentDate))
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

  const toggleTaskCompletion = (taskId: string, completed: boolean) => {
    onTaskUpdate(taskId, { completed: !completed });
  };

  const getCurrentTask = () => {
    if (!isCurrentDay) return null;
    const now = new Date();
    return dayTasks.find(task =>
      !task.completed &&
      new Date(task.startTime) <= now &&
      new Date(task.endTime) >= now
    );
  };

  const currentTask = getCurrentTask();

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

      {/* Current Task Highlight */}
      {currentTask && (
        <Card className="border-2 border-orange-200 bg-orange-50/40" data-testid="current-task-card">
          <CardHeader>
            <div className="flex items-center space-x-3">
              <div className="w-2 h-2 bg-orange-400 rounded-full animate-pulse"></div>
              <h3 className="text-lg font-semibold text-foreground">Currently Working On</h3>
            </div>
          </CardHeader>
          <CardContent>
            <SelectableTodoItem
              task={currentTask}
              isSelected={selectedTodoId === currentTask.id}
              onSelect={selectTodo}
              onToggleComplete={toggleTaskCompletion}
              variant="default"
              showTime={true}
              className="border-0 bg-transparent p-0"
            />
          </CardContent>
        </Card>
      )}

      {/* Tasks List */}
      <Card data-testid="tasks-list-card">
        <CardHeader>
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-foreground">
                {isCurrentDay ? "Today's Schedule" : `Schedule for ${format(currentDate, "EEEE")}`}
              </h3>
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
              <h3 className="text-lg font-medium text-foreground mb-2">No tasks scheduled</h3>
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
                  variant="default"
                  showTime={true}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>


    </div>
  );
}
