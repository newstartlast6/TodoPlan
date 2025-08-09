import { format } from "date-fns";
import { CheckCircle, Clock, Play, Circle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Task } from "@shared/schema";
import { formatTimeRange } from "@/lib/time-utils";
import { cn } from "@/lib/utils";

interface SelectableTodoItemProps {
  task: Task;
  isSelected: boolean;
  onSelect: (taskId: string) => void;
  onToggleComplete: (taskId: string, completed: boolean) => void;
  variant?: 'default' | 'compact' | 'minimal';
  showTime?: boolean;
  showDate?: boolean;
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
  className,
}: SelectableTodoItemProps) {
  const isTaskCompleted = task.completed;
  const taskStartTime = new Date(task.startTime);
  const taskEndTime = new Date(task.endTime);
  const now = new Date();
  const isTaskCurrent = taskStartTime <= now && taskEndTime >= now && !isTaskCompleted;

  const handleClick = (e: React.MouseEvent) => {
    // Don't trigger selection when clicking the completion button
    if ((e.target as HTMLElement).closest('[data-completion-button]')) {
      return;
    }
    onSelect(task.id);
  };

  const handleToggleComplete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleComplete(task.id, task.completed || false);
  };

  const baseClasses = cn(
    "flex items-center space-x-3 p-3 rounded-lg border transition-all cursor-pointer",
    "hover:bg-accent/50 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
    isSelected && "bg-primary/10 border-primary shadow-sm ring-1 ring-primary/20",
    isTaskCompleted && "opacity-70 bg-muted/30",
    isTaskCurrent && !isSelected && "bg-blue-50 border-blue-200",
    className
  );

  const compactClasses = cn(
    "flex items-center space-x-2 p-2 rounded-md border transition-all cursor-pointer text-sm",
    "hover:bg-accent/50 focus:outline-none focus:ring-1 focus:ring-primary",
    isSelected && "bg-primary/10 border-primary shadow-sm",
    isTaskCompleted && "opacity-60",
    className
  );

  const minimalClasses = cn(
    "flex items-center space-x-2 p-1 rounded transition-all cursor-pointer text-sm",
    "hover:bg-accent/30",
    isSelected && "bg-primary/10",
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
          
          {/* Current Task Badge */}
          {isTaskCurrent && variant !== 'minimal' && (
            <Badge className="text-xs bg-primary text-primary-foreground shrink-0">
              Active
            </Badge>
          )}
        </div>
        
        {/* Task Notes Preview */}
        {task.notes && (variant === 'default' || variant === 'compact') && (
          <p className="text-xs text-muted-foreground mt-1 truncate italic" data-testid={`todo-notes-${task.id}`}>
            {task.notes}
          </p>
        )}
      </div>

      {/* Time and Date Info */}
      {(showTime || showDate) && (
        <div className="text-right shrink-0">
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

      {/* Selection Indicator */}
      {isSelected && (
        <div className="w-1 h-8 bg-primary rounded-full shrink-0" data-testid={`selection-indicator-${task.id}`} />
      )}
    </div>
  );
}