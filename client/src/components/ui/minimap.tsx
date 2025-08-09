import { cn } from "@/lib/utils";
import { Task } from "@shared/schema";
import { format, isToday, isPast, isSameDay, startOfWeek, endOfWeek, eachDayOfInterval } from "date-fns";

interface MinimapProps {
  tasks: Task[];
  currentDate?: Date;
  className?: string;
}

export function Minimap({ tasks, currentDate = new Date(), className }: MinimapProps) {
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const getTasksForDay = (day: Date) => {
    return tasks.filter(task => isSameDay(new Date(task.startTime), day));
  };

  const getBlockColor = (task: Task) => {
    if (task.completed) return 'bg-gray-300';
    if (task.priority === 'high') return 'bg-primary';
    if (task.priority === 'medium') return 'bg-primary-light';
    return 'bg-gray-200';
  };

  return (
    <div className={cn("space-y-2", className)} data-testid="minimap">
      <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
        <span>Mon</span>
        <span>Today</span>
        <span>Sun</span>
      </div>
      
      <div className="space-y-1">
        {weekDays.map((day, dayIndex) => {
          const dayTasks = getTasksForDay(day);
          const isCurrentDay = isToday(day);
          const isDayPast = isPast(day) && !isCurrentDay;
          
          return (
            <div key={dayIndex} className="space-y-1">
              {dayTasks.length === 0 ? (
                <div 
                  className={cn(
                    "minimap-block",
                    isDayPast ? "bg-gray-200 crossed-out" : 
                    isCurrentDay ? "bg-primary animate-pulse-subtle" : "bg-gray-100"
                  )}
                  title={`${format(day, 'EEEE')} - ${dayTasks.length} tasks`}
                  data-testid={`minimap-day-${dayIndex}`}
                />
              ) : (
                dayTasks.map((task, taskIndex) => (
                  <div
                    key={`${dayIndex}-${taskIndex}`}
                    className={cn(
                      "minimap-block",
                      getBlockColor(task),
                      isDayPast || task.completed ? "crossed-out" : "",
                      isCurrentDay && !task.completed ? "animate-pulse-subtle" : ""
                    )}
                    title={`${task.title} - ${format(day, 'EEEE')}`}
                    data-testid={`minimap-task-${dayIndex}-${taskIndex}`}
                  />
                ))
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
