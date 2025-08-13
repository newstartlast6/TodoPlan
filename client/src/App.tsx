import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SelectionProvider } from "@/hooks/use-selected-todo";
import { initTimerStore } from "@/hooks/use-timer-store";
import NotFound from "@/pages/not-found";
import Calendar from "@/pages/calendar";
import { Lists } from "@/pages/lists";
import Streak from "@/pages/streak";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Calendar} />
      <Route path="/lists" component={Lists} />
      <Route path="/streak" component={Streak} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  // Initialize sessionless timer store once
  try { initTimerStore(); } catch {}
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <SelectionProvider>
          <Toaster />
          <Router />
        </SelectionProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
