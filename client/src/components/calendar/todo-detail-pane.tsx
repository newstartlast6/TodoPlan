import { X, Calendar, Timer, StickyNote, Target, Clock, Flag, Folder, Play, Pause } from "lucide-react";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useSelectedTodo } from "@/hooks/use-selected-todo";
// import { NotesEditor } from "@/components/calendar/notes-editor";
import { EnhancedNotesEditor } from "@/components/calendar/enhanced-notes-editor";
import { BlockNotesEditor } from "@/components/calendar/block-notes-editor";

import "@blocknote/core/fonts/inter.css";
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/mantine/style.css";
import { useCreateBlockNote, SuggestionMenuController } from "@blocknote/react";
import { getDefaultReactSlashMenuItems } from "@blocknote/react";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as DatePicker } from "@/components/ui/calendar";
import { useNotesAutoSave } from "@/hooks/use-notes-auto-save";
  
interface TodoDetailPaneProps {
  onClose?: () => void;
  className?: string;
}
  
export function TodoDetailPane({ onClose, className }: TodoDetailPaneProps) {
  const { selectedTodoId, closeDetailPane } = useSelectedTodo();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const editor = useCreateBlockNote({
    domAttributes: {
      editor: {
        // Remove padding/margins and shrink font-size for compact appearance
        class: "px-0 mx-0 text-[13px] leading-[1.45]",
      },
    },
  });
  

  
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

  // Notes autosave using the minimal BlockNoteView
  const {
    updateNotes,
  } = useNotesAutoSave({
    taskId: selectedTodoId || "",
    initialNotes: selectedTask?.notes || "",
    debounceMs: 800,
  } as any);

  // Initialize editor content from existing HTML notes
  useEffect(() => {
    if (!editor || !selectedTask) return;
    (async () => {
      const html = selectedTask.notes || "";
      const blocks = await editor.tryParseHTMLToBlocks(html || "<p></p>");
      editor.replaceBlocks(editor.topLevelBlocks.map(b => b.id), blocks.length ? blocks : [{ type: "paragraph" }]);
    })();
  }, [editor, selectedTask?.id]);
  
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
    <div className={cn("h-full flex flex-col bg-background py-3", className)} data-testid="todo-detail-pane">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-accent/50 bg-accent/30">
        <div className="flex items-center space-x-3 flex-1 min-w-0">
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-medium text-foreground break-words flex items-center gap-2" data-testid="todo-detail-title">
              <span
                className={cn(
                  "inline-flex h-2.5 w-2.5 rounded-full mr-1.5",
                  selectedTask.priority === 'high'
                    ? 'bg-red-400 ring-2 ring-red-200 animate-pulse'
                    : selectedTask.priority === 'medium'
                    ? 'bg-yellow-200 ring-2 ring-yellow-100 animate-pulse-subtle'
                    : 'bg-green-200 ring-2 ring-green-100 animate-pulse-extra-light'
                )}
                aria-label={`Priority ${selectedTask.priority || 'none'}`}
              />
              {selectedTask.title}
              {isActiveTask && isTimerRunning ? (
                <span className="inline-flex items-center ml-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-accent-foreground shadow-[0_0_0_3px_rgba(251,146,60,0.25)] animate-pulse" />
                </span>
              ) : null}
            </h2>
            <div className="flex items-center space-x-2 mt-1">
              {isActiveTask && isTimerRunning ? (
                <Badge className="mt-1 ml-2 inline-flex items-center gap-1 text-[10px] bg-accent text-accent-foreground">
                  In Progress
                </Badge>
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
        <div className="p-4 space-y-8">
          {/* Notes */}
          <div className="space-y-2 rounded-xl p-4 border border-accent/40 bg-accent/20 -mx-4 sm:mx-0">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-md bg-accent text-accent-foreground">
                <StickyNote className="w-4 h-4 text-accent-foreground" />
              </div>
              <h4 className="text-xs font-medium text-foreground">Notes</h4>
            </div>
            <div>
              <EnhancedNotesEditor
                taskId={selectedTask.id}
                initialNotes={selectedTask.notes || ""}
                placeholder="Capture thoughts, plans, or links..."
                className="min-h-[180px] bg-transparent"
              />
            </div>
            <div>
            <BlockNotesEditor
              taskId={selectedTask.id}
              initialNotes={selectedTask.notes || ""}
              placeholder="Capture thoughts, plans, or links..."
              className="min-h-[180px] bg-transparent"
            />
            </div>
            <div className="relative rounded-lg border bg-background border-border" style={{ minHeight: 280 }}>
              <BlockNoteView
                editor={editor}
                sideMenu={false}
                tableHandles={false}
                filePanel={false}
                comments={false}
                emojiPicker={false}
                formattingToolbar={false}
                linkToolbar={false}
                slashMenu={false}
                className="px-0"
                onChange={async () => {
                  const html = await editor.blocksToFullHTML(editor.document);
                  updateNotes(html);
                }}
              >
                <SuggestionMenuController
                  triggerCharacter="/"
                  getItems={async (query: string) => {
                    const items = getDefaultReactSlashMenuItems(editor);
                    const allowed = new Set([
                      "paragraph",
                      "heading",
                      "heading_2",
                      "heading_3",
                      "bullet_list",
                      "numbered_list",
                      "check_list",
                      "quote",
                      "page_break",
                    ]);
                    const filtered = (items as any[]).filter((i) => allowed.has(i.key));
                    if (!query) return filtered;
                    const q = query.toLowerCase();
                    return filtered.filter((i) => (i.title || "").toLowerCase().includes(q));
                  }}
                />
              </BlockNoteView>
            </div>
          </div>

          {/* Time Tracking */}
          {!selectedTask.completed && (
            <div className="rounded-xl border border-accent/50 bg-accent/30 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-md bg-accent text-accent-foreground">
                    <Timer className="w-4 h-4 text-accent-foreground" />
                  </div>
                  <h4 className="text-sm font-medium text-foreground">Time Tracking</h4>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="default"
                    size="sm"
                    onClick={async () => {
                      try {
                        if (isActiveTask && isTimerRunning) {
                          await timer.pause();
                        } else {
                          await timer.start(selectedTask.id);
                        }
                      } catch {}
                    }}
                    className="h-8"
                  >
                    {isActiveTask && isTimerRunning ? (
                      <>
                        <Pause className="w-4 h-4 mr-1.5" />
                        Pause
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4 mr-1.5" />
                        Start
                      </>
                    )}
                  </Button>               
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleResetLoggedTime}
                    className="h-8 border-red-200 text-red-600 hover:bg-red-50"
                  >
                    Reset to 0:00
                  </Button>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
                <div className="rounded-xl bg-background/60 py-4 flex items-center justify-between sm:col-span-2">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center justify-center p-1.5 rounded-md bg-accent text-accent-foreground">
                      <Clock className="w-4 h-4 text-accent-foreground" />
                    </span>
                    <div>
                      <div className="text-xs font-medium text-muted-foreground">Time Logged</div>
                      <div className="mt-0.5 flex items-center gap-2">
                        <div className="text-2xl font-mono font-semibold tabular-nums text-accent-foreground">
                          {(() => {
                            const persisted = (selectedTask as any).timeLoggedSeconds || 0;
                            if (isActiveTask) {
                              return TimerCalculator.formatDuration(timer.displaySeconds || 0);
                            }
                            return TimerCalculator.formatDuration(persisted);
                          })()}
                        </div>
                        {isActiveTask && isTimerRunning ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-accent text-accent-foreground text-[10px] font-semibold uppercase tracking-wide animate-pulse">
                            In Progress
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
                      const totalSeconds = (persisted || 0) + (liveSessionSeconds || 0);
                      const estimatedSeconds = estimateMinutes * 60;
                      const raw = estimatedSeconds > 0 ? (totalSeconds / estimatedSeconds) * 100 : 0;
                      const progress = Math.min(100, raw);
                      const isOver = totalSeconds > estimatedSeconds;
                      const badgeClass = isOver
                        ? 'bg-red-100 text-red-800'
                        : progress > 75
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-green-100 text-green-800';
                      return (
                        <div className="flex flex-col items-center gap-2">
                          <ProgressRing progress={progress} size={56} className="text-accent-foreground" />
                          <div className="flex items-center gap-2">
                            <div className={`flex items-center gap-1 px-2 py-1 rounded text-xs ${badgeClass}`}>
                              <Target className="w-3 h-3" />
                              <span>{Math.round(progress)}%</span>
                            </div>
                            <span className="text-[11px] text-muted-foreground">of {estimateMinutes} minutes</span>
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
          <div className="rounded-xl border border-accent/40 bg-accent/20 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-md bg-accent text-accent-foreground">
                <Target className="w-4 h-4 text-accent-foreground" />
              </div>
              <h4 className="text-xs font-medium text-foreground">Estimate & Details</h4>
            </div>
            {!selectedTask.completed && (
              <TaskEstimation taskId={selectedTask.id} taskTitle={selectedTask.title} compact />
            )}
            <Separator />
            <div className="space-y-3">
              {/* Priority (editable) */}
              <div className="rounded-lg bg-muted/20 p-3 hover:bg-muted/30 transition-colors">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="inline-flex items-center justify-center p-1 rounded-md bg-accent text-accent-foreground">
                    <Flag className="w-3.5 h-3.5 text-accent-foreground" />
                  </span>
                  Priority
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <span
                    className={cn(
                      "w-2 h-2 rounded-full",
                      selectedTask.priority === 'high'
                        ? 'bg-red-200 animate-pulse'
                        : selectedTask.priority === 'medium'
                        ? 'bg-yellow-200 animate-pulse-subtle'
                        : 'bg-green-200 animate-pulse-extra-light'
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
                              p === 'high' ? 'bg-red-300' : p === 'medium' ? 'bg-yellow-300' : 'bg-green-300'
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
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="inline-flex items-center justify-center p-1 rounded-md bg-accent text-accent-foreground">
                    <Folder className="w-3.5 h-3.5 text-accent-foreground" />
                  </span>
                  Project
                </div>
                <div className="mt-2">
                  <Select
                    value={selectedTask.listId || ''}
                    onValueChange={(val) => updateTaskMutation.mutate({ listId: val || null as any })}
                  >
                    <SelectTrigger className="h-8 ring-1 ring-accent focus:ring-accent">
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

              {/* Dates (stacked; Due first) */}
              <div className="rounded-lg bg-muted/20 p-3 hover:bg-muted/30 transition-colors space-y-3">
                {/* Due (calendar popover) */}
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center justify-center p-1 rounded-md bg-accent text-accent-foreground">
                    <Calendar className="w-3.5 h-3.5 text-accent-foreground" />
                  </span>
                  <span className="text-xs">Due</span>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="h-7 text-xs ring-1 ring-accent hover:bg-accent/20 text-accent-foreground">
                        {selectedTask.scheduledDate
                          ? format(new Date(selectedTask.scheduledDate as any), 'MMM d, yyyy')
                          : 'None'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-3" align="start">
                      <DatePicker
                        mode="single"
                        selected={selectedTask.scheduledDate ? new Date(selectedTask.scheduledDate as any) : undefined}
                        onSelect={(d) => updateTaskMutation.mutate({ scheduledDate: d || null as any })}
                      />
                      <div className="flex items-center gap-2 pt-2">
                        <Button variant="ghost" size="sm" onClick={() => updateTaskMutation.mutate({ scheduledDate: new Date() as any })}>Today</Button>
                        <Button variant="ghost" size="sm" onClick={() => { const d = new Date(); d.setDate(d.getDate()+1); updateTaskMutation.mutate({ scheduledDate: d as any }); }}>Tomorrow</Button>
                        <Button variant="ghost" size="sm" onClick={() => { const d = new Date(); const day = d.getDay(); const offset = (8 - (day || 7)); d.setDate(d.getDate()+offset); updateTaskMutation.mutate({ scheduledDate: d as any }); }}>Next Week</Button>
                        <Button variant="ghost" size="sm" className="text-red-600" onClick={() => updateTaskMutation.mutate({ scheduledDate: null as any })}>Clear</Button>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Created */}
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center justify-center p-1 rounded-md bg-accent text-accent-foreground">
                    <Calendar className="w-3.5 h-3.5 text-accent-foreground" />
                  </span>
                  <span className="text-xs">Created</span>
                  <span className="text-xs text-foreground">
                    {selectedTask.createdAt && format(new Date(selectedTask.createdAt), 'MMM d, yyyy')}
                  </span>
                </div>

                {/* Date (start) */}
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center justify-center p-1 rounded-md bg-accent text-accent-foreground">
                    <Calendar className="w-3.5 h-3.5 text-accent-foreground" />
                  </span>
                  <span className="text-xs">Date</span>
                  <span className="text-xs text-foreground">
                    {selectedTask.startTime && format(new Date(selectedTask.startTime), 'MMM d, yyyy')}
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