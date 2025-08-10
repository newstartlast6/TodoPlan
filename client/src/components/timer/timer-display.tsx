import React from 'react';
import { Play, Pause, Square, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useTimerState, useTimerActions } from '@/hooks/use-timer-state';
import { TimerStatus } from '@shared/timer-types';
import { cn } from '@/lib/utils';

interface TimerDisplayProps {
  className?: string;
  compact?: boolean;
  showProgress?: boolean;
  estimatedMinutes?: number;
}

export function TimerDisplay({ 
  className, 
  compact = false, 
  showProgress = true,
  estimatedMinutes 
}: TimerDisplayProps) {
  const {
    activeSession,
    isTimerRunning,
    timerStatus,
    formattedElapsedTime,
    isLoading,
    error,
  } = useTimerState();

  const { pauseTimer, resumeTimer, stopTimer } = useTimerActions();

  const handlePauseResume = async () => {
    if (isTimerRunning) {
      await pauseTimer();
    } else if (activeSession && timerStatus === TimerStatus.PAUSED) {
      await resumeTimer();
    }
  };

  const handleStop = async () => {
    await stopTimer();
  };

  // Calculate progress if estimate is provided
  const progressPercentage = estimatedMinutes && activeSession
    ? Math.min((activeSession.durationSeconds / (estimatedMinutes * 60)) * 100, 100)
    : 0;

  const isOverEstimate = estimatedMinutes && activeSession
    ? activeSession.durationSeconds > (estimatedMinutes * 60)
    : false;

  if (!activeSession) {
    return null;
  }

  if (compact) {
    return (
      <div className={cn("flex items-center gap-2 text-sm", className)}>
        <div className={cn(
          "flex items-center gap-1 px-2 py-1 rounded-md",
          isTimerRunning ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"
        )}>
          <Clock className="w-3 h-3" />
          <span className="font-mono">{formattedElapsedTime}</span>
        </div>
        
        <div className="flex gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={handlePauseResume}
            disabled={isLoading}
            className="h-6 w-6 p-0"
          >
            {isTimerRunning ? (
              <Pause className="w-3 h-3" />
            ) : (
              <Play className="w-3 h-3" />
            )}
          </Button>
          
          <Button
            size="sm"
            variant="ghost"
            onClick={handleStop}
            disabled={isLoading}
            className="h-6 w-6 p-0"
          >
            <Square className="w-3 h-3" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(
      "bg-white rounded-lg border shadow-sm p-4",
      className
    )}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={cn(
            "w-2 h-2 rounded-full",
            isTimerRunning ? "bg-green-500 animate-pulse" : "bg-yellow-500"
          )} />
          <span className="text-sm font-medium text-gray-600">
            {isTimerRunning ? 'Running' : 'Paused'}
          </span>
        </div>
        
        {error && (
          <span className="text-xs text-red-600">{error}</span>
        )}
      </div>

      {/* Timer Display */}
      <div className="text-center mb-4">
        <div className="text-3xl font-mono font-bold text-gray-900 mb-1">
          {formattedElapsedTime}
        </div>
        
        {estimatedMinutes && (
          <div className="text-sm text-gray-500">
            of {Math.floor(estimatedMinutes / 60)}h {estimatedMinutes % 60}m estimated
            {isOverEstimate && (
              <span className="text-orange-600 ml-1">(over estimate)</span>
            )}
          </div>
        )}
      </div>

      {/* Progress Bar */}
      {showProgress && estimatedMinutes && (
        <div className="mb-4">
          <Progress 
            value={progressPercentage} 
            className={cn(
              "h-2",
              isOverEstimate && "bg-orange-100"
            )}
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>0m</span>
            <span>{estimatedMinutes}m</span>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="flex gap-2">
        <Button
          onClick={handlePauseResume}
          disabled={isLoading}
          variant={isTimerRunning ? "secondary" : "default"}
          className="flex-1"
        >
          {isTimerRunning ? (
            <>
              <Pause className="w-4 h-4 mr-2" />
              Pause
            </>
          ) : (
            <>
              <Play className="w-4 h-4 mr-2" />
              Resume
            </>
          )}
        </Button>
        
        <Button
          onClick={handleStop}
          disabled={isLoading}
          variant="outline"
          className="flex-1"
        >
          <Square className="w-4 h-4 mr-2" />
          Stop
        </Button>
      </div>
    </div>
  );
}