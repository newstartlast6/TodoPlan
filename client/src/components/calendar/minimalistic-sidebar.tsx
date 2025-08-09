import { CalendarIcon, Calendar, CalendarDays, CalendarRange, CalendarCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type CalendarView = 'day' | 'week' | 'month' | 'year';

interface MinimalisticSidebarProps {
  currentView: CalendarView;
  onViewChange: (view: CalendarView) => void;
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

export function MinimalisticSidebar({ currentView, onViewChange }: MinimalisticSidebarProps) {
  return (
    <div className="w-16 bg-surface border-r border-border flex flex-col items-center py-4" data-testid="minimalistic-sidebar">
      {/* App Logo/Icon */}
      <div className="mb-8">
        <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
          <CalendarIcon className="text-primary-foreground text-lg" />
        </div>
      </div>

      {/* View Navigation */}
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
                      ? "bg-primary text-primary-foreground shadow-sm"
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
    </div>
  );
}