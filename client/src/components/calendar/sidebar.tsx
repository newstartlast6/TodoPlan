import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { ProgressRing } from "@/components/ui/progress-ring";
import { UrgencyMinimap } from "@/components/ui/urgency-minimap";
import { calculateDayProgress, calculateWeekProgress, getUrgencyClass } from "@/lib/time-utils";
import { Task } from "@shared/schema";
import { useEffect, useState } from "react";

interface SidebarProps {
  tasks: Task[];
  currentView: 'day' | 'week' | 'month' | 'year';
}

export function Sidebar({ tasks, currentView }: SidebarProps) {
  const [currentTime, setCurrentTime] = useState(new Date());
  const dayProgress = calculateDayProgress();
  const weekProgress = calculateWeekProgress();
  
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // Update every minute
    
    return () => clearInterval(timer);
  }, []);

  const completedTasks = tasks.filter(task => task.completed);
  const totalTasks = tasks.length;
  const timeUtilized = weekProgress.percentage;

  return (
    <div className="w-80 bg-surface border-r border-border flex flex-col" data-testid="sidebar">
      {/* Header */}
      <div className="p-6 border-b border-border">
        <div className="flex items-center space-x-3 mb-4">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <CalendarIcon className="text-primary-foreground text-sm" />
          </div>
          <h1 className="text-xl font-bold text-foreground" data-testid="app-title">TimeFlow</h1>
        </div>
        
        {/* Current Time & Date */}
        <div className="text-sm text-muted-foreground mb-2" data-testid="current-datetime">
          {format(currentTime, "EEEE, MMMM d, yyyy • h:mm a")}
        </div>
        
        {/* Progress Ring - Current Day */}
        <div className="flex items-center space-x-3 mb-4">
          <ProgressRing progress={dayProgress.percentage} size={48} />
          <div>
            <div className="text-sm font-medium text-foreground" data-testid="day-progress-label">Day Progress</div>
            <div className={`text-xs ${getUrgencyClass(dayProgress.urgencyLevel)}`} data-testid="day-progress-remaining">
              {Math.round(dayProgress.remaining)}% remaining
            </div>
          </div>
        </div>
      </div>

      {/* Urgency Minimap Section */}
      <div className="p-6 border-b border-border">
        <UrgencyMinimap tasks={tasks} />
      </div>

      {/* Quick Stats */}
      <div className="p-6">
        <h3 className="text-sm font-semibold text-foreground mb-3" data-testid="stats-title">Week Statistics</h3>
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Tasks Completed</span>
            <span className="text-sm font-semibold text-green-600" data-testid="tasks-completed">
              {completedTasks.length}/{totalTasks}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Time Utilized</span>
            <span className="text-sm font-semibold text-primary" data-testid="time-utilized">
              {Math.round(timeUtilized)}%
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Days Remaining</span>
            <span className={`text-sm font-semibold ${getUrgencyClass(weekProgress.urgencyLevel)}`} data-testid="days-remaining">
              {(7 - Math.floor(weekProgress.elapsed / 100 * 7)).toFixed(1)} days
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
