import { useState } from "react";
import {
  format,
  isToday,
  isSameDay,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  startOfMonth,
  endOfMonth,
  eachWeekOfInterval,
  startOfYear,
  endOfYear,
  eachMonthOfInterval,
  isPast,
  isThisMonth,
} from "date-fns";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import {
  calculateDayProgress,
  calculateWeekProgress,
  calculateMonthProgress,
  calculateYearProgress,
  getUrgencyClass,
} from "@/lib/time-utils";
import type { Task } from "@shared/schema";

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
                      : "bg-gray-200",
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
              <div key={dayIndex} className="space-y-1">
                <div
                  className={cn(
                    "h-4 rounded-sm transition-all",
                    isDayPast
                      ? "urgency-crossed"
                      : isCurrentDay
                        ? "bg-primary animate-pulse-subtle"
                        : "bg-gray-200",
                  )}
                  title={`${format(day, "EEEE")} - ${dayTasks.length} tasks`}
                  data-testid={`day-block-${dayIndex}`}
                />
                <div className="text-center">
                  <span
                    className={cn(
                      "text-xs font-medium",
                      isDayPast
                        ? "text-red-500 line-through"
                        : "text-foreground",
                    )}
                  >
                    {format(day, "d")}
                  </span>
                  {isDayPast && <div className="text-xs text-red-500">✓</div>}
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between text-xs">
          <span className={getUrgencyClass(weekProgress.urgencyLevel)}>
            {Math.floor((weekProgress.elapsed / 100) * 7)} days passed
          </span>
          <span className="text-muted-foreground">
            {7 - Math.floor((weekProgress.elapsed / 100) * 7)} days left
          </span>
        </div>
      </div>
    );
  };

  const renderMonthMinimap = () => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const weeks = eachWeekOfInterval(
      { start: monthStart, end: monthEnd },
      { weekStartsOn: 1 },
    );
    const monthProgress = calculateMonthProgress(currentDate);
    const currentDay = new Date().getDate();
    const totalDays = monthEnd.getDate();

    return (
      <div className="space-y-3">
        <div className="grid grid-cols-6 gap-1">
          {weeks.map((week, weekIndex) => {
            const weekStart = startOfWeek(week, { weekStartsOn: 1 });
            const isCurrentWeek =
              weekStart <= new Date() &&
              new Date() <= endOfWeek(week, { weekStartsOn: 1 });
            const isWeekPast =
              isPast(endOfWeek(week, { weekStartsOn: 1 })) && !isCurrentWeek;

            return (
              <div key={weekIndex} className="space-y-1">
                <div
                  className={cn(
                    "h-4 rounded-sm transition-all",
                    isWeekPast
                      ? "urgency-crossed"
                      : isCurrentWeek
                        ? "bg-primary animate-pulse-subtle"
                        : "bg-gray-200",
                  )}
                  title={`Week ${weekIndex + 1}`}
                  data-testid={`week-block-${weekIndex}`}
                />
                <div className="text-center">
                  <span
                    className={cn(
                      "text-xs font-medium",
                      isWeekPast
                        ? "text-red-500 line-through"
                        : "text-foreground",
                    )}
                  >
                    W{weekIndex + 1}
                  </span>
                  {isWeekPast && <div className="text-xs text-red-500">✓</div>}
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between text-xs">
          <span className={getUrgencyClass(monthProgress.urgencyLevel)}>
            {currentDay} days passed
          </span>
          <span className="text-muted-foreground">
            {totalDays - currentDay} days left
          </span>
        </div>
      </div>
    );
  };

  const renderYearMinimap = () => {
    const yearStart = startOfYear(currentDate);
    const yearEnd = endOfYear(currentDate);
    const months = eachMonthOfInterval({ start: yearStart, end: yearEnd });
    const yearProgress = calculateYearProgress(currentDate);
    const currentMonth = new Date().getMonth();

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Jan</span>
          <span>Now</span>
          <span>Dec</span>
        </div>

        <div className="grid grid-cols-6 gap-1">
          {months.map((month, monthIndex) => {
            const isCurrentMonth = monthIndex === currentMonth;
            const isMonthPast = monthIndex < currentMonth;

            return (
              <div key={monthIndex} className="space-y-1">
                <div
                  className={cn(
                    "h-4 rounded-sm transition-all",
                    isMonthPast
                      ? "urgency-crossed"
                      : isCurrentMonth
                        ? "bg-primary animate-pulse-subtle"
                        : "bg-gray-200",
                  )}
                  title={format(month, "MMMM")}
                  data-testid={`month-block-${monthIndex}`}
                />
                <div className="text-center">
                  <span
                    className={cn(
                      "text-xs font-medium",
                      isMonthPast
                        ? "text-red-500 line-through"
                        : "text-foreground",
                    )}
                  >
                    {format(month, "MMM")}
                  </span>
                  {isMonthPast && <div className="text-xs text-red-500">✓</div>}
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between text-xs">
          <span className={getUrgencyClass(yearProgress.urgencyLevel)}>
            {currentMonth + 1} months passed
          </span>
          <span className="text-muted-foreground">
            {12 - (currentMonth + 1)} months left
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