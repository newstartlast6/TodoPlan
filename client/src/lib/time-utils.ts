import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, isToday, isPast, isFuture, differenceInMinutes, differenceInHours, differenceInDays, differenceInWeeks, differenceInMonths } from 'date-fns';

export interface TimeProgress {
  elapsed: number;
  remaining: number;
  percentage: number;
  urgencyLevel: 'low' | 'medium' | 'high';
}

export function calculateDayProgress(date: Date = new Date()): TimeProgress {
  const now = new Date();
  const dayStart = startOfDay(date);
  const dayEnd = endOfDay(date);
  
  if (!isToday(date)) {
    if (isPast(date)) {
      return { elapsed: 100, remaining: 0, percentage: 100, urgencyLevel: 'high' };
    } else {
      return { elapsed: 0, remaining: 100, percentage: 0, urgencyLevel: 'low' };
    }
  }
  
  const totalMinutes = differenceInMinutes(dayEnd, dayStart);
  const elapsedMinutes = differenceInMinutes(now, dayStart);
  const percentage = Math.max(0, Math.min(100, (elapsedMinutes / totalMinutes) * 100));
  
  return {
    elapsed: percentage,
    remaining: 100 - percentage,
    percentage,
    urgencyLevel: percentage > 75 ? 'high' : percentage > 50 ? 'medium' : 'low'
  };
}

export function calculateWeekProgress(date: Date = new Date()): TimeProgress {
  const now = new Date();
  const weekStart = startOfWeek(date, { weekStartsOn: 1 }); // Monday
  const weekEnd = endOfWeek(date, { weekStartsOn: 1 });
  
  const totalDays = 7;
  const elapsedDays = differenceInDays(now, weekStart);
  const percentage = Math.max(0, Math.min(100, (elapsedDays / totalDays) * 100));
  
  return {
    elapsed: percentage,
    remaining: 100 - percentage,
    percentage,
    urgencyLevel: percentage > 75 ? 'high' : percentage > 50 ? 'medium' : 'low'
  };
}

export function calculateMonthProgress(date: Date = new Date()): TimeProgress {
  const now = new Date();
  const monthStart = startOfMonth(date);
  const monthEnd = endOfMonth(date);
  
  const totalDays = differenceInDays(monthEnd, monthStart) + 1;
  const elapsedDays = differenceInDays(now, monthStart) + 1;
  const percentage = Math.max(0, Math.min(100, (elapsedDays / totalDays) * 100));
  
  return {
    elapsed: percentage,
    remaining: 100 - percentage,
    percentage,
    urgencyLevel: percentage > 75 ? 'high' : percentage > 50 ? 'medium' : 'low'
  };
}

export function calculateYearProgress(date: Date = new Date()): TimeProgress {
  const now = new Date();
  const yearStart = startOfYear(date);
  const yearEnd = endOfYear(date);
  
  const totalDays = differenceInDays(yearEnd, yearStart) + 1;
  const elapsedDays = differenceInDays(now, yearStart) + 1;
  const percentage = Math.max(0, Math.min(100, (elapsedDays / totalDays) * 100));
  
  return {
    elapsed: percentage,
    remaining: 100 - percentage,
    percentage,
    urgencyLevel: percentage > 75 ? 'high' : percentage > 50 ? 'medium' : 'low'
  };
}

export function getTimeRangeForView(view: 'day' | 'week' | 'month' | 'year', date: Date = new Date()) {
  switch (view) {
    case 'day':
      return { start: startOfDay(date), end: endOfDay(date) };
    case 'week':
      return { start: startOfWeek(date, { weekStartsOn: 1 }), end: endOfWeek(date, { weekStartsOn: 1 }) };
    case 'month':
      return { start: startOfMonth(date), end: endOfMonth(date) };
    case 'year':
      return { start: startOfYear(date), end: endOfYear(date) };
    default:
      return { start: startOfDay(date), end: endOfDay(date) };
  }
}

export function formatTimeRange(start: Date, end: Date): string {
  return `${format(start, 'h:mm a')} - ${format(end, 'h:mm a')}`;
}

export function getUrgencyClass(level: 'low' | 'medium' | 'high'): string {
  switch (level) {
    case 'high': return 'urgency-high';
    case 'medium': return 'urgency-medium';
    case 'low': return 'urgency-low';
    default: return 'urgency-low';
  }
}
