import { format, isToday, isSameDay, startOfWeek, endOfWeek, eachDayOfInterval, startOfMonth, endOfMonth, eachWeekOfInterval, startOfYear, endOfYear, eachMonthOfInterval, isPast, isThisMonth } from 'date-fns';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';
import { calculateDayProgress, calculateWeekProgress, calculateMonthProgress, calculateYearProgress, getUrgencyClass } from '@/lib/time-utils';
import type { Task } from '@shared/schema';

interface UrgencyViewSimpleProps {
  tasks: Task[];
  currentDate: Date;
  view: 'day' | 'week' | 'month' | 'year';
  className?: string;
}

export function UrgencyViewSimple({ tasks, currentDate, view, className }: UrgencyViewSimpleProps) {
  const renderDayMinimap = () => {
    const dayProgress = calculateDayProgress(currentDate);
    const hours = Array.from({ length: 24 }, (_, i) => i);
    const currentHour = new Date().getHours();

    return (
      <div className="space-y-3">
        <div className="grid grid-cols-12 gap-1">
          {hours.map((hour) => {
            const isPastHour = isToday(currentDate) && hour < currentHour;
            const isCurrentHour = isToday(currentDate) && hour === currentHour;

            return (
              <div
                key={hour}
                className={cn(
                  "h-3 rounded-sm transition-all",
                  isPastHour
                    ? "urgency-crossed"
                    : isCurrentHour
                      ? "bg-primary animate-pulse-subtle"
                      : "bg-gray-200 dark:bg-gray-700",
                )}
                title={`${hour}:00 ${hour < 12 ? "AM" : "PM"}`}
                data-testid={`hour-block-${hour}`}
              />
            );
          })}
        </div>

        <div className="flex items-center justify-between text-xs">
          <span className={getUrgencyClass(dayProgress.urgencyLevel)}>
            {Math.round(dayProgress.elapsed)}% elapsed
          </span>
          <span className="text-muted-foreground">
            {Math.round(dayProgress.remaining)}% remaining
          </span>
        </div>
      </div>
    );
  };

  const renderWeekMinimap = () => {
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
    const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });
    const weekProgress = calculateWeekProgress(currentDate);

    return (
      <div className="space-y-3">
        <div className="grid grid-cols-7 gap-1">
          {weekDays.map((day, dayIndex) => {
            const isCurrentDay = isToday(day);
            const isDayPast = isPast(day) && !isCurrentDay;
            const dayTasks = tasks.filter((task) =>
              isSameDay(new Date(task.startTime), day),
            );

            return (
              <div
                key={dayIndex}
                className={cn(
                  "h-8 rounded-sm transition-all",
                  isDayPast
                    ? "urgency-crossed"
                    : isCurrentDay
                      ? "bg-primary animate-pulse-subtle"
                      : "bg-gray-200 dark:bg-gray-700",
                )}
                title={format(day, "EEE, MMM d")}
                data-testid={`day-block-${dayIndex}`}
              >
                {dayTasks.length > 0 && (
                  <div className="text-xs text-white bg-black/30 rounded-sm px-1 m-0.5">
                    {dayTasks.length}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between text-xs">
          <span className={getUrgencyClass(weekProgress.urgencyLevel)}>
            {Math.round(weekProgress.elapsed)}% elapsed
          </span>
          <span className="text-muted-foreground">
            {Math.round(weekProgress.remaining)}% remaining
          </span>
        </div>
      </div>
    );
  };

  const renderMonthMinimap = () => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const monthProgress = calculateMonthProgress(currentDate);
    
    const weeks = eachWeekOfInterval(
      { start: monthStart, end: monthEnd },
      { weekStartsOn: 1 }
    );

    return (
      <div className="space-y-3">
        <div className="grid grid-cols-6 gap-1">
          {weeks.map((week, weekIndex) => {
            const weekDays = eachDayOfInterval({
              start: startOfWeek(week, { weekStartsOn: 1 }),
              end: endOfWeek(week, { weekStartsOn: 1 })
            });
            
            const weekTasks = tasks.filter(task => {
              const taskDate = new Date(task.startTime);
              return weekDays.some(day => isSameDay(taskDate, day));
            });
            
            const isCurrentWeek = weekDays.some(day => isToday(day));
            const isPastWeek = weekDays.every(day => isPast(day));

            return (
              <div
                key={weekIndex}
                className={cn(
                  "h-6 rounded-sm transition-all",
                  isPastWeek
                    ? "urgency-crossed"
                    : isCurrentWeek
                      ? "bg-primary animate-pulse-subtle"
                      : "bg-gray-200 dark:bg-gray-700",
                )}
                title={`Week ${weekIndex + 1}`}
                data-testid={`week-block-${weekIndex}`}
              >
                {weekTasks.length > 0 && (
                  <div className="text-xs text-white bg-black/30 rounded-sm px-1 m-0.5">
                    {weekTasks.length}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between text-xs">
          <span className={getUrgencyClass(monthProgress.urgencyLevel)}>
            {Math.round(monthProgress.elapsed)}% elapsed
          </span>
          <span className="text-muted-foreground">
            {Math.round(monthProgress.remaining)}% remaining
          </span>
        </div>
      </div>
    );
  };

  const renderYearMinimap = () => {
    const yearStart = startOfYear(currentDate);
    const yearEnd = endOfYear(currentDate);
    const yearProgress = calculateYearProgress(currentDate);
    const months = eachMonthOfInterval({ start: yearStart, end: yearEnd });

    return (
      <div className="space-y-3">
        <div className="grid grid-cols-6 gap-1">
          {months.map((month, monthIndex) => {
            const monthStart = startOfMonth(month);
            const monthEnd = endOfMonth(month);
            const monthTasks = tasks.filter(task => {
              const taskDate = new Date(task.startTime);
              return taskDate >= monthStart && taskDate <= monthEnd;
            });
            
            const isCurrentMonth = isThisMonth(month);
            const isPastMonth = isPast(monthEnd);

            return (
              <div
                key={monthIndex}
                className={cn(
                  "h-6 rounded-sm transition-all",
                  isPastMonth
                    ? "urgency-crossed"
                    : isCurrentMonth
                      ? "bg-primary animate-pulse-subtle"
                      : "bg-gray-200 dark:bg-gray-700",
                )}
                title={format(month, "MMM yyyy")}
                data-testid={`month-block-${monthIndex}`}
              >
                {monthTasks.length > 0 && (
                  <div className="text-xs text-white bg-black/30 rounded-sm px-1 m-0.5">
                    {monthTasks.length}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between text-xs">
          <span className={getUrgencyClass(yearProgress.urgencyLevel)}>
            {Math.round(yearProgress.elapsed)}% elapsed
          </span>
          <span className="text-muted-foreground">
            {Math.round(yearProgress.remaining)}% remaining
          </span>
        </div>
      </div>
    );
  };

  const getProgress = () => {
    switch (view) {
      case "day":
        return calculateDayProgress(currentDate);
      case "week":
        return calculateWeekProgress(currentDate);
      case "month":
        return calculateMonthProgress(currentDate);
      case "year":
        return calculateYearProgress(currentDate);
      default:
        return calculateWeekProgress(currentDate);
    }
  };

  const progress = getProgress();

  return (
    <div className={cn("bg-gray-100 dark:bg-gray-800 rounded-lg p-3 border", className)} data-testid="urgency-view-simple">
      <div className="space-y-4">
        {/* Progress Bar */}
        <div className="space-y-2">
          <Progress
            value={progress.percentage}
            className="h-2"
            data-testid="urgency-progress"
          />
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Progress</span>
            <span
              className={`font-medium ${getUrgencyClass(progress.urgencyLevel)}`}
            >
              {Math.round(progress.percentage)}%
            </span>
          </div>
        </div>

        {/* Active Minimap View */}
        <div data-testid={`minimap-view-${view}`}>
          {view === "day" && renderDayMinimap()}
          {view === "week" && renderWeekMinimap()}
          {view === "month" && renderMonthMinimap()}
          {view === "year" && renderYearMinimap()}
        </div>
      </div>
    </div>
  );
}