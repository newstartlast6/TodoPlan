import { X, Calendar, Timer, StickyNote, Target, Clock, Flag, Folder } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useSelectedTodo } from "@/hooks/use-selected-todo";
import { NotesEditor } from "@/components/calendar/notes-editor";
import { TaskTimerButton } from "@/components/timer/task-timer-button";
import { TaskEstimation } from "@/components/timer/task-estimation";
import { useTimerStore } from "@/hooks/use-timer-store";
import { Task, UpdateTask } from "@shared/schema";
import { format, isBefore } from "date-fns";
import { cn } from "@/lib/utils";
import { listsKeys, useLists } from "@/hooks/use-lists";
import { TimerCalculator } from "@shared/services/timer-store";
import { ProgressRing } from "@/components/ui/progress-ring";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
  
interface TodoDetailPaneProps {
  onClose?: () => void;
  className?: string;
}
  
export function TodoDetailPane({ onClose, className }: TodoDetailPaneProps) {
  const { selectedTodoId, closeDetailPane } = useSelectedTodo();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Timer integration (sessionless)
  const timer = useTimerStore();
  const isActiveTask = timer.activeTaskId === selectedTodoId && timer.isRunning;
  const isTimerRunning = timer.isRunning;
  const liveSessionSeconds = isActiveTask ? (timer.displaySeconds || 0) : 0;
  
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

  // Load all lists to support project selection and details
  const { data: lists = [] } = useLists();

  // Load existing estimate for inline picker
  const { data: estimateData } = useQuery<{ estimate?: { estimatedDurationMinutes: number } }>({
    queryKey: ['task', selectedTodoId, 'estimate'],
    queryFn: async () => {
      if (!selectedTodoId) return {} as any;
      const res = await fetch(`/api/tasks/${selectedTodoId}/estimate`);
      if (!res.ok) return {} as any;
      return res.json();
    },
    enabled: !!selectedTodoId,
    staleTime: 0,
  });

  const estimateMinutes = estimateData?.estimate?.estimatedDurationMinutes;
  
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

  // Estimation editing handled inside TaskEstimation (popover)

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
      if (timer.activeTaskId === selectedTodoId && timer.isRunning) {
        await timer.stop();
      }

      // Reset persisted seconds to 0 via idempotent time-logged endpoint
      await fetch(`/api/tasks/${selectedTodoId}/time-logged`, {
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

  // If a review is selected, render ReviewForm in-place
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
      <div className="flex items-center justify-between p-6 border-b border-border bg-gradient-to-b from-muted/40 to-transparent">
        <div className="flex items-center space-x-3 flex-1 min-w-0">
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-semibold text-foreground break-words flex items-center gap-2" data-testid="todo-detail-title">
              {selectedTask.title}
              {isActiveTask && isTimerRunning ? (
                <span className="inline-flex items-center">
                  <span className="w-2.5 h-2.5 rounded-full bg-orange-500 shadow-[0_0_0_3px_rgba(251,146,60,0.25)] animate-pulse" />
                </span>
              ) : null}
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
        <div className="p-6 space-y-12">
          {/* Notes */}
          <div className="space-y-3 rounded-2xl p-5 -mx-3 sm:mx-0">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-md bg-yellow-100">
                <StickyNote className="w-4 h-4 text-yellow-600" />
              </div>
              <h4 className="text-sm font-medium text-foreground">Notes</h4>
            </div>
            <NotesEditor
              taskId={selectedTask.id}
              initialNotes={selectedTask.notes || ""}
              placeholder="Capture thoughts, plans, or links..."
              className="min-h-[170px] bg-transparent"
            />
          </div>

          {/* Time Tracking */}
          {!selectedTask.completed && (
            <div className="rounded-2xl border border-border/60 bg-gradient-to-br from-orange-50/60 to-transparent p-4 shadow-sm backdrop-blur-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-md bg-orange-100">
                    <Timer className="w-4 h-4 text-orange-600" />
                  </div>
                  <h4 className="text-sm font-medium text-foreground">Time Tracking</h4>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    onClick={handleResetLoggedTime}
                    className="h-9 border-red-200 text-red-600 hover:bg-red-50"
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
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
                <div className="rounded-xl bg-muted/20 p-4 flex items-center justify-between sm:col-span-2">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center justify-center p-1.5 rounded-md bg-orange-100">
                      <Clock className="w-4 h-4 text-orange-600" />
                    </span>
                    <div>
                      <div className="text-xs font-medium text-muted-foreground">Time Logged</div>
                      <div className="mt-0.5 flex items-center gap-2">
                        <div className="text-3xl font-mono font-semibold tabular-nums text-foreground">
                          {(() => {
                            const persisted = (selectedTask as any).timeLoggedSeconds || 0;
                            if (isActiveTask) {
                              return TimerCalculator.formatDuration(timer.displaySeconds || 0);
                            }
                            return TimerCalculator.formatDuration(persisted);
                          })()}
                        </div>
                        {isActiveTask && isTimerRunning ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 text-[10px] font-semibold uppercase tracking-wide animate-pulse">
                            Live
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
                {typeof estimateMinutes === 'number' && estimateMinutes > 0 ? (
                  <div className="flex items-center justify-center">
                    {(() => {
                      const persisted = (selectedTask as any).timeLoggedSeconds || 0;
                      const totalSeconds = persisted + liveSessionSeconds;
                      const progress = Math.min(100, (totalSeconds / (estimateMinutes * 60)) * 100);
                      return (
                        <div className="flex flex-col items-center gap-2">
                          <ProgressRing progress={progress} size={64} />
                          <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                            <Target className="w-3 h-3" />
                            <span>{Math.round(progress)}%</span>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                ) : null}
              </div>
            </div>
          )}

          {/* Estimate & Details */}
          <div className="rounded-2xl border border-border/60 bg-background/40 p-4 space-y-4 shadow-sm">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-md bg-sky-100">
                <Target className="w-4 h-4 text-sky-600" />
              </div>
              <h4 className="text-sm font-medium text-foreground">Estimate & Details</h4>
            </div>
            {!selectedTask.completed && (
              <TaskEstimation taskId={selectedTask.id} taskTitle={selectedTask.title} compact />
            )}
            <Separator />
            <div className="space-y-3">
              {/* Priority (editable) */}
              <div className="rounded-lg bg-muted/20 p-3 hover:bg-muted/30 transition-colors">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="inline-flex items-center justify-center p-1 rounded-md bg-amber-100">
                    <Flag className="w-3.5 h-3.5 text-amber-600" />
                  </span>
                  Priority
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <span
                    className={cn(
                      "w-2 h-2 rounded-full",
                      selectedTask.priority === 'high'
                        ? 'bg-red-500'
                        : selectedTask.priority === 'medium'
                        ? 'bg-yellow-500'
                        : 'bg-green-500'
                    )}
                    aria-hidden
                  />
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="h-8">
                        {selectedTask.priority ? `${selectedTask.priority[0].toUpperCase()}${selectedTask.priority.slice(1)} Priority` : 'Set Priority'}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-40">
                      {(['high','medium','low'] as const).map((p) => (
                        <DropdownMenuItem key={p} onClick={() => updateTaskMutation.mutate({ priority: p as any })}>
                          <span
                            className={cn(
                              "inline-block w-2 h-2 rounded-full mr-2",
                              p === 'high' ? 'bg-red-500' : p === 'medium' ? 'bg-yellow-500' : 'bg-green-500'
                            )}
                          />
                          {`${p[0].toUpperCase()}${p.slice(1)}`}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              <Separator />

              {/* Project selection */}
              <div className="rounded-lg bg-muted/20 p-3 hover:bg-muted/30 transition-colors">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="inline-flex items-center justify-center p-1 rounded-md bg-violet-100">
                    <Folder className="w-3.5 h-3.5 text-violet-600" />
                  </span>
                  Project
                </div>
                <div className="mt-2">
                  <Select
                    value={selectedTask.listId || ''}
                    onValueChange={(val) => updateTaskMutation.mutate({ listId: val || null as any })}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Choose project" />
                    </SelectTrigger>
                    <SelectContent>
                      {lists.map((l: any) => (
                        <SelectItem key={l.id} value={l.id}>
                          {l.emoji} {l.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Separator />

              {/* Dates (Created + Due) on one line with due editable */}
              <div className="rounded-lg bg-muted/20 p-3 hover:bg-muted/30 transition-colors">
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
                  {/* Created */}
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center justify-center p-1 rounded-md bg-sky-100">
                      <Calendar className="w-3.5 h-3.5 text-sky-600" />
                    </span>
                    <span className="text-xs">Created</span>
                    <span className="text-xs text-foreground">
                      {selectedTask.createdAt && format(new Date(selectedTask.createdAt), 'MMM d, yyyy')}
                    </span>
                  </div>
                  {/* Date (start) */}
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center justify-center p-1 rounded-md bg-sky-100">
                      <Calendar className="w-3.5 h-3.5 text-sky-600" />
                    </span>
                    <span className="text-xs">Date</span>
                    <span className="text-xs text-foreground">
                      {selectedTask.startTime && format(new Date(selectedTask.startTime), 'MMM d, yyyy')}
                    </span>
                  </div>
                  {/* Due */}
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center justify-center p-1 rounded-md bg-rose-100">
                      <Calendar className="w-3.5 h-3.5 text-rose-600" />
                    </span>
                    <span className="text-xs">Due</span>
                    <Select
                      value={selectedTask.scheduledDate ? new Date(selectedTask.scheduledDate as any).toISOString().split('T')[0] : 'none'}
                      onValueChange={(val) => {
                        if (val === 'none') {
                          updateTaskMutation.mutate({ scheduledDate: null as any });
                        } else {
                          const date = new Date(val + 'T00:00:00');
                          updateTaskMutation.mutate({ scheduledDate: date as any });
                        }
                      }}
                    >
                      <SelectTrigger className="h-7 w-[9rem] text-xs">
                        <SelectValue placeholder="None">
                          {selectedTask.scheduledDate ? format(new Date(selectedTask.scheduledDate as any), 'MMM d, yyyy') : 'None'}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent className="max-h-64 overflow-y-auto">
                        {Array.from({ length: 30 }).map((_, idx) => {
                          const d = new Date();
                          d.setDate(d.getDate() + idx);
                          const v = d.toISOString().split('T')[0];
                          return (
                            <SelectItem key={v} value={v}>
                              {format(d, 'EEE, MMM d')}
                            </SelectItem>
                          );
                        })}
                        <SelectItem value="none">None</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}