import { Switch, Route } from "wouter";
import { useEffect } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SelectionProvider } from "@/hooks/use-selected-todo";
import { initTimerStore, useTimerStore } from "@/hooks/use-timer-store";
import { getSupabaseClient, authEnabledOnClient } from "./lib/supabaseClient";
import NotFound from "@/pages/not-found";
import Calendar from "@/pages/calendar";
import { Lists } from "@/pages/lists";
import Streak from "@/pages/streak";
import Login from "@/pages/login";
import ResetPassword from "@/pages/reset-password";
import { AuthProvider, RequireAuth } from "@/contexts/AuthProvider";
import { isSameDay, isToday } from "date-fns";
import { Task } from "@shared/schema";

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/reset-password" component={ResetPassword} />
      <Route path="/">
        <RequireAuth>
          <Calendar />
        </RequireAuth>
      </Route>
      <Route path="/lists">
        <RequireAuth>
          <Lists />
        </RequireAuth>
      </Route>
      <Route path="/streak">
        <RequireAuth>
          <Streak />
        </RequireAuth>
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function TrayActionHandler() {
  const timer = useTimerStore();

  useEffect(() => {
    const anyWindow = window as any;
    if (!anyWindow?.electronAPI?.onTrayAction) return;

    const cleanup = anyWindow.electronAPI.onTrayAction((action: string) => {
      switch (action) {
        case 'pause':
          if (timer.isRunning) {
            timer.pause();
          }
          break;
        case 'resume':
          if (!timer.isRunning) {
            const lastTaskId = timer.getLastActiveTaskId();
            if (lastTaskId) {
              timer.resume(lastTaskId);
            }
          }
          break;
        case 'stop':
          if (timer.isRunning) {
            timer.stop();
          }
          break;
        case 'discardLastSession':
          if (timer.isRunning) {
            timer.discardLastSession();
          }
          break;
        default:
          break;
      }
    });

    return cleanup;
  }, [timer]);

  // Handle task start from tray menu
  useEffect(() => {
    const anyWindow = window as any;
    if (!anyWindow?.electronAPI?.onTrayStartTask) return;

    const cleanup = anyWindow.electronAPI.onTrayStartTask((taskData: { taskId: string; taskTitle: string }) => {
      // If timer is already running, stop it first
      if (timer.isRunning) {
        // timer.stop();
        return;
      }
      
      // Start timer for the selected task
      timer.start(taskData.taskId);
    });

    return cleanup;
  }, [timer]);

  return null;
}

function TodaysTasksSync() {
  // Fetch today's tasks using the same query as the calendar
  const { data: tasks = [] } = useQuery<Task[]>({
    queryKey: ['/api/tasks'],
    queryFn: async () => {
      const response = await fetch('/api/tasks');
      if (!response.ok) throw new Error('Failed to fetch tasks');
      return response.json();
    },
  });

  // Filter and sort today's tasks using the same logic as day-view.tsx
  useEffect(() => {
    const anyWindow = window as any;
    if (!anyWindow?.electronAPI?.notifyTasksUpdated) return;

    const today = new Date();
    const dayTasks = tasks
      .filter(task => {
        const st = new Date(task.startTime);
        const sd = task.scheduledDate ? new Date(task.scheduledDate) : null;
        return isSameDay(st, today) || (sd ? isSameDay(sd, today) : false);
      })
      .sort((a, b) => {
        const aOrder = (a as any).dayOrder;
        const bOrder = (b as any).dayOrder;
        const aHas = typeof aOrder === 'number';
        const bHas = typeof bOrder === 'number';
        if (aHas && bHas) return aOrder - bOrder;
        if (aHas) return -1;
        if (bHas) return 1;
        const aKey = (a.createdAt ?? a.startTime) as unknown as string;
        const bKey = (b.createdAt ?? b.startTime) as unknown as string;
        return new Date(aKey).getTime() - new Date(bKey).getTime();
      });

    // Show non-completed tasks first, then completed tasks
    const nonCompletedTasks = dayTasks.filter(task => !task.completed);
    const completedTasks = dayTasks.filter(task => task.completed);
    const orderedTasks = [...nonCompletedTasks, ...completedTasks];

    // Send to main process
    anyWindow.electronAPI.notifyTasksUpdated(orderedTasks);
  }, [tasks]);

  return null;
}

function App() {
  // Initialize sessionless timer store once
  try { initTimerStore(); } catch { }
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <SelectionProvider>
          <AuthProvider>
            {/* Initialize Supabase client early if auth is enabled */}
            {authEnabledOnClient ? (getSupabaseClient(), null) : null}
            <TrayActionHandler />
            <TodaysTasksSync />
            <Toaster />
            <Router />
          </AuthProvider>
        </SelectionProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
