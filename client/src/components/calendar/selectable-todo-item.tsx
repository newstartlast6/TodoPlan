import { format } from "date-fns";
import { useEffect, useRef, useState } from "react";
import { CheckCircle, Clock, Circle, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Task } from "@shared/schema";
import { formatTimeRange } from "@/lib/time-utils";
import { TaskTimerButton } from "@/components/timer/task-timer-button";
import { TaskEstimateIndicator } from "@/components/timer/task-estimation";
import { useTaskTimer } from "@/hooks/use-timer-state";
import { cn } from "@/lib/utils";
import { EditableText } from "@/components/ui/editable-text";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreVertical } from "lucide-react";
import { TimerCalculator } from "@shared/services/timer-service";
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";

interface SelectableTodoItemProps {
  task: Task;
  isSelected: boolean;
  onSelect: (taskId: string) => void;
  onToggleComplete: (taskId: string, completed: boolean) => void;
  onUpdate?: (taskId: string, updates: Partial<Task>) => void;
  onDelete?: (taskId: string) => void;
  variant?: 'default' | 'compact' | 'minimal';
  showTime?: boolean;
  showDate?: boolean;
  showTimer?: boolean;
  // Whether to show the small "time logged today" row under the title
  showLoggedTime?: boolean;
  showEstimate?: boolean;
  className?: string;
  // When true, programmatically start editing the title
  startEditing?: boolean;
  // Optional keyboard fallback: move menu to schedule quickly
  enableMoveMenu?: boolean;
  // Show an "Unscheduled" badge when task has no scheduledDate
  showUnscheduledBadge?: boolean;
}

export function SelectableTodoItem({
  task,
  isSelected,
  onSelect,
  onToggleComplete,
  onUpdate,
  onDelete,
  variant = 'default',
  showTime = true,
  showDate = false,
  showTimer = true,
  showLoggedTime = true,
  showEstimate = true,
  className,
  startEditing = false,
  enableMoveMenu = false,
  showUnscheduledBadge = false,
}: SelectableTodoItemProps) {
  const isTaskCompleted = task.completed;
  const taskStartTime = new Date(task.startTime);
  const taskEndTime = new Date(task.endTime);
  const [titleEditTrigger, setTitleEditTrigger] = useState(0);
  
  // If parent asks to start editing, bump the trigger
  useEffect(() => {
    if (startEditing) {
      setTitleEditTrigger((n) => n + 1);
    }
  }, [startEditing]);
  
  // Timer integration
  // Show while running: current session total (seeded base + elapsed)
  // When paused: show persisted total
  const { isActiveTask, isRunning, currentSessionSeconds } = useTaskTimer(task.id);
  const persistedSeconds = (task as any).timeLoggedSeconds || 0;
  const holdRef = useRef<number>(0);
  const isRunningActiveComputed = isActiveTask && isRunning;
  // Track latest running session value
  useEffect(() => {
    if (isRunningActiveComputed) {
      holdRef.current = Math.max(holdRef.current, currentSessionSeconds || 0);
    }
  }, [isRunningActiveComputed, currentSessionSeconds]);

  // When not running, hold the last running value until persisted catches up
  const displaySeconds = isRunningActiveComputed
    ? (currentSessionSeconds || 0)
    : Math.max(persistedSeconds, holdRef.current || 0);

  // Reset hold once persisted matches or exceeds the held value
  useEffect(() => {
    if (!isRunningActiveComputed && persistedSeconds >= (holdRef.current || 0)) {
      holdRef.current = 0;
    }
  }, [isRunningActiveComputed, persistedSeconds]);

  // Debug logging removed
  useEffect(() => {
    holdRef.current = 0;
  }, [isRunningActiveComputed, persistedSeconds]);
  const formattedPersistedTime = TimerCalculator.formatDuration(displaySeconds);

  const handleClick = (e: React.MouseEvent) => {
    // Don't trigger selection when clicking the completion button or timer controls
    if ((e.target as HTMLElement).closest('[data-completion-button]') ||
        (e.target as HTMLElement).closest('[data-timer-control]')) {
      return;
    }
    onSelect(task.id);
    // Start inline editing of title on item click
    setTitleEditTrigger((n) => n + 1);
  };

  const handleToggleComplete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleComplete(task.id, task.completed || false);
  };

  const isRunningActive = isRunningActiveComputed;

  const baseClasses = cn(
    "flex items-center space-x-3 p-4 rounded-xl transition-all cursor-pointer group",
    isRunningActive ? "hover:bg-orange-50/60" : "hover:bg-blue-50/60",
    "focus:outline-none",
    isRunningActive && "bg-orange-50/70 ring-1 ring-orange-200",
    !isRunningActive && isSelected && "bg-blue-50/60 shadow-sm",
    isTaskCompleted && "opacity-60",
    className
  );

  const compactClasses = cn(
    "flex items-center space-x-3 p-3 rounded-lg transition-all cursor-pointer text-sm group",
    isRunningActive ? "hover:bg-orange-50/50" : "hover:bg-blue-50/50",
    "focus:outline-none",
    isRunningActive && "bg-orange-50/70 ring-1 ring-orange-200",
    !isRunningActive && isSelected && "bg-blue-50/60 shadow-sm",
    isTaskCompleted && "opacity-60",
    className
  );

  const minimalClasses = cn(
    "flex items-center space-x-2 p-2 rounded-lg transition-all cursor-pointer text-sm group",
    isRunningActive ? "hover:bg-orange-50/40" : "hover:bg-blue-50/40",
    isRunningActive && "bg-orange-50/60 ring-1 ring-orange-200",
    !isRunningActive && isSelected && "bg-blue-50/60",
    isTaskCompleted && "opacity-50",
    className
  );

  const containerClasses = variant === 'compact' ? compactClasses : variant === 'minimal' ? minimalClasses : baseClasses;

  return (
    <div
      className={containerClasses}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(task.id);
        }
      }}
      aria-label={`Select task: ${task.title}`}
      aria-selected={isSelected}
      data-testid={`selectable-todo-${task.id}`}
    >

      {/* Selection Indicator - always reserve space to avoid layout shift */}
      <div
        className={cn(
          "w-1 h-6 rounded-full shrink-0",
          isSelected ? "bg-blue-400" : isRunningActive ? "bg-orange-400" : "invisible bg-blue-400"
        )}
        data-testid={`selection-indicator-${task.id}`}
      />
      
      {/* In Progress Indicator removed - only show In Progress when timer is running */}
      {/* Completion Button */}
      <Button
        variant="ghost"
        size={variant === 'minimal' ? 'sm' : 'sm'}
        onClick={handleToggleComplete}
        className="p-0 h-auto shrink-0"
        data-completion-button
        data-testid={`todo-toggle-${task.id}`}
        aria-label={isTaskCompleted ? 'Mark as incomplete' : 'Mark as complete'}
      >
        {isTaskCompleted ? (
          <CheckCircle className="text-green-500 w-4 h-4" />
        ) : (
          <Circle className="text-gray-400 w-4 h-4" />
        )}
      </Button>
      

      {/* Task Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center space-x-2">
          
          <div onClick={(e) => e.stopPropagation()} className="min-w-0" data-testid={`todo-title-${task.id}`}>
            <EditableText
              value={task.title}
              onChange={(newTitle) => {
                // Only update when editing session ends (commit). EditableText calls this on blur/Enter
                if (newTitle && newTitle !== task.title) {
                  onUpdate?.(task.id, { title: newTitle });
                }
              }}
              placeholder={task.title ? undefined : ""}
              className={cn(
                variant === 'minimal' ? "text-sm font-medium" : "font-medium",
                "text-foreground truncate align-middle",
                isTaskCompleted && "line-through"
              )}
              editTrigger={titleEditTrigger}
              autoFocusOnEmpty
            />
            {showUnscheduledBadge && !task.scheduledDate && (
              <Badge variant="outline" className="ml-2 text-[10px] align-middle">Unscheduled</Badge>
            )}
          </div>
          
          {/* Priority removed from UI */}
          
          {/* Timer Status Badge removed for persisted-only display */}
          
          {/* Estimate Indicator */}
          {showEstimate && variant !== 'minimal' && (
            <TaskEstimateIndicator taskId={task.id} className="shrink-0" />
          )}
        </div>
        
        {/* Task Notes Preview */}
        {task.notes && (variant === 'default' || variant === 'compact') && (
          <p className="text-xs text-muted-foreground mt-1 truncate italic" data-testid={`todo-notes-${task.id}`}>
            {task.notes}
          </p>
        )}
        
        {/* Time Logged (always visible; persisted per-task, continues while running) */}
        {showLoggedTime && variant !== 'minimal' && (
          <div className="flex items-center gap-1 mt-1">
            <Clock className="w-3 h-3 text-muted-foreground" />
            <span className="text-xs text-muted-foreground font-mono">
              {formattedPersistedTime}
            </span>
          </div>
        )}
      </div>

      {/* Timer Controls and Time Info */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Timer Button */}
        {showTimer && !isTaskCompleted && (
          <div data-timer-control>
            <TaskTimerButton
              taskId={task.id}
              taskTitle={task.title}
              variant={variant === 'minimal' ? 'icon-only' : 'compact'}
              initialLoggedSeconds={(task as any).timeLoggedSeconds || 0}
            />
          </div>
        )}
        
        {/* Keyboard fallback: Move menu */}
        {enableMoveMenu && onUpdate && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Move task" title="Move task">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onUpdate(task.id, { scheduledDate: new Date() }); }}>Move to Today</DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); const d = new Date(); d.setDate(d.getDate()+1); onUpdate(task.id, { scheduledDate: d }); }}>Move to Tomorrow</DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); const d = new Date(); const day = d.getDay(); const offset = (8 - (day || 7)); d.setDate(d.getDate()+offset); onUpdate(task.id, { scheduledDate: d }); }}>Move to Next Week</DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onUpdate(task.id, { scheduledDate: null }); }}>Unscheduled</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Time and Date Info */}
        {(showTime || showDate) && (
          <div className="text-right">
            {showDate && (
              <p className="text-xs text-muted-foreground" data-testid={`todo-date-${task.id}`}>
                {format(taskStartTime, "MMM d")}
              </p>
            )}
            {showTime && (
              <p 
                className={cn(
                  variant === 'minimal' ? "text-xs" : "text-sm",
                  "font-medium text-foreground"
                )}
                data-testid={`todo-time-${task.id}`}
              >
                {variant === 'minimal' 
                  ? format(taskStartTime, "h:mm a")
                  : formatTimeRange(taskStartTime, taskEndTime)
                }
              </p>
            )}
          </div>
        )}

        {/* Delete Button (only when selected, with confirmation) */}
        {onDelete && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => { e.stopPropagation(); }}
                className={cn(
                  "h-7 w-7 text-muted-foreground hover:text-destructive",
                  isSelected ? "inline-flex" : "hidden"
                )}
                aria-label="Delete task"
                data-testid={`delete-task-${task.id}`}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent onClick={(e) => e.stopPropagation()}>
              <AlertDialogHeader>
                <AlertDialogTitle>Remove from day or delete?</AlertDialogTitle>
                <AlertDialogDescription>
                  Choose Unschedule to keep the task but remove it from this day. Choose Delete to permanently remove the task.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={(e) => e.stopPropagation()}>Cancel</AlertDialogCancel>
                {onUpdate && (
                  <AlertDialogAction
                    onClick={(e) => {
                      e.stopPropagation();
                      onUpdate(task.id, { scheduledDate: null });
                    }}
                    data-testid={`unschedule-task-${task.id}`}
                  >
                    Unschedule
                  </AlertDialogAction>
                )}
                <AlertDialogAction
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete?.(task.id);
                  }}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

    </div>
  );
}