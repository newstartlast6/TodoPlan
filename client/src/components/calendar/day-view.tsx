import { format, isToday, startOfDay, endOfDay, isSameDay } from "date-fns";
import { CheckCircle, Clock, Play, Circle, Plus } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { UrgencyMinimap } from "@/components/ui/urgency-minimap";
import { Task } from "@shared/schema";
import { calculateDayProgress, formatTimeRange, getUrgencyClass } from "@/lib/time-utils";
import { cn } from "@/lib/utils";

interface DayViewProps {
  tasks: Task[];
  currentDate: Date;
  onTaskUpdate: (taskId: string, updates: Partial<Task>) => void;
  onAddTask: () => void;
}

export function DayView({ tasks, currentDate, onTaskUpdate, onAddTask }: DayViewProps) {
  const dayProgress = calculateDayProgress(currentDate);
  const dayTasks = tasks
    .filter(task => isSameDay(new Date(task.startTime), currentDate))
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  
  const completedTasks = dayTasks.filter(task => task.completed);
  const isCurrentDay = isToday(currentDate);
  
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
            <div className="bg-surface/50 rounded-lg p-3 border">
              <UrgencyMinimap 
                tasks={tasks} 
                currentDate={currentDate} 
                className="w-64"
              />
            </div>
            <Button onClick={onAddTask} className="flex items-center space-x-2" data-testid="button-add-task">
              <Plus className="w-4 h-4" />
              <span>Add Task</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Current Task Highlight */}
      {currentTask && (
        <Card className="border-2 border-primary bg-accent" data-testid="current-task-card">
          <CardHeader>
            <div className="flex items-center space-x-3">
              <Play className="text-primary w-5 h-5" />
              <h3 className="text-lg font-semibold text-foreground">Currently Working On</h3>
              <Badge className="bg-primary text-primary-foreground">In Progress</Badge>
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
            <div className="space-y-4">
              {dayTasks.map((task, index) => {
                const isTaskCompleted = task.completed;
                const isTaskCurrent = task.id === currentTask?.id;
                const taskTime = new Date(task.startTime);
                const now = new Date();
                const isTaskPast = taskTime < now && !isCurrentDay;
                
                return (
                  <div
                    key={task.id}
                    className={cn(
                      "flex items-center space-x-4 p-4 rounded-lg border transition-all",
                      isTaskCompleted && "opacity-70 bg-muted/30",
                      isTaskCurrent && "bg-primary-lighter border-primary",
                      isTaskPast && "opacity-60",
                      !isTaskCompleted && !isTaskCurrent && !isTaskPast && "hover:bg-muted/50"
                    )}
                    data-testid={`task-${index}`}
                  >
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleTaskCompletion(task.id, task.completed || false)}
                      className="p-0 h-auto"
                      data-testid={`task-toggle-${index}`}
                    >
                      {isTaskCompleted ? (
                        <CheckCircle className="text-green-500 w-5 h-5" />
                      ) : isTaskCurrent ? (
                        <Play className="text-primary w-5 h-5" />
                      ) : (
                        <Circle className="text-gray-400 w-5 h-5" />
                      )}
                    </Button>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2">
                        <h4 
                          className={cn(
                            "font-medium text-foreground",
                            isTaskCompleted && "line-through"
                          )}
                          data-testid={`task-title-${index}`}
                        >
                          {task.title}
                        </h4>
                        {task.priority === 'high' && (
                          <Badge variant="destructive" className="text-xs">High Priority</Badge>
                        )}
                        {isTaskCurrent && (
                          <Badge className="text-xs bg-primary text-primary-foreground">Active</Badge>
                        )}
                      </div>
                      
                      {task.description && (
                        <p className="text-sm text-muted-foreground mt-1" data-testid={`task-description-${index}`}>
                          {task.description}
                        </p>
                      )}
                    </div>
                    
                    <div className="text-right">
                      <p className="text-sm font-medium text-foreground" data-testid={`task-time-${index}`}>
                        {formatTimeRange(new Date(task.startTime), new Date(task.endTime))}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(task.startTime), "h:mm a")}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Day Summary */}
      {dayTasks.length > 0 && (
        <Card data-testid="day-summary-card">
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">Day Summary</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
      )}
    </div>
  );
}
