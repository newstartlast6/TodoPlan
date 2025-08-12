import React, { useState } from 'react';
import { Play, Pause, Clock, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTaskTimer } from '@/hooks/use-timer-state';
import { useTimerActions } from '@/hooks/use-timer-state';
import { TimerSwitchModal } from './timer-switch-modal';
import { cn } from '@/lib/utils';
import { TimerCalculator } from '@shared/services/timer-service';

interface TaskTimerButtonProps {
  taskId: string;
  taskTitle?: string;
  variant?: 'default' | 'compact' | 'icon-only';
  className?: string;
  disabled?: boolean;
  initialLoggedSeconds?: number; // persisted all-time total for this task
}

export function TaskTimerButton({ 
  taskId, 
  taskTitle,
  variant = 'default',
  className,
  disabled = false,
  initialLoggedSeconds = 0,
}: TaskTimerButtonProps) {
  const [showSwitchModal, setShowSwitchModal] = useState(false);
  const [switchFromTask, setSwitchFromTask] = useState<string>('');
  
  const { isActiveTask, isRunning, currentSessionSeconds } = useTaskTimer(taskId);
  const persistedSeconds = Math.max(0, Math.floor(initialLoggedSeconds || 0));
  const displaySeconds = isActiveTask && isRunning ? (currentSessionSeconds || 0) : persistedSeconds;
  // Debug logging removed
  const formattedDisplayTime = TimerCalculator.formatDuration(displaySeconds);

  const { startTimer, pauseTimer, resumeTimer } = useTimerActions();

  const handleTimerAction = async () => {
    if (isActiveTask) {
      if (isRunning) {
        await pauseTimer();
      } else {
        await resumeTimer();
      }
    } else {
      const result = await startTimer(taskId);
      if (result.requiresConfirmation && result.currentActiveTask) {
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
          variant={isActiveTask ? (isRunning ? "default" : "default") : "ghost"}
          onClick={handleTimerAction}
          disabled={disabled}
          className={cn("h-8 w-8 p-0", className)}
          title={isActiveTask ? (isRunning ? 'Pause timer' : 'Start timer') : 'Start timer'}
        >
          {isActiveTask ? (
            isRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />
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
            variant={isActiveTask ? (isRunning ? "default" : "default") : "ghost"}
            onClick={handleTimerAction}
            disabled={disabled}
            className="h-7 px-2"
          >
            {isActiveTask ? (
              isRunning ? (
                <Pause className="w-3 h-3" />
              ) : (
                <Play className="w-3 h-3" />
              )
            ) : (
              <Play className="w-3 h-3" />
            )}
          </Button>
          
          {/* No additional label to avoid duplicate time display */}
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
          variant={isActiveTask ? (isRunning ? "default" : "default") : "default"}
          className="w-full"
        >
          {isActiveTask ? (
            isRunning ? (
              <>
                <Pause className="w-4 h-4 mr-2" />
                Pause
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-2" />
                Start
              </>
            )
          ) : (
            <>
              <Play className="w-4 h-4 mr-2" />
              Start
            </>
          )}
        </Button>

        {/* Removed extra "Time logged" row to avoid duplication with list item/detail pane */}
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