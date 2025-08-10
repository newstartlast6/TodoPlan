import React, { useState } from 'react';
import { Play, Pause, Clock, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTaskTimer } from '@/hooks/use-timer-state';
import { useTimerActions } from '@/hooks/use-timer-state';
import { TimerSwitchModal } from './timer-switch-modal';
import { cn } from '@/lib/utils';

interface TaskTimerButtonProps {
  taskId: string;
  taskTitle?: string;
  variant?: 'default' | 'compact' | 'icon-only';
  className?: string;
  disabled?: boolean;
}

export function TaskTimerButton({ 
  taskId, 
  taskTitle,
  variant = 'default',
  className,
  disabled = false
}: TaskTimerButtonProps) {
  const [showSwitchModal, setShowSwitchModal] = useState(false);
  const [switchFromTask, setSwitchFromTask] = useState<string>('');
  
  const {
    isActiveTask,
    isRunning,
    formattedTotalTime,
    formattedCurrentSession,
    totalTimeSeconds,
  } = useTaskTimer(taskId);

  const { startTimer, pauseTimer } = useTimerActions();

  const handleTimerAction = async () => {
    if (isActiveTask) {
      // If this task has the active timer, pause it
      await pauseTimer();
    } else {
      // Try to start timer for this task
      const result = await startTimer(taskId);
      
      if (result.requiresConfirmation && result.currentActiveTask) {
        // Show confirmation modal
        setSwitchFromTask(result.currentActiveTask);
        setShowSwitchModal(true);
      }
    }
  };

  const handleSwitchConfirm = () => {
    setShowSwitchModal(false);
    setSwitchFromTask('');
  };

  const handleSwitchCancel = () => {
    setShowSwitchModal(false);
    setSwitchFromTask('');
  };

  // Icon-only variant
  if (variant === 'icon-only') {
    return (
      <>
        <Button
          size="sm"
          variant={isActiveTask ? (isRunning ? "default" : "secondary") : "ghost"}
          onClick={handleTimerAction}
          disabled={disabled}
          className={cn("h-8 w-8 p-0", className)}
          title={isActiveTask ? (isRunning ? 'Pause timer' : 'Timer paused') : 'Start timer'}
        >
          {isActiveTask ? (
            isRunning ? <Pause className="w-4 h-4" /> : <Clock className="w-4 h-4" />
          ) : (
            <Play className="w-4 h-4" />
          )}
        </Button>

        <TimerSwitchModal
          isOpen={showSwitchModal}
          onConfirm={handleSwitchConfirm}
          onCancel={handleSwitchCancel}
          fromTaskId={switchFromTask}
          toTaskId={taskId}
          toTaskTitle={taskTitle}
        />
      </>
    );
  }

  // Compact variant
  if (variant === 'compact') {
    return (
      <>
        <div className={cn("flex items-center gap-2", className)}>
          <Button
            size="sm"
            variant={isActiveTask ? (isRunning ? "default" : "secondary") : "ghost"}
            onClick={handleTimerAction}
            disabled={disabled}
            className="h-7 px-2"
          >
            {isActiveTask ? (
              isRunning ? (
                <>
                  <Pause className="w-3 h-3 mr-1" />
                  <span className="font-mono text-xs">{formattedCurrentSession}</span>
                </>
              ) : (
                <>
                  <Clock className="w-3 h-3 mr-1" />
                  <span className="font-mono text-xs">{formattedCurrentSession}</span>
                </>
              )
            ) : (
              <>
                <Play className="w-3 h-3 mr-1" />
                Start
              </>
            )}
          </Button>
          
          {totalTimeSeconds > 0 && !isActiveTask && (
            <span className="text-xs text-gray-500 font-mono">
              {formattedTotalTime}
            </span>
          )}
        </div>

        <TimerSwitchModal
          isOpen={showSwitchModal}
          onConfirm={handleSwitchConfirm}
          onCancel={handleSwitchCancel}
          fromTaskId={switchFromTask}
          toTaskId={taskId}
          toTaskTitle={taskTitle}
        />
      </>
    );
  }

  // Default variant
  return (
    <>
      <div className={cn("space-y-2", className)}>
        <Button
          onClick={handleTimerAction}
          disabled={disabled}
          variant={isActiveTask ? (isRunning ? "default" : "secondary") : "outline"}
          className="w-full"
        >
          {isActiveTask ? (
            isRunning ? (
              <>
                <Pause className="w-4 h-4 mr-2" />
                Pause Timer
                <span className="ml-auto font-mono">{formattedCurrentSession}</span>
              </>
            ) : (
              <>
                <Clock className="w-4 h-4 mr-2" />
                Timer Paused
                <span className="ml-auto font-mono">{formattedCurrentSession}</span>
              </>
            )
          ) : (
            <>
              <Play className="w-4 h-4 mr-2" />
              Start Timer
            </>
          )}
        </Button>

        {totalTimeSeconds > 0 && (
          <div className="flex items-center justify-between text-sm text-gray-600">
            <span>Total time today:</span>
            <span className="font-mono">{formattedTotalTime}</span>
          </div>
        )}
      </div>

      <TimerSwitchModal
        isOpen={showSwitchModal}
        onConfirm={handleSwitchConfirm}
        onCancel={handleSwitchCancel}
        fromTaskId={switchFromTask}
        toTaskId={taskId}
        toTaskTitle={taskTitle}
      />
    </>
  );
}