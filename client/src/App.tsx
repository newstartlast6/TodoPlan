import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SelectionProvider } from "@/hooks/use-selected-todo";
import { TimerProvider } from "./contexts/timer-context";
import NotFound from "@/pages/not-found";
import Calendar from "@/pages/calendar";
import { Lists } from "@/pages/lists";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Calendar} />
      <Route path="/lists" component={Lists} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <SelectionProvider>
          <TimerProvider>
            <Toaster />
            <Router />
          </TimerProvider>
        </SelectionProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
