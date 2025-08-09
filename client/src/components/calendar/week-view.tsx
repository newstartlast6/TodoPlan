import { format, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, isToday, isPast } from "date-fns";
import { CheckCircle, Clock, Play, Circle } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Task } from "@shared/schema";
import { calculateWeekProgress, formatTimeRange, getUrgencyClass } from "@/lib/time-utils";
import { cn } from "@/lib/utils";

interface WeekViewProps {
  tasks: Task[];
  currentDate: Date;
  onTaskUpdate: (taskId: string, updates: Partial<Task>) => void;
}

export function WeekView({ tasks, currentDate, onTaskUpdate }: WeekViewProps) {
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });
  const weekProgress = calculateWeekProgress(currentDate);
  
  const completedTasks = tasks.filter(task => task.completed);
  const totalTasks = tasks.length;
  
  const getTasksForDay = (day: Date) => {
    return tasks
      .filter(task => isSameDay(new Date(task.startTime), day))
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  };

  const getDayStatus = (day: Date) => {
    const dayTasks = getTasksForDay(day);
    const completedDayTasks = dayTasks.filter(task => task.completed);
    
    if (isToday(day)) return 'current';
    if (isPast(day)) return 'completed';
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
      case 'completed': return <CheckCircle className="text-green-500" />;
      case 'current': return <Clock className="text-primary animate-pulse-subtle" />;
      default: return <Circle className="text-gray-400" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed': return <Badge className="bg-green-100 text-green-700">Completed</Badge>;
      case 'current': return <Badge className="bg-primary text-primary-foreground">Today</Badge>;
      default: return <Badge variant="outline">Planned</Badge>;
    }
  };

  return (
    <div className="space-y-8" data-testid="week-view">
      {/* Week Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-foreground" data-testid="week-title">
              Week of {format(weekStart, "MMMM d")} - {format(weekEnd, "d, yyyy")}
            </h2>
            <p className="text-muted-foreground mt-1" data-testid="week-summary">
              {Math.floor(weekProgress.elapsed / 100 * 7)} days completed • {7 - Math.floor(weekProgress.elapsed / 100 * 7)} days remaining
            </p>
          </div>
          <div className="flex items-center space-x-4">
            {/* Week Progress */}
            <div className="flex items-center space-x-2">
              <Progress value={weekProgress.percentage} className="w-24" data-testid="week-progress" />
              <span className="text-sm font-medium text-muted-foreground">
                {Math.round(weekProgress.percentage)}% complete
              </span>
            </div>
            <div className="text-right">
              <div className="text-sm text-muted-foreground">Time Remaining</div>
              <div className={`text-lg font-semibold ${getUrgencyClass(weekProgress.urgencyLevel)}`} data-testid="time-remaining">
                {Math.round(weekProgress.remaining)}%
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Days List */}
      <div className="space-y-6">
        {weekDays.map((day, dayIndex) => {
          const dayTasks = getTasksForDay(day);
          const dayStatus = getDayStatus(day);
          const dayProgressPercent = getDayProgress(day);
          const isCurrentDay = isToday(day);
          const isDayCompleted = dayStatus === 'completed';
          
          return (
            <Card 
              key={dayIndex} 
              className={cn(
                "overflow-hidden transition-all duration-200",
                isDayCompleted && "crossed-out",
                isCurrentDay && "border-2 border-primary shadow-md"
              )}
              data-testid={`day-card-${dayIndex}`}
            >
              <CardHeader className={cn(
                "border-b",
                isDayCompleted && "bg-muted/50",
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
                    {dayStatus === 'completed' ? '100%' : Math.round(dayProgressPercent) + '%'} • {dayTasks.length} tasks
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="p-6">
                {dayTasks.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground" data-testid={`no-tasks-${dayIndex}`}>
                    No tasks scheduled for this day
                  </div>
                ) : (
                  <div className="space-y-3">
                    {dayTasks.map((task, taskIndex) => {
                      const isTaskCompleted = task.completed;
                      const isTaskCurrent = isCurrentDay && !isTaskCompleted && new Date() >= new Date(task.startTime) && new Date() <= new Date(task.endTime);
                      
                      return (
                        <div
                          key={task.id}
                          className={cn(
                            "flex items-center space-x-3 p-3 rounded-lg transition-all",
                            isTaskCompleted && "opacity-70",
                            isTaskCurrent && "bg-primary-lighter",
                            !isTaskCompleted && !isTaskCurrent && "hover:bg-muted/50"
                          )}
                          data-testid={`task-${dayIndex}-${taskIndex}`}
                        >
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleTaskCompletion(task.id, task.completed)}
                            className="p-0 h-auto"
                            data-testid={`task-toggle-${dayIndex}-${taskIndex}`}
                          >
                            {isTaskCompleted ? (
                              <CheckCircle className="text-green-500 w-4 h-4" />
                            ) : isTaskCurrent ? (
                              <Play className="text-primary w-4 h-4" />
                            ) : (
                              <Circle className="text-gray-400 w-4 h-4" />
                            )}
                          </Button>
                          
                          <span 
                            className={cn(
                              "flex-1 text-foreground",
                              isTaskCompleted && "line-through"
                            )}
                            data-testid={`task-title-${dayIndex}-${taskIndex}`}
                          >
                            {task.title}
                          </span>
                          
                          <span className="text-xs text-muted-foreground" data-testid={`task-time-${dayIndex}-${taskIndex}`}>
                            {formatTimeRange(new Date(task.startTime), new Date(task.endTime))}
                          </span>
                          
                          {task.priority === 'high' && (
                            <Badge variant="destructive" className="text-xs">High</Badge>
                          )}
                          
                          {isTaskCurrent && (
                            <Badge className="text-xs bg-primary text-primary-foreground">In Progress</Badge>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
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
    </div>
  );
}
