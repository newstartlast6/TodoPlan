import { CalendarIcon, Calendar, CalendarDays, CalendarRange, CalendarCheck, List, Kanban, Flame } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";

type CalendarView = 'day' | 'week' | 'month' | 'year';

interface MinimalisticSidebarProps {
  currentView?: CalendarView;
  onViewChange?: (view: CalendarView) => void;
  onTogglePlanPanel?: () => void;
  isPlanPanelOpen?: boolean;
}

const viewConfig = {
  day: {
    icon: Calendar,
    label: 'Day View',
    description: 'View tasks for a single day',
  },
  week: {
    icon: CalendarDays,
    label: 'Week View',
    description: 'View tasks for the current week',
  },
  month: {
    icon: CalendarRange,
    label: 'Month View',
    description: 'View tasks for the entire month',
  },
  year: {
    icon: CalendarCheck,
    label: 'Year View',
    description: 'View tasks for the entire year',
  },
} as const;

export function MinimalisticSidebar({ currentView, onViewChange, onTogglePlanPanel, isPlanPanelOpen }: MinimalisticSidebarProps) {
  const [location, setLocation] = useLocation();
  
  const isCalendarPage = location === '/';
  const isListsPage = location === '/lists';
  const isStreakPage = location === '/streak';

  return (
    <div className="w-16 bg-surface border-r border-border flex flex-col items-center py-4" data-testid="minimalistic-sidebar">
      {/* App Logo/Icon */}
      <div className="mb-8">
        <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
          <CalendarIcon className="text-primary-foreground text-lg" />
        </div>
      </div>

      {/* Main Navigation */}
      <nav className="flex flex-col space-y-2 mb-8" data-testid="main-navigation">
        {/* Calendar */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={isCalendarPage ? "default" : "ghost"}
              size="icon"
              onClick={() => setLocation('/')}
              className={cn(
                "w-10 h-10 transition-colors",
                isCalendarPage
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
              )}
              data-testid="nav-button-calendar"
              aria-label="Calendar"
            >
              <Calendar className="w-5 h-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right" className="ml-2">
            <div>
              <div className="font-medium">Calendar</div>
              <div className="text-xs text-muted-foreground">View tasks in calendar format</div>
            </div>
          </TooltipContent>
        </Tooltip>

        {/* Lists */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={isListsPage ? "default" : "ghost"}
              size="icon"
              onClick={() => setLocation('/lists')}
              className={cn(
                "w-10 h-10 transition-colors",
                isListsPage
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
              )}
              data-testid="nav-button-lists"
              aria-label="Lists"
            >
              <List className="w-5 h-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right" className="ml-2">
            <div>
              <div className="font-medium">Lists</div>
              <div className="text-xs text-muted-foreground">Organize tasks in custom lists</div>
            </div>
          </TooltipContent>
        </Tooltip>

        {/* Streak */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={isStreakPage ? "default" : "ghost"}
              size="icon"
              onClick={() => setLocation('/streak')}
              className={cn(
                "w-10 h-10 transition-colors",
                isStreakPage
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
              )}
              data-testid="nav-button-streak"
              aria-label="Streak"
            >
              <Flame className="w-5 h-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right" className="ml-2">
            <div>
              <div className="font-medium">Streak</div>
              <div className="text-xs text-muted-foreground">Your daily 8h target streak</div>
            </div>
          </TooltipContent>
        </Tooltip>
      </nav>

      {/* Calendar View Navigation (only show on calendar page) */}
      {isCalendarPage && currentView && onViewChange && (
        <nav className="flex flex-col space-y-2" data-testid="view-navigation">
          {(Object.keys(viewConfig) as CalendarView[]).map((view) => {
            const config = viewConfig[view];
            const Icon = config.icon;
            const isActive = currentView === view;

            return (
              <Tooltip key={view}>
                <TooltipTrigger asChild>
                  <Button
                    variant={isActive ? "default" : "ghost"}
                    size="icon"
                    onClick={() => onViewChange(view)}
                    className={cn(
                      "w-10 h-10 transition-colors",
                      isActive
                        ? "bg-orange-500 text-white shadow-sm"
                        : "text-muted-foreground hover:text-foreground hover:bg-accent"
                    )}
                    data-testid={`view-button-${view}`}
                    aria-label={config.label}
                  >
                    <Icon className="w-5 h-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right" className="ml-2">
                  <div>
                    <div className="font-medium">{config.label}</div>
                    <div className="text-xs text-muted-foreground">{config.description}</div>
                  </div>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </nav>
      )}

      {/* Plan Panel Toggle (shown when handler provided) */}
      {onTogglePlanPanel && (
        <div className="mt-auto pt-6">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={isPlanPanelOpen ? "default" : "ghost"}
                size="icon"
                onClick={onTogglePlanPanel}
                className={cn(
                  "w-10 h-10 transition-colors",
                  isPlanPanelOpen
                    ? "bg-orange-500 text-white shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent"
                )}
                data-testid="toggle-plan-panel"
                aria-label="Toggle Plan Panel"
              >
                <Kanban className="w-5 h-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right" className="ml-2">
              <div>
                <div className="font-medium">Plan</div>
                <div className="text-xs text-muted-foreground">Show lists to plan your week</div>
              </div>
            </TooltipContent>
          </Tooltip>
        </div>
      )}
    </div>
  );
}