import { X, Calendar, Clock, Timer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useSelectedTodo } from "@/hooks/use-selected-todo";
import { NotesEditor } from "@/components/calendar/notes-editor";
import { TimePicker } from "@/components/calendar/time-picker";
import { TaskTimerButton } from "@/components/timer/task-timer-button";
import { useTimerActions } from "@/hooks/use-timer-state";
import { TaskEstimation } from "@/components/timer/task-estimation";
import { useTaskTimer, useTimerState } from "@/hooks/use-timer-state";
import { Task, UpdateTask } from "@shared/schema";
import { format, isBefore } from "date-fns";
import { formatTimeRange } from "@/lib/time-utils";
import { cn } from "@/lib/utils";
import { listsKeys } from "@/hooks/use-lists";
import { TimerCalculator } from "@shared/services/timer-service";

interface TodoDetailPaneProps {
  onClose?: () => void;
  className?: string;
}

export function TodoDetailPane({ onClose, className }: TodoDetailPaneProps) {
  const { selectedTodoId, closeDetailPane } = useSelectedTodo();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Timer integration
  const { activeSession, isTimerRunning, currentTaskId } = useTimerState();
  const { stopTimer } = useTimerActions();
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
    // Keep showing current data between updates for smoother UX
    staleTime: 0,
    gcTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    refetchOnMount: false,
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
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['task', selectedTodoId] });
      queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });

      // Invalidate lists cache to refresh counts if needed
      queryClient.invalidateQueries({ queryKey: listsKeys.lists() });

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

  const handleResetLoggedTime = async () => {
    if (!selectedTodoId) return;
    const confirm = window.confirm("Reset this task's logged time to 0:00? This cannot be undone.");
    if (!confirm) return;

    try {
      // If this task has the active timer, stop it first to avoid re-adding time later
      if (activeSession && activeSession.taskId === selectedTodoId && (isTimerRunning || activeSession.isActive)) {
        await stopTimer();
      }

      // Reset persisted seconds to 0
      await fetch(`/api/tasks/${selectedTodoId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timeLoggedSeconds: 0 }),
      });

      // Update caches so UI reflects 0:00 immediately
      queryClient.setQueryData<Task | null>(['task', selectedTodoId], (old) => old ? { ...old, timeLoggedSeconds: 0 as any } as Task : old as any);
      queryClient.setQueriesData({ queryKey: ['/api/tasks'] }, (old: Task[] | undefined) => Array.isArray(old) ? old.map(t => t.id === selectedTodoId ? ({ ...t, timeLoggedSeconds: 0 as any }) : t) : old);

      toast({ title: 'Time reset', description: 'Logged time has been reset to 0:00.' });
    } catch (e) {
      toast({ title: 'Failed to reset time', description: e instanceof Error ? e.message : 'Please try again.', variant: 'destructive' });
    }
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



  return (
    <div className={cn("h-full flex flex-col bg-surface", className)} data-testid="todo-detail-pane">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-border bg-gradient-to-b from-muted/20 to-transparent">
        <div className="flex items-center space-x-3 flex-1 min-w-0">
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold text-foreground truncate" data-testid="todo-detail-title">
              {selectedTask.title}
            </h2>
            <div className="flex items-center space-x-2 mt-1">
              {isActiveTask && isTimerRunning ? (
                <Badge className="text-xs bg-orange-500 text-white ring-1 ring-orange-600/20">In Progress</Badge>
              ) : null}
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
          {/* Notes Section - moved to top under title */}
          <div className="rounded-xl border border-border/50 bg-card/50 p-4">
            <h4 className="text-xs tracking-wide uppercase text-muted-foreground mb-3">Notes</h4>
            <NotesEditor
              taskId={selectedTask.id}
              initialNotes={selectedTask.notes || ""}
              placeholder="Jot quick notes..."
              className="min-h-[120px]"
            />
          </div>

          {/* Schedule removed from UI */}

          {/* Time Tracking */}
          {!selectedTask.completed && (
            <div className="rounded-xl border border-border/50 bg-card/50 p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs tracking-wide uppercase text-muted-foreground flex items-center gap-2">
                  <Timer className="w-4 h-4" />
                  Time Tracking
                </h4>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleResetLoggedTime}
                    className="h-8"
                  >
                    Reset to 0:00
                  </Button>
                  <TaskTimerButton
                    taskId={selectedTask.id}
                    taskTitle={selectedTask.title}
                    variant="default"
                  />
                </div>
              </div>

              {/* Remove separate session display to avoid dual values */}

              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs font-medium text-muted-foreground mb-1">
                  Time Logged
                </div>
                <div className="text-lg font-mono font-semibold text-foreground">
                  {(() => {
                    const persisted = (selectedTask as any).timeLoggedSeconds || 0;
                    // If this is the active session (running or paused), trust the session's durationSeconds
                    if (activeSession && activeSession.taskId === selectedTodoId) {
                      return TimerCalculator.formatDuration(activeSession.durationSeconds || 0);
                    }
                    return TimerCalculator.formatDuration(persisted);
                  })()}
                </div>
                {taskTimer.sessionCount > 1 && (
                  <div className="text-xs text-muted-foreground">
                    {taskTimer.sessionCount} sessions today
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Estimation & Properties */}
          <div className="rounded-xl border border-border/50 bg-card/50 p-4 space-y-4">
            {!selectedTask.completed && (
              <TaskEstimation
                taskId={selectedTask.id}
                taskTitle={selectedTask.title}
                compact
              />
            )}

            <Separator />

            <div className="grid gap-4">
              {/* Time pickers removed from UI */}

              <Separator />

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Status</span>
                  {isActiveTask && isTimerRunning ? (
                    <Badge className="text-xs bg-orange-500 text-white ring-1 ring-orange-600/20">In Progress</Badge>
                  ) : null}
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