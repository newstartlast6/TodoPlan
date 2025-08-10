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
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-3xl font-bold text-foreground" data-testid="day-title">
              {format(currentDate, "EEEE, MMMM d, yyyy")}
            </h2>
            <p className="text-muted-foreground mt-1" data-testid="day-summary">
              {completedTasks.length} of {dayTasks.length} tasks completed
            </p>
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
          <h3 className="text-lg font-semibold text-foreground">
            {isCurrentDay ? "Today's Schedule" : `Schedule for ${format(currentDate, "EEEE")}`}
          </h3>
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

      {/* Day Summary */}
      {dayTasks.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Task Completion Summary */}
          <Card data-testid="day-summary-card">
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold text-foreground mb-4">Task Progress</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600" data-testid="summary-completed">
                    {completedTasks.length}
                  </div>
                  <div className="text-sm text-muted-foreground">Completed</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary" data-testid="summary-remaining">
                    {dayTasks.length - completedTasks.length}
                  </div>
                  <div className="text-sm text-muted-foreground">Remaining</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-muted-foreground" data-testid="summary-percentage">
                    {dayTasks.length > 0 ? Math.round((completedTasks.length / dayTasks.length) * 100) : 0}%
                  </div>
                  <div className="text-sm text-muted-foreground">Progress</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Timer Summary */}
          <Card data-testid="timer-summary-card">
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                <Timer className="w-5 h-5" />
                Time Tracking
              </h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600 font-mono" data-testid="timer-total">
                    {dayTimerFormatted}
                  </div>
                  <div className="text-sm text-muted-foreground">Time Logged</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600" data-testid="timer-tasks">
                    {timerTaskCount}
                  </div>
                  <div className="text-sm text-muted-foreground">Tasks Timed</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600" data-testid="timer-progress">
                    {Math.round(timerProgress)}%
                  </div>
                  <div className="text-sm text-muted-foreground">Daily Target</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Detailed Timer Summary for Current Day */}
      {isCurrentDay && dayTimerSeconds > 0 && (
        <DailySummary
          date={currentDate}
          className="mt-6"
          data-testid="detailed-timer-summary"
        />
      )}
    </div>
  );
}
