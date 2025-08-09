import { format, startOfMonth, endOfMonth, eachWeekOfInterval, eachDayOfInterval, startOfWeek, endOfWeek, isSameMonth, isSameDay, isToday, isPast } from "date-fns";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { UrgencyOverview } from "@/components/ui/urgency-overview";
import { Task } from "@shared/schema";
import { calculateMonthProgress, getUrgencyClass } from "@/lib/time-utils";
import { cn } from "@/lib/utils";

interface MonthViewProps {
  tasks: Task[];
  currentDate: Date;
  onDateClick: (date: Date) => void;
}

export function MonthView({ tasks, currentDate, onDateClick }: MonthViewProps) {
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const monthProgress = calculateMonthProgress(currentDate);
  
  const weeks = eachWeekOfInterval(
    { start: monthStart, end: monthEnd },
    { weekStartsOn: 1 }
  );

  const getTasksForDay = (day: Date) => {
    return tasks.filter(task => isSameDay(new Date(task.startTime), day));
  };

  const getDayStatus = (day: Date) => {
    if (!isSameMonth(day, currentDate)) return 'outside';
    if (isToday(day)) return 'today';
    if (isPast(day)) return 'past';
    return 'future';
  };

  const getCompletedTasksCount = (day: Date) => {
    const dayTasks = getTasksForDay(day);
    return dayTasks.filter(task => task.completed).length;
  };

  const completedTasks = tasks.filter(task => task.completed);
  const totalTasks = tasks.length;

  return (
    <div className="space-y-8" data-testid="month-view">
      {/* Month Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-foreground" data-testid="month-title">
              {format(currentDate, "MMMM yyyy")}
            </h2>
            <p className="text-muted-foreground mt-1" data-testid="month-summary">
              {Math.floor(monthProgress.elapsed)} days completed • {Math.ceil(monthProgress.remaining)} days remaining
            </p>
          </div>
          <div className="flex items-center space-x-4">
            <UrgencyOverview 
              tasks={tasks} 
              currentDate={currentDate} 
              view="month" 
            />
          </div>
        </div>
      </div>

      {/* Calendar Grid */}
      <Card data-testid="calendar-grid">
        <CardHeader>
          <div className="grid grid-cols-7 gap-2 text-center">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
              <div key={day} className="p-2 text-sm font-medium text-muted-foreground">
                {day}
              </div>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {weeks.map((week, weekIndex) => {
              const weekDays = eachDayOfInterval({
                start: startOfWeek(week, { weekStartsOn: 1 }),
                end: endOfWeek(week, { weekStartsOn: 1 })
              });

              return (
                <div key={weekIndex} className="grid grid-cols-7 gap-2">
                  {weekDays.map((day, dayIndex) => {
                    const dayTasks = getTasksForDay(day);
                    const dayStatus = getDayStatus(day);
                    const completedDayTasks = getCompletedTasksCount(day);
                    const isCurrentDay = isToday(day);
                    const isDayPast = dayStatus === 'past';
                    const isOutsideMonth = dayStatus === 'outside';

                    return (
                      <button
                        key={dayIndex}
                        onClick={() => onDateClick(day)}
                        className={cn(
                          "p-3 min-h-[100px] rounded-lg border text-left transition-all hover:border-primary/50",
                          isOutsideMonth && "opacity-30",
                          isDayPast && !isOutsideMonth && "crossed-out bg-muted/30",
                          isCurrentDay && "border-2 border-primary bg-accent",
                          !isCurrentDay && !isDayPast && !isOutsideMonth && "hover:bg-muted/50"
                        )}
                        data-testid={`calendar-day-${weekIndex}-${dayIndex}`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className={cn(
                            "text-sm font-medium",
                            isOutsideMonth ? "text-muted-foreground" : "text-foreground",
                            isCurrentDay && "font-bold"
                          )}>
                            {format(day, 'd')}
                          </span>
                          {dayTasks.length > 0 && (
                            <Badge 
                              variant={completedDayTasks === dayTasks.length ? "default" : "outline"}
                              className="text-xs px-1 py-0"
                            >
                              {completedDayTasks}/{dayTasks.length}
                            </Badge>
                          )}
                        </div>
                        
                        <div className="space-y-1">
                          {dayTasks.slice(0, 3).map((task, taskIndex) => (
                            <div
                              key={task.id}
                              className={cn(
                                "text-xs p-1 rounded truncate",
                                task.completed 
                                  ? "bg-green-100 text-green-700 line-through" 
                                  : task.priority === 'high'
                                  ? "bg-red-100 text-red-700"
                                  : task.priority === 'medium'
                                  ? "bg-primary-lighter text-primary"
                                  : "bg-muted text-muted-foreground"
                              )}
                              title={task.title}
                              data-testid={`task-preview-${weekIndex}-${dayIndex}-${taskIndex}`}
                            >
                              {task.title}
                            </div>
                          ))}
                          {dayTasks.length > 3 && (
                            <div className="text-xs text-muted-foreground">
                              +{dayTasks.length - 3} more
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Month Summary */}
      <Card data-testid="month-summary-card">
        <CardContent className="p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">Month Summary</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
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
              <div className={`text-2xl font-bold ${getUrgencyClass(monthProgress.urgencyLevel)}`} data-testid="summary-productivity">
                {Math.round(monthProgress.percentage)}%
              </div>
              <div className="text-sm text-muted-foreground">Month Progress</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-muted-foreground" data-testid="summary-efficiency">
                {totalTasks > 0 ? Math.round((completedTasks.length / totalTasks) * 100) : 0}%
              </div>
              <div className="text-sm text-muted-foreground">Task Completion</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
