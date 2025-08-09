import { format, isToday, isSameDay, startOfWeek, endOfWeek, eachDayOfInterval, startOfMonth, endOfMonth, eachWeekOfInterval, startOfYear, endOfYear, eachMonthOfInterval, isPast, isThisMonth } from 'date-fns';
import { cn } from '@/lib/utils';
import { calculateDayProgress, calculateWeekProgress, calculateMonthProgress, calculateYearProgress, getUrgencyClass } from '@/lib/time-utils';
import type { Task } from '@shared/schema';

interface UrgencyOverviewProps {
  tasks: Task[];
  currentDate: Date;
  view: 'day' | 'week' | 'month' | 'year';
  className?: string;
}

export function UrgencyOverview({ tasks, currentDate, view, className }: UrgencyOverviewProps) {
  const renderDayOverview = () => {
    const dayProgress = calculateDayProgress(currentDate);
    const hours = Array.from({ length: 24 }, (_, i) => i);
    const currentHour = new Date().getHours();

    return (
      <div className={cn("flex flex-col items-end space-y-2", className)}>
        <div className="text-sm text-muted-foreground">Day Progress</div>
        <div className="grid grid-cols-12 gap-0.5 w-24">
          {hours.map((hour) => {
            const isPastHour = isToday(currentDate) && hour < currentHour;
            const isCurrentHour = isToday(currentDate) && hour === currentHour;

            return (
              <div
                key={hour}
                className={cn(
                  "h-1.5 w-2 rounded-sm transition-all",
                  isPastHour
                    ? "bg-primary/80"
                    : isCurrentHour
                      ? "bg-primary animate-pulse"
                      : "bg-gray-200 dark:bg-gray-700",
                )}
                title={`${hour}:00 ${hour < 12 ? "AM" : "PM"}`}
              />
            );
          })}
        </div>
        <div className={cn("text-xs font-medium", getUrgencyClass(dayProgress.urgencyLevel))}>
          {Math.round(dayProgress.remaining)}% remaining
        </div>
      </div>
    );
  };

  const renderWeekOverview = () => {
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
    const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });
    const weekProgress = calculateWeekProgress(currentDate);

    return (
      <div className={cn("flex flex-col items-end space-y-2", className)}>
        <div className="text-sm text-muted-foreground">Week Progress</div>
        <div className="flex gap-0.5">
          {weekDays.map((day, dayIndex) => {
            const isCurrentDay = isToday(day);
            const isDayPast = isPast(day) && !isCurrentDay;
            const dayTasks = tasks.filter((task) =>
              isSameDay(new Date(task.startTime), day)
            );
            const completedTasks = dayTasks.filter(task => task.completed);
            const progress = dayTasks.length > 0 ? (completedTasks.length / dayTasks.length) * 100 : 0;

            return (
              <div
                key={dayIndex}
                className={cn(
                  "w-2.5 h-4 rounded-sm transition-all relative",
                  isDayPast ? "bg-primary/80" : isCurrentDay ? "bg-primary animate-pulse" : "bg-gray-200 dark:bg-gray-700"
                )}
                title={format(day, "EEE, MMM d")}
              >
                {dayTasks.length > 0 && (
                  <div
                    className="absolute bottom-0 left-0 right-0 bg-green-500 rounded-sm"
                    style={{ height: `${progress}%` }}
                  />
                )}
              </div>
            );
          })}
        </div>
        <div className={cn("text-xs font-medium", getUrgencyClass(weekProgress.urgencyLevel))}>
          {Math.round(weekProgress.remaining)}% remaining
        </div>
      </div>
    );
  };

  const renderMonthOverview = () => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const monthProgress = calculateMonthProgress(currentDate);
    const weeks = eachWeekOfInterval(
      { start: monthStart, end: monthEnd },
      { weekStartsOn: 1 }
    );

    return (
      <div className={cn("flex flex-col items-end space-y-2", className)}>
        <div className="text-sm text-muted-foreground">Month Progress</div>
        <div className="grid grid-cols-6 gap-0.5 w-16">
          {weeks.map((week, weekIndex) => {
            const weekDays = eachDayOfInterval({
              start: startOfWeek(week, { weekStartsOn: 1 }),
              end: endOfWeek(week, { weekStartsOn: 1 })
            });
            
            const weekTasks = tasks.filter(task => {
              const taskDate = new Date(task.startTime);
              return weekDays.some(day => isSameDay(taskDate, day));
            });
            
            const completedWeekTasks = weekTasks.filter(task => task.completed);
            const progress = weekTasks.length > 0 ? (completedWeekTasks.length / weekTasks.length) * 100 : 0;
            const isCurrentWeek = weekDays.some(day => isToday(day));
            const isPastWeek = weekDays.every(day => isPast(day));

            return (
              <div
                key={weekIndex}
                className={cn(
                  "h-2 rounded-sm transition-all relative",
                  isPastWeek ? "bg-primary/80" : isCurrentWeek ? "bg-primary animate-pulse" : "bg-gray-200 dark:bg-gray-700"
                )}
                title={`Week ${weekIndex + 1}`}
              >
                {weekTasks.length > 0 && (
                  <div
                    className="absolute top-0 left-0 bottom-0 bg-green-500 rounded-sm"
                    style={{ width: `${progress}%` }}
                  />
                )}
              </div>
            );
          })}
        </div>
        <div className={cn("text-xs font-medium", getUrgencyClass(monthProgress.urgencyLevel))}>
          {Math.round(monthProgress.remaining)}% remaining
        </div>
      </div>
    );
  };

  const renderYearOverview = () => {
    const yearStart = startOfYear(currentDate);
    const yearEnd = endOfYear(currentDate);
    const yearProgress = calculateYearProgress(currentDate);
    const months = eachMonthOfInterval({ start: yearStart, end: yearEnd });

    return (
      <div className={cn("flex flex-col items-end space-y-2", className)}>
        <div className="text-sm text-muted-foreground">Year Progress</div>
        <div className="grid grid-cols-6 gap-0.5 w-20">
          {months.map((month, monthIndex) => {
            const monthStart = startOfMonth(month);
            const monthEnd = endOfMonth(month);
            const monthTasks = tasks.filter(task => {
              const taskDate = new Date(task.startTime);
              return taskDate >= monthStart && taskDate <= monthEnd;
            });
            
            const completedMonthTasks = monthTasks.filter(task => task.completed);
            const progress = monthTasks.length > 0 ? (completedMonthTasks.length / monthTasks.length) * 100 : 0;
            const isCurrentMonth = isThisMonth(month);
            const isPastMonth = isPast(monthEnd);

            return (
              <div
                key={monthIndex}
                className={cn(
                  "h-2.5 rounded-sm transition-all relative",
                  isPastMonth ? "bg-primary/80" : isCurrentMonth ? "bg-primary animate-pulse" : "bg-gray-200 dark:bg-gray-700"
                )}
                title={format(month, "MMM yyyy")}
              >
                {monthTasks.length > 0 && (
                  <div
                    className="absolute top-0 left-0 bottom-0 bg-green-500 rounded-sm"
                    style={{ width: `${progress}%` }}
                  />
                )}
              </div>
            );
          })}
        </div>
        <div className={cn("text-xs font-medium", getUrgencyClass(yearProgress.urgencyLevel))}>
          {Math.round(yearProgress.remaining)}% remaining
        </div>
      </div>
    );
  };

  switch (view) {
    case 'day':
      return renderDayOverview();
    case 'week':
      return renderWeekOverview();
    case 'month':
      return renderMonthOverview();
    case 'year':
      return renderYearOverview();
    default:
      return null;
  }
}