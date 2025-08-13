import { format, isToday } from "date-fns";
import { useEffect, useRef, useState } from "react";
import { CheckCircle, Clock, Circle, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Task } from "@shared/schema";
import { formatTimeRange } from "@/lib/time-utils";
import { TaskTimerButton } from "@/components/timer/task-timer-button";
import { TaskEstimateIndicator } from "@/components/timer/task-estimation";
import { useTimerStore } from "@/hooks/use-timer-store";
import { cn } from "@/lib/utils";
import { EditableText } from "@/components/ui/editable-text";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreVertical } from "lucide-react";
import { TimerCalculator } from "@shared/services/timer-store";
import { useLists } from "@/hooks/use-lists";
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
  variant?: 'default' | 'compact' | 'minimal' | 'list';
  showTime?: boolean;
  showDate?: boolean;
  showTimer?: boolean;
  // Whether to show the small "time logged today" row under the title
  showLoggedTime?: boolean;
  showEstimate?: boolean;
  // Show the list chip (emoji + name) when task has a list
  showListChip?: boolean;
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
  showListChip = true,
  className,
  startEditing = false,
  enableMoveMenu = false,
  showUnscheduledBadge = false,
}: SelectableTodoItemProps) {
  const isTaskCompleted = task.completed;
  const taskStartTime = new Date(task.startTime);
  const taskEndTime = new Date(task.endTime);
  const [titleEditTrigger, setTitleEditTrigger] = useState(0);
  const { data: allLists = [] } = useLists();
  const listInfo = (task as any).listId ? allLists.find(l => l.id === (task as any).listId) : null;
  const ListChip = showListChip && listInfo ? (
    <span className="inline-flex items-center gap-1 text-[10px] text-slate-600 max-w-[140px] truncate">
      <span className="leading-none">{listInfo.emoji}</span>
      <span className="truncate">{listInfo.name}</span>
    </span>
  ) : null;
  
  // If parent asks to start editing, bump the trigger
  useEffect(() => {
    if (startEditing) {
      setTitleEditTrigger((n) => n + 1);
    }
  }, [startEditing]);
  
  // Timer integration
  // Show while running: current session total (seeded base + elapsed)
  // When paused: show persisted total
  const timer = useTimerStore();
  const isActiveTask = timer.activeTaskId === task.id;
  const isRunning = timer.isRunning && isActiveTask;
  const persistedSeconds = (task as any).timeLoggedSeconds || 0;
  const displaySeconds = isActiveTask && isRunning ? (timer.displaySeconds || 0) : persistedSeconds;
  const formattedPersistedTime = TimerCalculator.formatDuration(displaySeconds);
  const hasLoggedTime = (displaySeconds || 0) > 0;

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

  const isRunningActive = isRunning;

  const baseClasses = cn(
    "flex items-center space-x-3 p-4 rounded-xl transition-all cursor-pointer group",
    isRunningActive ? "hover:bg-orange-50/60" : "hover:bg-blue-50/60",
    "focus:outline-none",
    isRunningActive && "bg-orange-50/70 ring-1 ring-orange-200 border border-orange-400",
    !isRunningActive && isSelected && "bg-blue-50/60 shadow-sm",
    isTaskCompleted && "opacity-60",
    className
  );

  const compactClasses = cn(
    "flex items-center space-x-3 p-3 rounded-lg transition-all cursor-pointer text-sm group",
    isRunningActive ? "hover:bg-orange-50/50" : "hover:bg-blue-50/50",
    "focus:outline-none",
    isRunningActive && "bg-orange-50/70 ring-1 ring-orange-200 border border-orange-400",
    !isRunningActive && isSelected && "bg-blue-50/60 shadow-sm",
    isTaskCompleted && "opacity-60",
    className
  );

  const minimalClasses = cn(
    "flex items-center space-x-2 p-2 rounded-lg transition-all cursor-pointer text-sm group",
    isRunningActive ? "hover:bg-orange-50/40" : "hover:bg-blue-50/40",
    isRunningActive && "bg-orange-50/60 ring-1 ring-orange-200 border border-orange-400",
    !isRunningActive && isSelected && "bg-blue-50/60",
    isTaskCompleted && "opacity-50",
    className
  );

  const listClasses = cn(
    "group flex items-center space-x-4 p-4 rounded-lg transition-all cursor-pointer",
    isSelected ? "bg-orange-50 border-l-4 border-orange-500" : "hover:bg-gray-50",
    isRunningActive && "border border-orange-400",
    isTaskCompleted && "opacity-75",
    className
  );

  const containerClasses =
    variant === 'compact'
      ? compactClasses
      : variant === 'minimal'
      ? minimalClasses
      : variant === 'list'
      ? listClasses
      : baseClasses;

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

      {/* For list variant we do not show the left selection bar */}
      {variant !== 'list' && (
        <div
          className={cn(
            "w-1 h-6 rounded-full shrink-0",
            isSelected ? "bg-blue-400" : isRunningActive ? "bg-orange-400" : "invisible bg-blue-400"
          )}
          data-testid={`selection-indicator-${task.id}`}
        />
      )}
      
      {/* In Progress Indicator removed - only show In Progress when timer is running */}
      {/* Completion Button */}
      {variant === 'list' ? (
        <button
          onClick={handleToggleComplete}
          className={cn(
            "w-5 h-5 rounded-full flex items-center justify-center ",
            isTaskCompleted ? "" : "border-2 border-gray-300 hover:border-orange-500"
          )}
          data-completion-button
          data-testid={`todo-toggle-${task.id}`}
          aria-label={isTaskCompleted ? 'Mark as incomplete' : 'Mark as complete'}
        >
          {isTaskCompleted && <CheckCircle className="text-green-500 w-4 h-4" /> }
        </button>
      ) : (
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
      )}
      

      {/* Task Content */}
      <div className="flex-1 min-w-0">
        {variant === 'list' ? (
          <div>
            <div className="flex items-center space-x-2">
              <div onClick={(e) => e.stopPropagation()} className="min-w-0" data-testid={`todo-title-${task.id}`}>
                <EditableText
                  value={task.title}
                  onChange={(newTitle) => {
                    if (newTitle && newTitle !== task.title) {
                      onUpdate?.(task.id, { title: newTitle });
                    }
                  }}
                  onStartEditing={() => {
                    if (!isSelected) onSelect(task.id);
                  }}
                  placeholder={task.title ? undefined : ""}
                  className={cn("font-medium text-gray-900 truncate align-middle", isTaskCompleted && "line-through")}
                  editTrigger={titleEditTrigger}
                  autoFocusOnEmpty
                />
                {isRunning && (
                  <Badge className="mt-1 ml-2 inline-flex items-center gap-1 text-[10px] bg-orange-100 text-orange-700 ring-1 ring-orange-300">
                    In Progress
                  </Badge>
                )}
              </div>              
            </div>
            {task.notes ? (
              <p className="text-xs text-muted-foreground mt-1 truncate italic" data-testid={`todo-notes-${task.id}`}>{task.notes}</p>
            ) : task.description ? (
              <p className="text-sm text-gray-500 mb-2 mt-1 truncate">{task.description}</p>
            ) : null}
            <div className="flex items-center space-x-3 text-xs text-gray-500 mt-1">
              {ListChip && (
                <div className="flex items-center pr-2 border-r border-slate-200">
                  {ListChip}
                </div>
              )}
              {showUnscheduledBadge && !task.scheduledDate ? (
                <Badge
                  variant="outline"
                  className="inline-flex align-middle text-[10px] tracking-wide bg-gradient-to-r from-slate-50 to-slate-100 border border-slate-200 text-slate-700 shadow-sm hover:from-slate-100 hover:to-white hover:shadow transition-colors duration-200 rounded-full px-2.5 py-0.5"
                >
                  <span className="inline-flex items-center gap-1">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-slate-400 animate-pulse" />
                    Unscheduled
                  </span>
                </Badge>
              ) : (
                <div className="flex items-center space-x-1">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                  </svg>
                  <span>
                    {isToday(taskStartTime) ? 'Today' : format(taskStartTime, 'MMM d')}
                  </span>
                </div>
              )}
              <div className="flex items-center space-x-1">
                <span
                  className={cn(
                    "w-2 h-2 rounded-full",
                    task.priority === 'high' ? 'bg-red-400' : task.priority === 'medium' ? 'bg-yellow-400' : 'bg-green-500'
                  )}
                />
                <span>
                  {task.priority ? `${task.priority[0].toUpperCase()}${task.priority.slice(1)} Priority` : 'Priority'}
                </span>
              </div>              
              <div className="flex items-center space-x-1">
                {hasLoggedTime && (
                  <span className="inline-flex items-center gap-1">
                    <Clock className={cn("w-3 h-3", isRunning ? "text-orange-600" : undefined)} />
                    <span className={cn("font-medium", isRunning ? "text-orange-700" : undefined)}>{formattedPersistedTime}</span>
                  </span>
                )}
              </div>          
            </div>
          </div>
        ) : (
          <>
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
                  onStartEditing={() => {
                    if (!isSelected) onSelect(task.id);
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
                {isRunning && (
                  <Badge className="ml-2 inline-flex items-center gap-1 text-[10px] bg-orange-100 text-orange-700 ring-1 ring-orange-300">
                    In Progress
                  </Badge>
                )}
                {showUnscheduledBadge && !task.scheduledDate && (
                  <Badge
                    variant="outline"
                    className="ml-2 align-middle text-[10px] tracking-wide bg-gradient-to-r from-slate-50 to-slate-100 border border-slate-200 text-slate-700 shadow-sm hover:from-slate-100 hover:to-white hover:shadow transition-colors duration-200 rounded-full px-2.5 py-0.5"
                  >
                    <span className="inline-flex items-center gap-1">
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-slate-400 animate-pulse" />
                      Unscheduled
                    </span>
                  </Badge>
                )}
              </div>
              {ListChip && (
                <div className="hidden sm:inline-flex items-center pl-2 ml-1 border-l border-slate-200">
                  {ListChip}
                </div>
              )}
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
            {showLoggedTime && variant !== 'minimal' && hasLoggedTime && (
              <div className="flex items-center gap-4 mt-1">
                <Clock className={cn("w-3 h-3", isRunning ? "text-orange-600" : "text-muted-foreground")} />
                <span className={cn("text-xs font-mono", isRunning ? "text-orange-700" : "text-muted-foreground")}>
                  {formattedPersistedTime}
                </span>
              </div>
            )}
          </>
        )}
      </div>

      {/* Timer Controls and Time Info */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Timer Button */}
        {showTimer && !isTaskCompleted && (
          <div
            data-timer-control
            className={cn(
              "shrink-0 transition-opacity",
              isRunningActive ? "opacity-100" : (isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100")
            )}
          >
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
        {variant !== 'list' && (showTime || showDate) && (
          <div className="text-right">
            {showUnscheduledBadge && !task.scheduledDate ? (
              <Badge
                variant="outline"
                className="bg-blue-100 text-blue-800 text-xs font-medium me-2 px-2.5 py-0.5 rounded-sm dark:bg-blue-900 dark:text-blue-300"
              >
                <span className="inline-flex items-center gap-1">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-slate-400 animate-pulse" />
                  Unscheduled
                </span>
              </Badge>
            ) : (
              <>
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
              </>
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
                  "h-7 w-7 text-muted-foreground hover:text-destructive transition-opacity",
                  isSelected ? "inline-flex opacity-100" : "hidden group-hover:inline-flex group-hover:opacity-100 opacity-0"
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