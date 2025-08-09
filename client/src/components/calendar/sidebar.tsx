import { format } from "date-fns";
import { CalendarIcon, CheckCircle, Clock, AlertCircle } from "lucide-react";
import { ProgressRing } from "@/components/ui/progress-ring";
import { calculateDayProgress, calculateWeekProgress, getUrgencyClass } from "@/lib/time-utils";
import { Task } from "@shared/schema";
import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

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

      {/* Task Summary Cards */}
      <div className="p-6 space-y-4">
        <h3 className="text-sm font-semibold text-foreground mb-4" data-testid="stats-title">Task Overview</h3>
        
        <div className="grid gap-3">
          {/* Completed Tasks */}
          <Card className="border-green-200 bg-green-50">
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <span className="text-sm font-medium text-green-700">Completed</span>
                </div>
                <Badge variant="secondary" className="bg-green-100 text-green-700" data-testid="tasks-completed">
                  {completedTasks.length}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Remaining Tasks */}
          <Card className="border-orange-200 bg-orange-50">
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Clock className="w-4 h-4 text-orange-600" />
                  <span className="text-sm font-medium text-orange-700">Remaining</span>
                </div>
                <Badge variant="secondary" className="bg-orange-100 text-orange-700" data-testid="tasks-remaining">
                  {totalTasks - completedTasks.length}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* High Priority */}
          <Card className="border-red-200 bg-red-50">
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 text-red-600" />
                  <span className="text-sm font-medium text-red-700">High Priority</span>
                </div>
                <Badge variant="secondary" className="bg-red-100 text-red-700" data-testid="tasks-high-priority">
                  {tasks.filter(task => task.priority === 'high' && !task.completed).length}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Time Utilization */}
      <div className="p-6">
        <h3 className="text-sm font-semibold text-foreground mb-3" data-testid="time-stats-title">Time Statistics</h3>
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Week Progress</span>
            <span className="text-sm font-semibold text-primary" data-testid="week-progress-text">
              {Math.round(weekProgress.percentage)}%
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
