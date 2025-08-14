import { Switch, Route } from "wouter";
import { useEffect } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
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
            <Toaster />
            <Router />
          </AuthProvider>
        </SelectionProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
