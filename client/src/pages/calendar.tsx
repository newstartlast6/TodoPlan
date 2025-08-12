import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useSelectedTodo } from "@/hooks/use-selected-todo";
import { TimerProvider } from "@/contexts/timer-context";
import { Toaster } from '@/components/ui/toaster';
import { MinimalisticSidebar } from "@/components/calendar/minimalistic-sidebar";
import { ResponsiveLayout } from "@/components/layout/responsive-layout";
import { TodoDetailPane } from "@/components/calendar/todo-detail-pane";
import { DayView } from "@/components/calendar/day-view";
import { WeekView } from "@/components/calendar/week-view";
import { MonthView } from "@/components/calendar/month-view";
import { YearView } from "@/components/calendar/year-view";
import { TaskForm } from "@/components/calendar/task-form";
import { TimerDisplay } from "@/components/timer/timer-display";
import { apiRequest } from "@/lib/queryClient";
import { getTimeRangeForView } from "@/lib/time-utils";
import { Task, InsertTask } from "@shared/schema";
import { cn } from "@/lib/utils";
import { PlanPanel } from "../components/planning/plan-panel";
import { X } from "lucide-react";
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
 

type CalendarView = 'day' | 'week' | 'month' | 'year';

export default function Calendar() {
  const [currentView, setCurrentView] = useState<CalendarView>('week');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isTaskFormOpen, setIsTaskFormOpen] = useState(false);
  const [isPlanPanelOpen, setIsPlanPanelOpen] = useState(() => {
    try {
      return localStorage.getItem('plan-panel-open') === 'true';
    } catch { return false; }
  });
 
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { selectedTodoId, isDetailPaneOpen, closeDetailPane } = useSelectedTodo();

  // No goal chips in tabs; goals are displayed within each view

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

  // Create task mutation
  const createTaskMutation = useMutation({
    mutationFn: async (newTask: InsertTask) => {
      const response = await apiRequest('POST', '/api/tasks', newTask);
      return response.json();
    },
    onSuccess: (created: Task) => {
      queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
      // Select the newly created task so it highlights and opens details
      // and triggers inline edit in the list
      window.dispatchEvent(new CustomEvent('tasks:select', { detail: created.id }));
      toast({
        title: "Task created",
        description: "Your task has been added successfully.",
      });
    },
    onError: () => {
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
          />
        );
      case 'week':
        return (
          <WeekView
            tasks={tasksSorted}
            currentDate={currentDate}
            onTaskUpdate={handleUpdateTask}
            onTaskDelete={handleDeleteTask}
          />
        );
      case 'month':
        return (
          <MonthView
            tasks={tasksSorted}
            currentDate={currentDate}
            onDateClick={handleDateClick}
            onTaskUpdate={handleUpdateTask}
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
      <MinimalisticSidebar
        currentView={currentView}
        onViewChange={setCurrentView}
        onTogglePlanPanel={() => {
          setIsPlanPanelOpen((v) => {
            try { localStorage.setItem('plan-panel-open', (!v).toString()); } catch {}
            return !v;
          });
        }}
        isPlanPanelOpen={isPlanPanelOpen}
      />
    </div>
  );

  // Render main content
  const renderMainContent = () => (
    <div className="flex-1 flex flex-col">
      {/* Header */}
      <header className="bg-surface border-b border-border px-8 py-4" data-testid="calendar-header">
        <div className="flex items-center justify-between">
          {/* View Tabs */}
          <div className="flex space-x-1 bg-slate-100 rounded-lg p-1" data-testid="view-tabs">
            {(['day', 'week', 'month', 'year'] as CalendarView[]).map((view) => {
              return (
                <button
                  key={view}
                  onClick={() => setCurrentView(view)}
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
            <Button
              onClick={handleAddEmptyTaskInline}
              className="flex items-center space-x-2"
              disabled={createTaskMutation.isPending}
              data-testid="button-add-task"
            >
              <Plus className="w-4 h-4" />
              <span>Add Task</span>
            </Button>
            <Button
              variant={isPlanPanelOpen ? 'default' : 'outline'}
              onClick={() => {
                setIsPlanPanelOpen((v) => {
                  try { localStorage.setItem('plan-panel-open', (!v).toString()); } catch {}
                  return !v;
                });
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
  const renderDetailPane = () => (
    <TodoDetailPane onClose={closeDetailPane} />
  );

  return (
    <TimerProvider>
      <DndProvider backend={HTML5Backend}>
        <ResponsiveLayout
          sidebar={renderSidebar()}
          main={renderMainContent()}
          detail={renderDetailPane()}
          isDetailOpen={isDetailPaneOpen}
          onDetailClose={closeDetailPane}
        />
      </DndProvider>

      {/* Global Timer Display */}
      <div className="fixed top-4 right-4 z-50">
        <TimerDisplay compact />
      </div>

      <Toaster />

      {/* Task Form Dialog */}
      {/* Form kept for future use; not used for inline quick-add */}

      {/* Floating Add Button (Mobile) */}
      <Button
        onClick={handleAddEmptyTaskInline}
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full shadow-lg md:hidden"
        size="icon"
        data-testid="floating-add-button"
      >
        <Plus className="w-6 h-6" />
      </Button>
    </TimerProvider>
  );
}
