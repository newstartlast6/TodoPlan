import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useSelectedTodo } from "@/hooks/use-selected-todo";
import { TimerProvider } from "@/contexts/timer-context";
import { MinimalisticSidebar } from "@/components/calendar/minimalistic-sidebar";
import { ResponsiveLayout } from "@/components/layout/responsive-layout";
import { TodoDetailPane } from "@/components/calendar/todo-detail-pane";
import { DayView } from "@/components/calendar/day-view";
import { WeekView } from "@/components/calendar/week-view";
import { MonthView } from "@/components/calendar/month-view";
import { YearView } from "@/components/calendar/year-view";
import { TaskForm } from "@/components/calendar/task-form";
import { DailyProgressWidget } from "@/components/timer/daily-progress-dashboard";
import { TimerDisplay } from "@/components/timer/timer-display";
import { apiRequest } from "@/lib/queryClient";
import { getTimeRangeForView } from "@/lib/time-utils";
import { Task, InsertTask } from "@shared/schema";
import { cn } from "@/lib/utils";

type CalendarView = 'day' | 'week' | 'month' | 'year';

export default function Calendar() {
  const [currentView, setCurrentView] = useState<CalendarView>('week');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isTaskFormOpen, setIsTaskFormOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { selectedTodoId, isDetailPaneOpen, closeDetailPane } = useSelectedTodo();

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
      const response = await fetch(`/api/tasks?${searchParams}`);
      if (!response.ok) {
        throw new Error('Failed to fetch tasks');
      }
      return response.json();
    },
  });

  // Create task mutation
  const createTaskMutation = useMutation({
    mutationFn: async (newTask: InsertTask) => {
      const response = await apiRequest('POST', '/api/tasks', newTask);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
      toast({
        title: "Task updated",
        description: "Your task has been updated successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update task. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleCreateTask = (newTask: InsertTask) => {
    createTaskMutation.mutate(newTask);
  };

  const handleUpdateTask = (taskId: string, updates: Partial<Task>) => {
    updateTaskMutation.mutate({ id: taskId, updates });
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
            tasks={tasks}
            currentDate={currentDate}
            onTaskUpdate={handleUpdateTask}
            onAddTask={() => setIsTaskFormOpen(true)}
          />
        );
      case 'week':
        return (
          <WeekView
            tasks={tasks}
            currentDate={currentDate}
            onTaskUpdate={handleUpdateTask}
          />
        );
      case 'month':
        return (
          <MonthView
            tasks={tasks}
            currentDate={currentDate}
            onDateClick={handleDateClick}
          />
        );
      case 'year':
        return (
          <YearView
            tasks={tasks}
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
      />
      <DailyProgressWidget />
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
            {(['day', 'week', 'month', 'year'] as CalendarView[]).map((view) => (
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
                {view}
              </button>
            ))}
          </div>

          {/* Actions */}
          <div className="flex items-center space-x-3" data-testid="header-actions">
            <Button
              onClick={() => setIsTaskFormOpen(true)}
              className="flex items-center space-x-2"
              disabled={createTaskMutation.isPending}
              data-testid="button-add-task"
            >
              <Plus className="w-4 h-4" />
              <span>Add Task</span>
            </Button>
            <Button variant="ghost" size="icon" data-testid="button-settings">
              <Settings className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-8" data-testid="calendar-main">
        {renderCurrentView()}
      </main>
    </div>
  );

  // Render detail pane
  const renderDetailPane = () => (
    <TodoDetailPane onClose={closeDetailPane} />
  );

  return (
    <TimerProvider>
      <ResponsiveLayout
        sidebar={renderSidebar()}
        main={renderMainContent()}
        detail={renderDetailPane()}
        isDetailOpen={isDetailPaneOpen}
        onDetailClose={closeDetailPane}
      />

      {/* Global Timer Display */}
      <div className="fixed top-4 right-4 z-50">
        <TimerDisplay compact />
      </div>

      {/* Task Form Dialog */}
      <TaskForm
        open={isTaskFormOpen}
        onOpenChange={setIsTaskFormOpen}
        onSubmit={handleCreateTask}
        defaultDate={currentDate}
      />

      {/* Floating Add Button (Mobile) */}
      <Button
        onClick={() => setIsTaskFormOpen(true)}
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full shadow-lg md:hidden"
        size="icon"
        data-testid="floating-add-button"
      >
        <Plus className="w-6 h-6" />
      </Button>
    </TimerProvider>
  );
}
