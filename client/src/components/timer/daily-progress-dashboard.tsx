import React, { useState } from 'react';
import { Calendar, Clock, Target, TrendingUp, Award, ChevronLeft, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useDailyTimerStats } from '@/hooks/use-timer-state';
import { DailySummary } from './daily-summary';
import { cn } from '@/lib/utils';

interface DailyProgressDashboardProps {
  className?: string;
  initialDate?: Date;
}

export function DailyProgressDashboard({
  className,
  initialDate = new Date(),
}: DailyProgressDashboardProps) {
  const [selectedDate, setSelectedDate] = useState(initialDate);
  
  const {
    totalSeconds,
    remainingSeconds,
    progressPercentage,
    isOverTarget,
    taskCount,
    sessionCount,
    mostWorkedTask,
    formattedTotal,
    formattedRemaining,
    formattedTarget,
  } = useDailyTimerStats(selectedDate);

  const navigateDate = (direction: 'prev' | 'next') => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + (direction === 'next' ? 1 : -1));
    setSelectedDate(newDate);
  };

  const goToToday = () => {
    setSelectedDate(new Date());
  };

  const isToday = selectedDate.toDateString() === new Date().toDateString();
  const isYesterday = selectedDate.toDateString() === new Date(Date.now() - 24 * 60 * 60 * 1000).toDateString();

  const getDateLabel = () => {
    if (isToday) return 'Today';
    if (isYesterday) return 'Yesterday';
    return selectedDate.toLocaleDateString('en-US', { 
      weekday: 'long', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const getProgressStatus = () => {
    if (isOverTarget) {
      return {
        status: 'exceeded',
        color: 'text-green-600',
        bgColor: 'bg-green-50',
        borderColor: 'border-green-200',
        icon: Award,
        message: 'Target exceeded! Great work!',
      };
    } else if (progressPercentage >= 75) {
      return {
        status: 'near-target',
        color: 'text-blue-600',
        bgColor: 'bg-blue-50',
        borderColor: 'border-blue-200',
        icon: TrendingUp,
        message: 'Almost there! Keep going!',
      };
    } else if (progressPercentage >= 50) {
      return {
        status: 'on-track',
        color: 'text-yellow-600',
        bgColor: 'bg-yellow-50',
        borderColor: 'border-yellow-200',
        icon: Target,
        message: 'Good progress so far',
      };
    } else {
      return {
        status: 'getting-started',
        color: 'text-gray-600',
        bgColor: 'bg-gray-50',
        borderColor: 'border-gray-200',
        icon: Clock,
        message: totalSeconds > 0 ? 'Keep building momentum' : 'Ready to start tracking?',
      };
    }
  };

  const progressStatus = getProgressStatus();
  const StatusIcon = progressStatus.icon;

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header with Date Navigation */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Calendar className="w-5 h-5 text-blue-600" />
              <CardTitle className="text-xl">
                Daily Progress
              </CardTitle>
            </div>
            
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigateDate('prev')}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              
              <div className="flex items-center gap-2 min-w-[140px] justify-center">
                <span className="font-medium">{getDateLabel()}</span>
                {!isToday && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={goToToday}
                    className="text-xs"
                  >
                    Today
                  </Button>
                )}
              </div>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigateDate('next')}
                disabled={isToday}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Main Progress Display */}
          <div className="text-center space-y-4">
            <div className="space-y-2">
              <div className="text-4xl font-bold font-mono text-gray-900">
                {formattedTotal}
              </div>
              <div className="text-sm text-gray-600">
                of {formattedTarget} daily target
              </div>
            </div>

            <div className="max-w-md mx-auto space-y-2">
              <Progress 
                value={Math.min(progressPercentage, 100)} 
                className={cn(
                  "h-3",
                  isOverTarget && "bg-green-100"
                )}
              />
              <div className="flex justify-between text-xs text-gray-500">
                <span>0h</span>
                <span className="font-medium">
                  {Math.round(progressPercentage)}%
                </span>
                <span>8h</span>
              </div>
            </div>
          </div>

          {/* Status Message */}
          <div className={cn(
            "flex items-center gap-3 p-4 rounded-lg",
            progressStatus.bgColor,
            progressStatus.borderColor,
            "border"
          )}>
            <StatusIcon className={cn("w-5 h-5", progressStatus.color)} />
            <div className="flex-1">
              <div className={cn("font-medium", progressStatus.color)}>
                {progressStatus.message}
              </div>
              {!isOverTarget && remainingSeconds > 0 && (
                <div className="text-sm text-gray-600">
                  {formattedRemaining} remaining to reach your goal
                </div>
              )}
              {isOverTarget && (
                <div className="text-sm text-green-600">
                  You've worked {Math.abs(remainingSeconds / 3600).toFixed(1)} hours over your target!
                </div>
              )}
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-gray-900">
                {taskCount}
              </div>
              <div className="text-xs text-gray-600">
                Tasks Worked
              </div>
            </div>
            
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-gray-900">
                {sessionCount}
              </div>
              <div className="text-xs text-gray-600">
                Timer Sessions
              </div>
            </div>
            
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-gray-900">
                {sessionCount > 0 ? Math.round(totalSeconds / sessionCount / 60) : 0}m
              </div>
              <div className="text-xs text-gray-600">
                Avg Session
              </div>
            </div>
          </div>

          {/* Most Worked Task */}
          {mostWorkedTask && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Award className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-800">
                  Most Focused Task
                </span>
              </div>
              <div className="text-sm text-blue-900 font-medium">
                {mostWorkedTask.task?.title || mostWorkedTask.taskId}
              </div>
              <div className="text-xs text-blue-700">
                {Math.floor(mostWorkedTask.totalSeconds / 3600)}h{' '}
                {Math.floor((mostWorkedTask.totalSeconds % 3600) / 60)}m
                {' '}({mostWorkedTask.sessionCount} sessions)
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detailed Summary */}
      <DailySummary date={selectedDate} />
    </div>
  );
}

/**
 * Compact daily progress widget for sidebars
 */
export function DailyProgressWidget({ className }: { className?: string }) {
  const {
    totalSeconds,
    remainingSeconds,
    progressPercentage,
    isOverTarget,
    formattedTotal,
    formattedRemaining,
  } = useDailyTimerStats();

  return (
    <Card className={cn("bg-gradient-to-br from-blue-50 to-indigo-50", className)}>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Target className="w-4 h-4 text-blue-600" />
          <span className="text-sm font-medium text-blue-900">
            Daily Target
          </span>
          <Badge 
            variant={isOverTarget ? "default" : "secondary"}
            className="ml-auto text-xs"
          >
            {Math.round(progressPercentage)}%
          </Badge>
        </div>

        <div className="space-y-2">
          <div className="text-lg font-bold font-mono text-gray-900">
            {formattedTotal}
          </div>
          
          <Progress 
            value={Math.min(progressPercentage, 100)} 
            className={cn(
              "h-2",
              isOverTarget && "bg-green-100"
            )}
          />
          
          <div className="text-xs text-gray-600">
            {isOverTarget 
              ? `${Math.abs(remainingSeconds / 3600).toFixed(1)}h over target!`
              : `${formattedRemaining} remaining`
            }
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Weekly progress overview
 */
export function WeeklyProgressOverview({ className }: { className?: string }) {
  const [weekStart, setWeekStart] = useState(() => {
    const date = new Date();
    const day = date.getDay();
    const diff = date.getDate() - day;
    return new Date(date.setDate(diff));
  });

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + i);
    return date;
  });

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-blue-600" />
          Weekly Overview
        </CardTitle>
      </CardHeader>
      
      <CardContent>
        <div className="grid grid-cols-7 gap-2">
          {weekDays.map((date, index) => {
            const { totalSeconds, progressPercentage, isOverTarget } = useDailyTimerStats(date);
            const isToday = date.toDateString() === new Date().toDateString();
            
            return (
              <div
                key={index}
                className={cn(
                  "text-center p-2 rounded-lg border",
                  isToday ? "bg-blue-50 border-blue-200" : "bg-gray-50 border-gray-200"
                )}
              >
                <div className="text-xs font-medium text-gray-600 mb-1">
                  {date.toLocaleDateString('en-US', { weekday: 'short' })}
                </div>
                <div className="text-xs font-mono text-gray-900 mb-1">
                  {Math.floor(totalSeconds / 3600)}h {Math.floor((totalSeconds % 3600) / 60)}m
                </div>
                <div className={cn(
                  "w-full h-1 rounded-full",
                  isOverTarget ? "bg-green-400" : progressPercentage > 0 ? "bg-blue-400" : "bg-gray-200"
                )} 
                style={{ 
                  background: isOverTarget 
                    ? '#10b981' 
                    : `linear-gradient(to right, #3b82f6 ${Math.min(progressPercentage, 100)}%, #e5e7eb ${Math.min(progressPercentage, 100)}%)`
                }}
                />
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}