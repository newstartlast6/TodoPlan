import React from 'react';
import { Clock, Target, TrendingUp, Calendar } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useDailyTimerStats } from '@/hooks/use-timer-state';
import { cn } from '@/lib/utils';

interface DailySummaryProps {
  date?: Date;
  className?: string;
  compact?: boolean;
}

export function DailySummary({ 
  date, 
  className,
  compact = false 
}: DailySummaryProps) {
  const {
    totalSeconds,
    remainingSeconds,
    progressPercentage,
    isOverTarget,
    taskCount,
    sessionCount,
    mostWorkedTask,
    tasks,
    formattedTotal,
    formattedRemaining,
    formattedTarget,
  } = useDailyTimerStats(date);

  if (compact) {
    return (
      <div className={cn("bg-white rounded-lg border p-3", className)}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-medium">Daily Progress</span>
          </div>
          <span className="text-xs text-gray-500">
            {Math.round(progressPercentage)}%
          </span>
        </div>
        
        <Progress 
          value={progressPercentage} 
          className={cn(
            "h-2 mb-2",
            isOverTarget && "bg-green-100"
          )}
        />
        
        <div className="flex justify-between text-xs text-gray-600">
          <span className="font-mono">{formattedTotal}</span>
          <span className="font-mono">
            {isOverTarget ? `+${formattedRemaining}` : formattedRemaining} left
          </span>
        </div>
      </div>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Calendar className="w-5 h-5 text-blue-600" />
          Daily Summary
          <span className="text-sm font-normal text-gray-500 ml-auto">
            {date?.toLocaleDateString() || 'Today'}
          </span>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Progress Overview */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Daily Target Progress</span>
            <span className="text-sm text-gray-600">
              {Math.round(progressPercentage)}%
            </span>
          </div>
          
          <Progress 
            value={progressPercentage} 
            className={cn(
              "h-3",
              isOverTarget && "bg-green-100"
            )}
          />
          
          <div className="flex justify-between text-xs text-gray-600">
            <span>0h</span>
            <span className="font-mono font-medium">
              {formattedTotal} / {formattedTarget}
            </span>
            <span>8h</span>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-blue-50 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-4 h-4 text-blue-600" />
              <span className="text-xs font-medium text-blue-800">
                Time Logged
              </span>
            </div>
            <div className="text-lg font-bold text-blue-900 font-mono">
              {formattedTotal}
            </div>
          </div>

          <div className="bg-green-50 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <Target className="w-4 h-4 text-green-600" />
              <span className="text-xs font-medium text-green-800">
                {isOverTarget ? 'Overtime' : 'Remaining'}
              </span>
            </div>
            <div className={cn(
              "text-lg font-bold font-mono",
              isOverTarget ? "text-green-900" : "text-green-700"
            )}>
              {isOverTarget ? `+${formattedRemaining}` : formattedRemaining}
            </div>
          </div>

          <div className="bg-purple-50 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-purple-600" />
              <span className="text-xs font-medium text-purple-800">
                Tasks Worked
              </span>
            </div>
            <div className="text-lg font-bold text-purple-900">
              {taskCount}
            </div>
          </div>

          <div className="bg-orange-50 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-4 h-4 text-orange-600" />
              <span className="text-xs font-medium text-orange-800">
                Sessions
              </span>
            </div>
            <div className="text-lg font-bold text-orange-900">
              {sessionCount}
            </div>
          </div>
        </div>

        {/* Task Breakdown */}
        {tasks.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-gray-700">
              Task Breakdown
            </h4>
            
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {tasks
                .sort((a, b) => b.totalSeconds - a.totalSeconds)
                .map((task) => {
                  const taskPercentage = (task.totalSeconds / totalSeconds) * 100;
                  const taskHours = Math.floor(task.totalSeconds / 3600);
                  const taskMinutes = Math.floor((task.totalSeconds % 3600) / 60);
                  
                  return (
                    <div key={task.taskId} className="flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium text-gray-700 truncate">
                            {task.task?.title || task.taskId}
                          </span>
                          <span className="text-xs text-gray-500 font-mono">
                            {taskHours > 0 ? `${taskHours}h ` : ''}{taskMinutes}m
                          </span>
                        </div>
                        <Progress value={taskPercentage} className="h-1" />
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* Most Worked Task */}
        {mostWorkedTask && (
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="text-xs font-medium text-gray-600 mb-1">
              Most worked task today
            </div>
            <div className="text-sm font-medium text-gray-900">
              {mostWorkedTask.task?.title || mostWorkedTask.taskId}
            </div>
            <div className="text-xs text-gray-600 font-mono">
              {Math.floor(mostWorkedTask.totalSeconds / 3600)}h{' '}
              {Math.floor((mostWorkedTask.totalSeconds % 3600) / 60)}m
              {' '}({mostWorkedTask.sessionCount} sessions)
            </div>
          </div>
        )}

        {/* Empty State */}
        {tasks.length === 0 && (
          <div className="text-center py-6 text-gray-500">
            <Clock className="w-8 h-8 mx-auto mb-2 text-gray-300" />
            <p className="text-sm">No time logged today</p>
            <p className="text-xs">Start a timer to begin tracking your work</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}