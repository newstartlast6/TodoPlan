import { format } from "date-fns";
import { CheckCircle, Clock, Play, Circle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Task } from "@shared/schema";
import { formatTimeRange } from "@/lib/time-utils";
import { TaskTimerButton } from "@/components/timer/task-timer-button";
import { TaskEstimateIndicator } from "@/components/timer/task-estimation";
import { useTaskTimer } from "@/hooks/use-timer-state";
import { cn } from "@/lib/utils";

interface SelectableTodoItemProps {
  task: Task;
  isSelected: boolean;
  onSelect: (taskId: string) => void;
  onToggleComplete: (taskId: string, completed: boolean) => void;
  variant?: 'default' | 'compact' | 'minimal';
  showTime?: boolean;
  showDate?: boolean;
  showTimer?: boolean;
  showEstimate?: boolean;
  className?: string;
}

export function SelectableTodoItem({
  task,
  isSelected,
  onSelect,
  onToggleComplete,
  variant = 'default',
  showTime = true,
  showDate = false,
  showTimer = true,
  showEstimate = true,
  className,
}: SelectableTodoItemProps) {
  const isTaskCompleted = task.completed;
  const taskStartTime = new Date(task.startTime);
  const taskEndTime = new Date(task.endTime);
  const now = new Date();
  const isTaskCurrent = taskStartTime <= now && taskEndTime >= now && !isTaskCompleted;
  
  // Timer integration
  const { isActiveTask, isRunning, formattedTotalTime } = useTaskTimer(task.id);

  const handleClick = (e: React.MouseEvent) => {
    // Don't trigger selection when clicking the completion button or timer controls
    if ((e.target as HTMLElement).closest('[data-completion-button]') ||
        (e.target as HTMLElement).closest('[data-timer-control]')) {
      return;
    }
    onSelect(task.id);
  };

  const handleToggleComplete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleComplete(task.id, task.completed || false);
  };

  const baseClasses = cn(
    "flex items-center space-x-3 p-4 rounded-xl transition-all cursor-pointer group",
    "hover:bg-blue-50/60 focus:outline-none",
    isSelected && "bg-blue-50/60 shadow-sm",
    isTaskCompleted && "opacity-60",
    isTaskCurrent && !isSelected && "bg-orange-50/60",
    className
  );

  const compactClasses = cn(
    "flex items-center space-x-3 p-3 rounded-lg transition-all cursor-pointer text-sm group",
    "hover:bg-blue-50/50 focus:outline-none",
    isSelected && "bg-blue-50/60 shadow-sm",
    isTaskCompleted && "opacity-60",
    isTaskCurrent && !isSelected && "bg-orange-50/60",
    className
  );

  const minimalClasses = cn(
    "flex items-center space-x-2 p-2 rounded-lg transition-all cursor-pointer text-sm group",
    "hover:bg-blue-50/40",
    isSelected && "bg-blue-50/60",
    isTaskCompleted && "opacity-50",
    isTaskCurrent && !isSelected && "bg-orange-50/60",
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
        ) : isTaskCurrent ? (
          <Play className="text-primary w-4 h-4" />
        ) : (
          <Circle className="text-gray-400 w-4 h-4" />
        )}
      </Button>

      {/* Task Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center space-x-2">
          <h4 
            className={cn(
              variant === 'minimal' ? "text-sm font-medium" : "font-medium",
              "text-foreground truncate",
              isTaskCompleted && "line-through"
            )}
            data-testid={`todo-title-${task.id}`}
          >
            {task.title}
          </h4>
          
          {/* Priority Badge */}
          {task.priority === 'high' && variant !== 'minimal' && (
            <Badge variant="destructive" className="text-xs shrink-0">
              High
            </Badge>
          )}
          
          {/* Timer Status Badge */}
          {isActiveTask && variant !== 'minimal' && (
            <Badge className={cn(
              "text-xs shrink-0",
              isRunning 
                ? "bg-green-100 text-green-800 border-green-300" 
                : "bg-yellow-100 text-yellow-800 border-yellow-300"
            )}>
              {isRunning ? 'Timer Running' : 'Timer Paused'}
            </Badge>
          )}
          
          {/* Current Task Badge */}
          {isTaskCurrent && !isActiveTask && variant !== 'minimal' && (
            <Badge className="text-xs bg-primary text-primary-foreground shrink-0">
              Active
            </Badge>
          )}
          
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
        
        {/* Timer Total Time */}
        {showTimer && formattedTotalTime !== '0:00' && variant !== 'minimal' && (
          <div className="flex items-center gap-1 mt-1">
            <Clock className="w-3 h-3 text-gray-500" />
            <span className="text-xs text-gray-600 font-mono">
              {formattedTotalTime} today
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
            />
          </div>
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
      </div>

      {/* Selection Indicator */}
      {isSelected && (
        <div className="w-1 h-6 bg-blue-400 rounded-full shrink-0" data-testid={`selection-indicator-${task.id}`} />
      )}
      
      {/* In Progress Indicator */}
      {isTaskCurrent && !isSelected && (
        <div className="w-1 h-6 bg-orange-400 rounded-full shrink-0" data-testid={`progress-indicator-${task.id}`} />
      )}
    </div>
  );
}