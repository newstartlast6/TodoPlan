import { X, Calendar, Clock, Flag, Timer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useSelectedTodo } from "@/hooks/use-selected-todo";
import { NotesEditor } from "@/components/calendar/notes-editor";
import { PrioritySelector } from "@/components/calendar/priority-selector";
import { TimePicker } from "@/components/calendar/time-picker";
import { TaskTimerButton } from "@/components/timer/task-timer-button";
import { TaskEstimation } from "@/components/timer/task-estimation";
import { TimerDisplay } from "@/components/timer/timer-display";
import { useTaskTimer, useTimerState } from "@/hooks/use-timer-state";
import { Task, UpdateTask } from "@shared/schema";
import { format, isBefore } from "date-fns";
import { formatTimeRange } from "@/lib/time-utils";
import { cn } from "@/lib/utils";

interface TodoDetailPaneProps {
  onClose?: () => void;
  className?: string;
}

export function TodoDetailPane({ onClose, className }: TodoDetailPaneProps) {
  const { selectedTodoId, closeDetailPane } = useSelectedTodo();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Timer integration
  const { activeSession } = useTimerState();
  const taskTimer = useTaskTimer(selectedTodoId || '');
  const isActiveTask = activeSession?.taskId === selectedTodoId;

  // Fetch the selected task details
  const { data: selectedTask, isLoading, error } = useQuery<Task>({
    queryKey: ['task', selectedTodoId],
    queryFn: async () => {
      if (!selectedTodoId) return null;
      const response = await fetch(`/api/tasks/${selectedTodoId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch task');
      }
      return response.json();
    },
    enabled: !!selectedTodoId,
  });

  // Update task mutation
  const updateTaskMutation = useMutation({
    mutationFn: async (updates: UpdateTask): Promise<Task> => {
      if (!selectedTodoId) throw new Error('No task selected');
      const response = await fetch(`/api/tasks/${selectedTodoId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        throw new Error(`Failed to update task: ${response.statusText}`);
      }

      return response.json();
    },
    onMutate: async (updates) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['task', selectedTodoId] });
      await queryClient.cancelQueries({ queryKey: ['/api/tasks'] });

      // Snapshot the previous value
      const previousTask = queryClient.getQueryData(['task', selectedTodoId]);
      const previousTasks = queryClient.getQueryData(['/api/tasks']);

      // Optimistically update the cache
      if (selectedTask) {
        const updatedTask = { ...selectedTask, ...updates };
        queryClient.setQueryData(['task', selectedTodoId], updatedTask);

        // Update tasks list cache
        queryClient.setQueriesData(
          { queryKey: ['/api/tasks'] },
          (old: Task[] | undefined) => {
            if (!old) return old;
            return old.map(task =>
              task.id === selectedTodoId ? updatedTask : task
            );
          }
        );
      }

      return { previousTask, previousTasks };
    },
    onSuccess: (updatedTask) => {
      toast({
        title: "Task updated",
        description: "Your changes have been saved successfully.",
      });
    },
    onError: (error, variables, context) => {
      // Rollback optimistic updates
      if (context?.previousTask) {
        queryClient.setQueryData(['task', selectedTodoId], context.previousTask);
      }
      if (context?.previousTasks) {
        queryClient.setQueriesData({ queryKey: ['/api/tasks'] }, context.previousTasks);
      }

      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update task",
        variant: "destructive",
      });
    },
  });

  const handleClose = () => {
    onClose?.();
    closeDetailPane();
  };

  // Validation and update handlers
  const validateTimeRange = (startTime: Date, endTime: Date): string | null => {
    if (isBefore(endTime, startTime)) {
      return "End time must be after start time";
    }
    return null;
  };

  const handlePriorityChange = (priority: 'low' | 'medium' | 'high') => {
    updateTaskMutation.mutate({ priority });
  };

  const handleStartTimeChange = (startTime: Date) => {
    if (!selectedTask) return;

    const endTime = new Date(selectedTask.endTime);
    const validationError = validateTimeRange(startTime, endTime);

    if (validationError) {
      toast({
        title: "Invalid time range",
        description: validationError,
        variant: "destructive",
      });
      return;
    }

    updateTaskMutation.mutate({ startTime });
  };

  const handleEndTimeChange = (endTime: Date) => {
    if (!selectedTask) return;

    const startTime = new Date(selectedTask.startTime);
    const validationError = validateTimeRange(startTime, endTime);

    if (validationError) {
      toast({
        title: "Invalid time range",
        description: validationError,
        variant: "destructive",
      });
      return;
    }

    updateTaskMutation.mutate({ endTime });
  };

  // Empty state when no task is selected
  if (!selectedTodoId) {
    return (
      <div className={cn("h-full flex flex-col", className)} data-testid="todo-detail-empty">
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center">
            <Calendar className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">No task selected</h3>
            <p className="text-muted-foreground">
              Select a task from the calendar to view and edit its details
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className={cn("h-full flex flex-col", className)} data-testid="todo-detail-loading">
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading task details...</p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !selectedTask) {
    return (
      <div className={cn("h-full flex flex-col", className)} data-testid="todo-detail-error">
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center">
            <X className="mx-auto h-12 w-12 text-destructive mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">Failed to load task</h3>
            <p className="text-muted-foreground mb-4">
              The selected task could not be loaded. It may have been deleted.
            </p>
            <Button variant="outline" onClick={handleClose}>
              Close
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-red-600 bg-red-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      case 'low': return 'text-green-600 bg-green-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getPriorityIcon = (priority: string) => {
    return <Flag className="w-4 h-4" />;
  };

  return (
    <div className={cn("h-full flex flex-col bg-surface", className)} data-testid="todo-detail-pane">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-border">
        <div className="flex items-center space-x-3 flex-1 min-w-0">
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold text-foreground truncate" data-testid="todo-detail-title">
              {selectedTask.title}
            </h2>
            <div className="flex items-center space-x-2 mt-1">
              <Badge
                variant="secondary"
                className={cn("text-xs", getPriorityColor(selectedTask.priority))}
                data-testid="todo-detail-priority"
              >
                {getPriorityIcon(selectedTask.priority)}
                <span className="ml-1 capitalize">{selectedTask.priority} Priority</span>
              </Badge>
              {selectedTask.completed && (
                <Badge variant="default" className="text-xs bg-green-600 text-white">
                  Completed
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Close button - only show if onClose is provided (for mobile/tablet) */}
        {onClose && (
          <Button
            variant="ghost"
            size="icon"
            onClick={handleClose}
            className="h-8 w-8 shrink-0"
            data-testid="todo-detail-close"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Content - Single scroll container */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 space-y-6">
          {/* Timer Section */}
          {!selectedTask.completed && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
                  <Timer className="w-4 h-4" />
                  Time Tracking
                </h4>
                <TaskTimerButton
                  taskId={selectedTask.id}
                  taskTitle={selectedTask.title}
                  variant="default"
                />
              </div>
              
              {/* Active Timer Display */}
              {isActiveTask && (
                <div className="mb-4">
                  <TimerDisplay compact />
                </div>
              )}
              
              {/* Time Summary */}
              {taskTimer.totalTimeSeconds > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                  <div className="text-sm font-medium text-blue-900 mb-1">
                    Time Logged Today
                  </div>
                  <div className="text-lg font-mono font-bold text-blue-800">
                    {taskTimer.formattedTotalTime}
                  </div>
                  {taskTimer.sessionCount > 1 && (
                    <div className="text-xs text-blue-700">
                      {taskTimer.sessionCount} sessions
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Task Estimation */}
          {!selectedTask.completed && (
            <div>
              <TaskEstimation
                taskId={selectedTask.id}
                taskTitle={selectedTask.title}
                compact
              />
            </div>
          )}

          {/* Basic Info Section */}
          <div>
            <Separator className="mb-4" />
            <h4 className="text-sm font-medium text-foreground mb-3">Schedule</h4>
            {/* Time Information */}
            <div className="flex items-center space-x-3">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium text-foreground" data-testid="todo-detail-time">
                  {formatTimeRange(new Date(selectedTask.startTime), new Date(selectedTask.endTime))}
                </p>
                <p className="text-xs text-muted-foreground" data-testid="todo-detail-date">
                  {format(new Date(selectedTask.startTime), "EEEE, MMMM d, yyyy")}
                </p>
              </div>
            </div>
          </div>

          {/* Notes Section */}
          <div>
            <Separator className="mb-4" />
            <h4 className="text-sm font-medium text-foreground mb-3">Notes</h4>
            <div className="min-h-[120px]">
              <NotesEditor
                taskId={selectedTask.id}
                initialNotes={selectedTask.notes || ""}
                placeholder="Add notes to this task..."
                className="min-h-[120px]"
              />
            </div>
          </div>

          {/* Task Properties */}
          <div>
            <Separator className="mb-4" />
            <h4 className="text-sm font-medium text-foreground mb-4">Task Properties</h4>
            <div className="space-y-4">
              {/* Priority Selector */}
              <div>
                <PrioritySelector
                  value={selectedTask.priority as 'low' | 'medium' | 'high'}
                  onChange={handlePriorityChange}
                  disabled={updateTaskMutation.isPending}
                />
              </div>

              {/* Time Pickers */}
              <div className="space-y-3">
                <TimePicker
                  label="Start Time"
                  value={new Date(selectedTask.startTime)}
                  onChange={handleStartTimeChange}
                  disabled={updateTaskMutation.isPending}
                />

                <TimePicker
                  label="End Time"
                  value={new Date(selectedTask.endTime)}
                  onChange={handleEndTimeChange}
                  disabled={updateTaskMutation.isPending}
                />
              </div>

              {/* Read-only properties */}
              <Separator />
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Status</span>
                  <Badge variant={selectedTask.completed ? "default" : "secondary"} className="text-xs">
                    {selectedTask.completed ? "Completed" : "In Progress"}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Created</span>
                  <span className="text-xs text-muted-foreground">
                    {selectedTask.createdAt && format(new Date(selectedTask.createdAt), "MMM d, yyyy")}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}