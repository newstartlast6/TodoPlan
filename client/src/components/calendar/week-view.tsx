import { format, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, isToday, isPast } from "date-fns";
import { useEffect, useState } from "react";
import { CheckCircle, Clock, Circle } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { UrgencyViewSimple } from "@/components/ui/urgency-view-simple";
import { SelectableTodoItem } from "@/components/calendar/selectable-todo-item";
import { useSelectedTodo } from "@/hooks/use-selected-todo";
import { Task } from "@shared/schema";
import { calculateWeekProgress, getUrgencyClass } from "@/lib/time-utils";
import { cn } from "@/lib/utils";
import { GoalInline } from "@/components/calendar/goal-inline";

interface WeekViewProps {
  tasks: Task[];
  currentDate: Date;
  onTaskUpdate: (taskId: string, updates: Partial<Task>) => void;
}

export function WeekView({ tasks, currentDate, onTaskUpdate }: WeekViewProps) {
  const [goalsRefresh, setGoalsRefresh] = useState(0);
  useEffect(() => {
    const handler = () => setGoalsRefresh((n) => n + 1);
    window.addEventListener('goals:updated', handler);
    return () => window.removeEventListener('goals:updated', handler);
  }, []);
  const { selectedTodoId, selectTodo } = useSelectedTodo();
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
                <div className="mt-1">
                  <GoalInline type="daily" date={day} label="GOAL:" />
                </div>
              </CardHeader>
              
              <CardContent className="p-6">
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
                        variant="compact"
                        showTime={true}
                      />
                    ))}
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
