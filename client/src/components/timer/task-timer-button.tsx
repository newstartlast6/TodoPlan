import React, { useState } from 'react';
import { Play, Pause, Clock, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTimerStore } from '@/hooks/use-timer-store';
import { TimerSwitchModal } from './timer-switch-modal';
import { cn } from '@/lib/utils';
import { TimerCalculator } from '@shared/services/timer-store';

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
  
  const timer = useTimerStore();
  const isActiveTask = timer.activeTaskId === taskId;
  const isRunning = timer.isRunning && isActiveTask;
  const persistedSeconds = Math.max(0, Math.floor(initialLoggedSeconds || 0));
  const displaySeconds = isActiveTask && isRunning ? (timer.displaySeconds || 0) : persistedSeconds;
  // Debug logging removed
  const formattedDisplayTime = TimerCalculator.formatDuration(displaySeconds);

  const start = timer.start;
  const pause = timer.pause;
  const resume = timer.resume;

  const handleTimerAction = async () => {
    if (isActiveTask) {
      if (isRunning) {
        await pause();
      } else {
        await resume(taskId);
      }
    } else {
      await start(taskId);
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
          variant={"ghost"}
          onClick={handleTimerAction}
          disabled={disabled}
          className={cn(
            "h-8 w-8 p-0",
            isActiveTask && isRunning
              ? "bg-orange-100 text-orange-700 ring-1 ring-orange-300 hover:bg-orange-200"
              : "hover:bg-muted",
            className
          )}
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
            variant={"ghost"}
            onClick={handleTimerAction}
            disabled={disabled}
            className={cn(
              "h-7 px-2",
              isActiveTask && isRunning
                ? "bg-orange-100 text-orange-700 ring-1 ring-orange-300 hover:bg-orange-200"
                : "hover:bg-muted"
            )}
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
          variant={"secondary"}
          className={cn(
            "w-full",
            isActiveTask && isRunning
              ? "bg-orange-100 text-orange-700 ring-1 ring-orange-300 hover:bg-orange-200"
              : ""
          )}
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