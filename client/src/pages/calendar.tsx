import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Settings, Pause, CheckCircle, Timer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useSelectedTodo } from "@/hooks/use-selected-todo";
// TimerProvider removed in sessionless rewrite
import { Toaster } from '@/components/ui/toaster';
import { MinimalisticSidebar } from "@/components/calendar/minimalistic-sidebar";
import { ResponsiveLayout } from "@/components/layout/responsive-layout";
import { TodoDetailPane } from "@/components/calendar/todo-detail-pane";
import { ReviewDetailPane } from "@/components/calendar/review-detail-pane";
import { NotesDetailPane } from "@/components/calendar/notes-detail-pane";
import { DayView } from "@/components/calendar/day-view";
import { WeekView } from "@/components/calendar/week-view";
import { MonthView } from "@/components/calendar/month-view";
import { YearView } from "@/components/calendar/year-view";
import { TaskForm } from "@/components/calendar/task-form";
import { apiRequest } from "@/lib/queryClient";
import { getTimeRangeForView } from "@/lib/time-utils";
import { Task, InsertTask } from "@shared/schema";
import { cn } from "@/lib/utils";
import { PlanPanel } from "../components/planning/plan-panel";
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { useTimerStore } from "@/hooks/use-timer-store";
import { TimerCalculator } from "@shared/services/timer-store";
 

type CalendarView = 'day' | 'week' | 'month' | 'year';

export default function Calendar() {
  const [currentView, setCurrentView] = useState<CalendarView>('week');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isTaskFormOpen, setIsTaskFormOpen] = useState(false);
  const [isPlanPanelOpen, setIsPlanPanelOpen] = useState(false);
  const [scrollTargetTaskId, setScrollTargetTaskId] = useState<string | null>(null);
 
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { selectedTodoId, selectedReviewType, selectedReviewAnchorDate, selectedNotesType, selectedNotesAnchorDate, isDetailPaneOpen, closeDetailPane } = useSelectedTodo();
  const timer = useTimerStore();

  // No goal chips in tabs; goals are displayed within each view

  // Honor query params to open week view and plan panel from other pages
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const viewParam = params.get('view');
      const planParam = params.get('plan');
      if (viewParam === 'week') {
        setCurrentView('week');
      }
      if (planParam === 'open') {
        setIsPlanPanelOpen(true);
      }
    } catch {}
  }, []);

  // Get date range for current view
  const { start: rangeStart, end: rangeEnd } = getTimeRangeForView(currentView, currentDate);

  // Fetch tasks for current date range
  const { data: tasks = [], isLoading } = useQuery<Task[]>({
    queryKey: ['/api/tasks', rangeStart.toISOString(), rangeEnd.toISOString()],
    queryFn: async () => {
      const searchParams = new URLSearchParams({
        startDate: rangeStart.toISOString(),
        endDate: rangeEnd.toISOString(),
      });
      const { apiRequest } = await import('@/lib/queryClient');
      const res = await apiRequest('GET', `/api/tasks?${searchParams}`);
      return res.json();
    },
  });

  // Stable ordering by creation time (fallback to startTime)
  const tasksSorted = useMemo(() => {
    return [...tasks].sort((a, b) => {
      const aDate = (a.createdAt ?? a.startTime) as unknown as Date;
      const bDate = (b.createdAt ?? b.startTime) as unknown as Date;
      return new Date(aDate).getTime() - new Date(bDate).getTime();
    });
  }, [tasks]);

  // Active task info for banner
  const activeTask = useMemo(() => {
    if (!timer.activeTaskId) return null;
    const fromList = tasksSorted.find(t => t.id === timer.activeTaskId);
    if (fromList) return fromList;
    const fromCache = queryClient.getQueryData<Task>(['task', timer.activeTaskId]);
    return fromCache ?? null;
  }, [timer.activeTaskId, tasksSorted, queryClient]);

  const activeTaskTitle = activeTask?.title || 'Active Task';
  const activeTaskDate = activeTask?.scheduledDate ? new Date(activeTask.scheduledDate) : (activeTask?.startTime ? new Date(activeTask.startTime as any) : null);

  // Create task mutation
  const createTaskMutation = useMutation({
    mutationFn: async (newTask: InsertTask) => {
      const response = await apiRequest('POST', '/api/tasks', newTask);
      return response.json();
    },
    onMutate: async (newTask: InsertTask) => {
      await queryClient.cancelQueries({ queryKey: ['/api/tasks'] });

      const previousLists = queryClient.getQueriesData<Task[]>({ queryKey: ['/api/tasks'] });

      const tempId = `temp-${Date.now()}`;
      const tempTask: Task = {
        id: tempId as any,
        title: newTask.title,
        description: (newTask as any).description,
        notes: (newTask as any).notes,
        startTime: new Date(newTask.startTime) as any,
        endTime: new Date(newTask.endTime) as any,
        completed: Boolean(newTask.completed),
        priority: newTask.priority ?? 'medium',
        listId: (newTask as any).listId as any,
        scheduledDate: (newTask as any).scheduledDate ? new Date((newTask as any).scheduledDate) as any : null as any,
        timeLoggedSeconds: 0 as any,
        createdAt: new Date() as any,
      } as Task;

      queryClient.setQueriesData({ queryKey: ['/api/tasks'] }, (old: Task[] | undefined) => {
        if (!old) return [tempTask];
        return [tempTask, ...old];
      });

      return { previousLists, tempId } as const;
    },
    onSuccess: (created: Task, _vars, context) => {
      // Replace temp task with the created one
      if (context?.tempId) {
        queryClient.setQueriesData({ queryKey: ['/api/tasks'] }, (old: Task[] | undefined) => {
          if (!old) return old;
          return old.map((t) => (t.id === (context.tempId as any) ? created : t));
        });
      }
      queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
      // Select the newly created task so it highlights and opens details
      // and triggers inline edit in the list
      window.dispatchEvent(new CustomEvent('tasks:select', { detail: created.id }));
      toast({
        title: "Task created",
        description: "Your task has been added successfully.",
      });
    },
    onError: (_err, _vars, context) => {
      // Rollback optimistic insert
      if (context?.previousLists) {
        for (const [key, data] of context.previousLists) {
          queryClient.setQueryData(key, data);
        }
      }
      toast({
        title: "Error",
        description: "Failed to create task. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Update task mutation
  const updateTaskMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Task> }) => {
      const response = await apiRequest('PUT', `/api/tasks/${id}`, updates);
      return response.json();
    },
    onMutate: async ({ id, updates }: { id: string; updates: Partial<Task> }) => {
      // Cancel outgoing refetches to prevent overwriting
      await queryClient.cancelQueries({ queryKey: ['/api/tasks'] });
      await queryClient.cancelQueries({ queryKey: ['task', id] });

      // Snapshot all matching lists to roll back on error
      const previousLists = queryClient.getQueriesData<Task[]>({ queryKey: ['/api/tasks'] });
      const previousTask = queryClient.getQueryData<Task>(['task', id]);

      // Optimistically update all task lists containing this id
      queryClient.setQueriesData({ queryKey: ['/api/tasks'] }, (old: Task[] | undefined) => {
        if (!old) return old;
        return old.map(task => (task.id === id ? { ...task, ...updates } : task));
      });

      // Optimistically update focused task detail cache
      if (previousTask) {
        queryClient.setQueryData(['task', id], { ...previousTask, ...updates });
      }

      return { previousLists, previousTask } as const;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
      toast({
        title: "Task updated",
        description: "Your task has been updated successfully.",
      });
    },
    onError: (_err, _vars, context) => {
      // Roll back
      if (context?.previousLists) {
        for (const [queryKey, data] of context.previousLists) {
          queryClient.setQueryData(queryKey, data);
        }
      }
      if (context?.previousTask) {
        queryClient.setQueryData(['task', (context.previousTask as Task).id], context.previousTask);
      }
      toast({
        title: "Error",
        description: "Failed to update task. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Delete task mutation
  const deleteTaskMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest('DELETE', `/api/tasks/${id}`);
      if (!response.ok) {
        throw new Error('Failed to delete task');
      }
      return true;
    },
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
      if (selectedTodoId === id) {
        closeDetailPane();
      }
      toast({
        title: 'Task deleted',
        description: 'The task has been removed.',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to delete task. Please try again.',
        variant: 'destructive',
      });
    }
  });

  const handleCreateTask = (newTask: InsertTask) => {
    createTaskMutation.mutate(newTask);
  };

  // Inline: create an empty task and let user type the title inline
  const handleAddEmptyTaskInline = () => {
    const now = new Date();
    const start = new Date(currentDate);
    start.setHours(now.getHours(), now.getMinutes(), 0, 0);
    const end = new Date(start.getTime() + 60 * 60 * 1000);

    const payload: InsertTask = {
      title: "",
      startTime: start,
      endTime: end,
      completed: false,
      priority: "medium",
    };

    createTaskMutation.mutate(payload);
  };

  const handleUpdateTask = (taskId: string, updates: Partial<Task>) => {
    updateTaskMutation.mutate({ id: taskId, updates });
  };

  const handleDeleteTask = (taskId: string) => {
    deleteTaskMutation.mutate(taskId);
  };

  const handleDateClick = (date: Date) => {
    setCurrentDate(date);
    setCurrentView('day');
  };

  const handleMonthClick = (date: Date) => {
    setCurrentDate(date);
    setCurrentView('month');
  };

  const renderCurrentView = () => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center h-64" data-testid="loading-spinner">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      );
    }

    switch (currentView) {
      case 'day':
        return (
          <DayView
            tasks={tasksSorted}
            currentDate={currentDate}
            onTaskUpdate={handleUpdateTask}
            onTaskDelete={handleDeleteTask}
            onAddTask={handleAddEmptyTaskInline}
            onTaskCreate={handleCreateTask}
            onChangeDate={(date) => setCurrentDate(date)}
          />
        );
      case 'week':
        return (
          <WeekView
            tasks={tasksSorted}
            currentDate={currentDate}
            onTaskUpdate={handleUpdateTask}
            onTaskDelete={handleDeleteTask}
            onTaskCreate={handleCreateTask}
            onChangeDate={(date) => setCurrentDate(date)}
            scrollToTaskId={scrollTargetTaskId}
          />
        );
      case 'month':
        return (
          <MonthView
            tasks={tasksSorted}
            currentDate={currentDate}
            onDateClick={handleDateClick}
            onTaskUpdate={handleUpdateTask}
            onChangeDate={(date) => setCurrentDate(date)}
          />
        );
      case 'year':
        return (
          <YearView
            tasks={tasksSorted}
            currentDate={currentDate}
            onMonthClick={handleMonthClick}
          />
        );
      default:
        return null;
    }
  };

  // Render sidebar
  const renderSidebar = () => (
    <div className="space-y-4">
      <MinimalisticSidebar />
    </div>
  );

  // Render main content
  // Auto-close and prevent detail pane only in Month/Year views
  useEffect(() => {
    if ((currentView === 'month' || currentView === 'year') && isDetailPaneOpen && !selectedNotesType) {
      closeDetailPane();
    }
  }, [currentView, isDetailPaneOpen, selectedNotesType, closeDetailPane]);

  const renderMainContent = () => (
    <div className="flex-1 flex flex-col">
      {timer.isRunning && timer.activeTaskId && (
        <div
          className="sticky top-0 z-40 bg-orange-50/95 backdrop-blur supports-[backdrop-filter]:bg-orange-50/80 border-b border-orange-200"
          onClick={() => {
            const targetDate = activeTaskDate ?? new Date();
            setCurrentDate(targetDate);
            setCurrentView('week');
            setScrollTargetTaskId(timer.activeTaskId!);
            window.setTimeout(() => setScrollTargetTaskId(null), 1500);
          }}
          role="button"
          aria-label="Timer running banner"
        >
          <div className="px-8 py-3 grid grid-cols-3 items-center gap-3">
            {/* Left spacer to help center content */}
            <div className="hidden sm:block" />

            {/* Center content */}
            <div className="min-w-0 flex items-center justify-center text-center gap-3">
              <span className="inline-flex items-center justify-center rounded-full  text-orange-500  shrink-0 flex-none">
                <Timer className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex items-center gap-2">
                <span className="text-[13px] font-medium text-orange-600 tesxtfont-semibold truncate max-w-[40vw]">
                  {activeTaskTitle}
                </span>
                <span className="text-orange-300">•</span>
                <span className="inline-flex items-center rounded-full  text-orange-600 text-sm font-semibold ring-1 ring-orange-400 px-2 py-0.5 font-mono text-[13px] font-medium whitespace-nowrap shrink-0 flex-none">
                  {TimerCalculator.formatDuration(timer.displaySeconds || 0)}
                </span>
              </div>
            </div>

            {/* Right controls */}
            <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
              <Button
                size="sm"
                className="hover:bg-orange-400 hover:text-white hover:ring-0 text-orange-600 ring-1 ring-orange-400 bg-orange-50"
                variant="outline"
                onClick={() => { void timer.pause(); }}
              >
                <Pause className="h-4 w-4 mr-1" /> Pause
              </Button>
              {timer.hasActiveSession && (
                <Button
                  size="sm"
                  variant="outline"
                  className="bg-white text-red-600 border-red-300 hover:bg-red-50"
                  onClick={() => { void timer.discardLastSession(); }}
                  title={`Discard Session`}
                >
                  Discard  Session
                </Button>
              )}
              {timer.activeTaskId && (
                <Button
                  size="sm"
                  variant="outline"
                  className="bg-white text-orange-700 border-orange-300 hover:bg-orange-50"
                  onClick={async () => {
                    const id = timer.activeTaskId!;
                    try { await timer.pause(); } catch {}
                    updateTaskMutation.mutate({ id, updates: { completed: true } });
                  }}
                >
                  <CheckCircle className="h-4 w-4 mr-1" /> Mark Complete
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
      {/* Header */}
      <header className="bg-surface border-b border-border px-8 py-4" data-testid="calendar-header">
        <div className="flex items-center justify-between">
          {/* View Tabs */}
          <div className="flex space-x-1 bg-slate-100 rounded-lg p-1" data-testid="view-tabs">
            {(['day', 'week', 'month', 'year'] as CalendarView[]).map((view) => {
              return (
                <button
                  key={view}
                  onClick={() => {
                    setCurrentView(view);
                    if (view === 'month' || view === 'year') {
                      closeDetailPane();
                    }
                  }}
                  className={cn(
                    "px-4 py-2 text-sm font-medium rounded-md transition-colors capitalize",
                    currentView === view
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  data-testid={`tab-${view}`}
                >
                  <span className="inline-flex items-center gap-2">{view}</span>
                </button>
              );
            })}
          </div>

          {/* Actions */}
          <div className="flex items-center space-x-3" data-testid="header-actions">
            {/* Removed Add Task from calendar header to emphasize Plan flow */}
            <Button
              variant={isPlanPanelOpen ? 'outline' : 'default'}
              onClick={() => {
                setIsPlanPanelOpen((v) => !v);
              }}
              data-testid="button-toggle-plan"
            >
              {isPlanPanelOpen ? 'Hide Plan' : 'Show Plan'}
            </Button>
            <Button variant="ghost" size="icon" data-testid="button-settings">
              <Settings className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-8 relative" data-testid="calendar-main">
        {/* Right-side sliding Plan Panel (no overlay; background remains interactive) */}
        <div
          className={cn(
            "hidden md:block fixed inset-y-0 right-0 z-40 w-[420px] transform transition-transform duration-300",
            isPlanPanelOpen ? "translate-x-0" : "translate-x-full"
          )}
          style={{ filter: 'drop-shadow(-12px 0 24px rgba(0,0,0,0.18))' }}
        >
          {/* Panel content */}
          <div className="relative h-full">
            <PlanPanel
              variant="floating"
              className="w-full h-full rounded-none border-0 border-l border-border shadow-none"
              onClose={() => setIsPlanPanelOpen(false)}
            />
          </div>
        </div>

        <div className="flex-1 min-w-0">
          {renderCurrentView()}
        </div>
      </main>
    </div>
  );

  // Render detail pane
  const renderDetailPane = () => {
    if (selectedReviewType && selectedReviewAnchorDate && !selectedTodoId) {
      return (
        <ReviewDetailPane
          type={selectedReviewType}
          anchorDate={new Date(selectedReviewAnchorDate)}
          onClose={closeDetailPane}
        />
      );
    }
    if (selectedNotesType && selectedNotesAnchorDate && !selectedTodoId) {
      return (
        <NotesDetailPane
          type={selectedNotesType}
          anchorDate={new Date(selectedNotesAnchorDate)}
          onClose={closeDetailPane}
        />
      );
    }
    return <TodoDetailPane onClose={closeDetailPane} />;
  };

  return (
    <>
      <DndProvider backend={HTML5Backend}>
        <ResponsiveLayout
          sidebar={renderSidebar()}
          main={renderMainContent()}
          detail={renderDetailPane()}
          isDetailOpen={isDetailPaneOpen && ((currentView !== 'month' && currentView !== 'year') || Boolean(selectedNotesType))}
          onDetailClose={closeDetailPane}
          detailWidthClass={selectedReviewType || selectedNotesType ? 'w-[500px]' : undefined}
        />
      </DndProvider>

      {/* Global Timer Display removed in favor of sticky banner */}

      <Toaster />

      {/* Task Form Dialog */}
      {/* Form kept for future use; not used for inline quick-add */}

      {/* Floating Plan Button (Mobile) */}
      <Button
        onClick={() => {
          setCurrentView('week');
          setIsPlanPanelOpen(true);
        }}
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full shadow-lg md:hidden"
        size="icon"
        data-testid="floating-plan-button"
      >
        <Settings className="w-6 h-6" />
      </Button>
    </>
  );
}
