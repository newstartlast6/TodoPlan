import { format, startOfMonth, endOfMonth, eachWeekOfInterval, eachDayOfInterval, startOfWeek, endOfWeek, isSameMonth, isSameDay, isToday, isPast, addMonths } from "date-fns";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { UrgencyViewSimple } from "@/components/ui/urgency-view-simple";
import { useSelectedTodo } from "@/hooks/use-selected-todo";
import { Task } from "@shared/schema";
import { useDrop } from 'react-dnd';
import { DND_TYPES, type DragTaskItem } from '@/lib/dnd';
import { useToast } from '@/hooks/use-toast';
import { calculateMonthProgress, getUrgencyClass } from "@/lib/time-utils";
import { cn } from "@/lib/utils";
import { GoalInline } from "@/components/calendar/goal-inline";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNotes } from "@/hooks/use-notes";
import { StickyNote } from "lucide-react";

interface MonthViewProps {
  tasks: Task[];
  currentDate: Date;
  onDateClick: (date: Date) => void;
  onTaskUpdate?: (taskId: string, updates: Partial<Task>) => void;
  onChangeDate?: (date: Date) => void;
}

export function MonthView({ tasks, currentDate, onDateClick, onTaskUpdate, onChangeDate }: MonthViewProps) {
  const { selectedTodoId, selectTodo, selectNotes } = useSelectedTodo();
  const { toast } = useToast();
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const monthProgress = calculateMonthProgress(currentDate);
  
  const weeks = eachWeekOfInterval(
    { start: monthStart, end: monthEnd },
    { weekStartsOn: 1 }
  );

  const getTasksForDay = (day: Date) => {
    return tasks.filter(task => {
      const st = new Date(task.startTime);
      const sd = task.scheduledDate ? new Date(task.scheduledDate) : null;
      return isSameDay(st, day) || (sd ? isSameDay(sd, day) : false);
    });
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
      <div className="mb-10">
        <div className="flex items-center justify-between mb-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                aria-label="Previous month"
                onClick={() => onChangeDate?.(addMonths(currentDate, -1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <h2 className="text-2xl font-bold text-foreground flex items-center gap-1" data-testid="month-title">
                <span>{format(currentDate, "MMMM yyyy")}</span>
                <MonthNotesInline date={currentDate} onOpenDetail={() => selectNotes('monthly', currentDate)} />
              </h2>
              <Button
                variant="outline"
                size="icon"
                aria-label="Next month"
                onClick={() => onChangeDate?.(addMonths(currentDate, 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <GoalInline type="monthly" date={currentDate} label="MONTHLY GOAL:" />
          </div>
          <div className="flex items-center space-x-4">
            <UrgencyViewSimple 
              tasks={tasks} 
              currentDate={currentDate} 
              view="month"
              className="w-64"
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
                      <MonthDayCell
                        key={dayIndex}
                        weekIndex={weekIndex}
                        dayIndex={dayIndex}
                        day={day}
                        dayTasks={dayTasks}
                        isCurrentDay={isCurrentDay}
                        isDayPast={isDayPast}
                        isOutsideMonth={isOutsideMonth}
                        completedDayTasks={completedDayTasks}
                        onDateClick={onDateClick}
                        selectedTodoId={selectedTodoId}
                        onSelectTodo={selectTodo}
                      />
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

function MonthDayCell({
  weekIndex,
  dayIndex,
  day,
  dayTasks,
  isCurrentDay,
  isDayPast,
  isOutsideMonth,
  completedDayTasks,
  onDateClick,
  selectedTodoId,
  onSelectTodo,
}: {
  weekIndex: number;
  dayIndex: number;
  day: Date;
  dayTasks: Task[];
  isCurrentDay: boolean;
  isDayPast: boolean;
  isOutsideMonth: boolean;
  completedDayTasks: number;
  onDateClick: (date: Date) => void;
  selectedTodoId: string | null;
  onSelectTodo: (id: string) => void;
}) {
  return (
    <div className="relative">
      <button
        onClick={() => onDateClick(day)}
        className={cn(
          "p-3 min-h-[100px] rounded-lg border text-left transition-all hover:border-primary/50 w-full",
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
                "text-xs p-1 rounded truncate cursor-pointer transition-all",
                "hover:ring-1 hover:ring-primary/50",
                selectedTodoId === task.id && "ring-1 ring-primary bg-primary/10",
                task.completed 
                  ? "bg-green-100 text-green-700 line-through" 
                : "bg-muted text-muted-foreground"
              )}
              title={task.title}
              onClick={(e) => {
                e.stopPropagation();
                onSelectTodo(task.id);
              }}
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
    </div>
  );
}

function MonthNotesInline({ date, onOpenDetail }: { date: Date; onOpenDetail?: () => void }) {
  const { note } = useNotes("monthly", date);
  const hasNotes = (note?.content ?? "").trim().length > 0;
  return (
    <button
      type="button"
      onClick={onOpenDetail}
      className={cn(
        "ml-1 inline-flex items-center justify-center h-7 w-7 rounded-full border border-transparent",
        hasNotes ? "bg-orange-100 text-orange-700 ring-1 ring-orange-300" : "text-orange-600 hover:bg-orange-50"
      )}
      aria-label="Open month notes"
   >
      <StickyNote className="h-3.5 w-3.5" />
    </button>
  );
}

