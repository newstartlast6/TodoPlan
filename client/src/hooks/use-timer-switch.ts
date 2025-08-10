import { useState, useCallback } from 'react';
import { useTimerState, useTimerActions } from './use-timer-state';
import { useToast } from './use-toast';

interface TimerSwitchState {
  isConfirmationOpen: boolean;
  fromTaskId?: string;
  toTaskId?: string;
  toTaskTitle?: string;
  isProcessing: boolean;
}

/**
 * Hook for managing timer switching with confirmation flow
 */
export function useTimerSwitch() {
  const [switchState, setSwitchState] = useState<TimerSwitchState>({
    isConfirmationOpen: false,
    isProcessing: false,
  });

  const { activeSession } = useTimerState();
  const { startTimer, confirmTimerSwitch, cancelTimerSwitch } = useTimerActions();
  const { toast } = useToast();

  /**
   * Attempt to start a timer, handling confirmation if needed
   */
  const requestTimerStart = useCallback(async (taskId: string, taskTitle?: string) => {
    try {
      setSwitchState(prev => ({ ...prev, isProcessing: true }));

      const result = await startTimer(taskId);

      if (result.requiresConfirmation && result.currentActiveTask) {
        // Show confirmation dialog
        setSwitchState({
          isConfirmationOpen: true,
          fromTaskId: result.currentActiveTask,
          toTaskId: taskId,
          toTaskTitle: taskTitle,
          isProcessing: false,
        });
        return { success: false, requiresConfirmation: true };
      }

      if (result.success) {
        toast({
          title: "Timer started",
          description: `Timer started for ${taskTitle || taskId}`,
        });
        
        setSwitchState({
          isConfirmationOpen: false,
          isProcessing: false,
        });
        
        return { success: true };
      }

      // Handle other errors
      toast({
        title: "Failed to start timer",
        description: "Please try again",
        variant: "destructive",
      });

      setSwitchState(prev => ({ ...prev, isProcessing: false }));
      return { success: false };

    } catch (error) {
      console.error('Timer start error:', error);
      
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      });

      setSwitchState(prev => ({ ...prev, isProcessing: false }));
      return { success: false };
    }
  }, [startTimer, toast]);

  /**
   * Confirm the timer switch
   */
  const confirmSwitch = useCallback(async () => {
    if (!switchState.toTaskId) return;

    try {
      setSwitchState(prev => ({ ...prev, isProcessing: true }));

      const result = await confirmTimerSwitch(switchState.toTaskId);

      if (result.success) {
        toast({
          title: "Timer switched",
          description: `Now tracking time for ${switchState.toTaskTitle || switchState.toTaskId}`,
        });

        setSwitchState({
          isConfirmationOpen: false,
          isProcessing: false,
        });

        return { success: true };
      }

      toast({
        title: "Failed to switch timer",
        description: "Please try again",
        variant: "destructive",
      });

      setSwitchState(prev => ({ ...prev, isProcessing: false }));
      return { success: false };

    } catch (error) {
      console.error('Timer switch error:', error);
      
      toast({
        title: "Error",
        description: "Failed to switch timer",
        variant: "destructive",
      });

      setSwitchState(prev => ({ ...prev, isProcessing: false }));
      return { success: false };
    }
  }, [switchState.toTaskId, switchState.toTaskTitle, confirmTimerSwitch, toast]);

  /**
   * Cancel the timer switch
   */
  const cancelSwitch = useCallback(() => {
    cancelTimerSwitch();
    setSwitchState({
      isConfirmationOpen: false,
      isProcessing: false,
    });

    toast({
      title: "Timer switch cancelled",
      description: "Continuing with current timer",
    });
  }, [cancelTimerSwitch, toast]);

  /**
   * Force switch without confirmation (for admin/debug purposes)
   */
  const forceSwitch = useCallback(async (taskId: string, taskTitle?: string) => {
    try {
      setSwitchState(prev => ({ ...prev, isProcessing: true }));

      const result = await confirmTimerSwitch(taskId);

      if (result.success) {
        toast({
          title: "Timer switched",
          description: `Now tracking time for ${taskTitle || taskId}`,
        });

        setSwitchState({
          isConfirmationOpen: false,
          isProcessing: false,
        });

        return { success: true };
      }

      return { success: false };

    } catch (error) {
      console.error('Force switch error:', error);
      setSwitchState(prev => ({ ...prev, isProcessing: false }));
      return { success: false };
    }
  }, [confirmTimerSwitch, toast]);

  /**
   * Check if a task can be started without confirmation
   */
  const canStartWithoutConfirmation = useCallback((taskId: string) => {
    // Can start without confirmation if:
    // 1. No active session
    // 2. Current session is for the same task
    return !activeSession || activeSession.taskId === taskId;
  }, [activeSession]);

  /**
   * Get the current active task info
   */
  const getActiveTaskInfo = useCallback(() => {
    if (!activeSession) return null;

    return {
      taskId: activeSession.taskId,
      isRunning: activeSession.isActive,
      elapsedSeconds: activeSession.durationSeconds,
    };
  }, [activeSession]);

  return {
    // State
    switchState,
    isConfirmationOpen: switchState.isConfirmationOpen,
    isProcessing: switchState.isProcessing,

    // Actions
    requestTimerStart,
    confirmSwitch,
    cancelSwitch,
    forceSwitch,

    // Utilities
    canStartWithoutConfirmation,
    getActiveTaskInfo,

    // Confirmation data
    confirmationData: switchState.isConfirmationOpen ? {
      fromTaskId: switchState.fromTaskId!,
      toTaskId: switchState.toTaskId!,
      toTaskTitle: switchState.toTaskTitle,
    } : null,
  };
}

/**
 * Hook for quick timer actions with built-in confirmation handling
 */
export function useQuickTimerActions() {
  const { requestTimerStart } = useTimerSwitch();
  const { pauseTimer, resumeTimer, stopTimer } = useTimerActions();
  const { activeSession } = useTimerState();
  const { toast } = useToast();

  const quickStart = useCallback(async (taskId: string, taskTitle?: string) => {
    const result = await requestTimerStart(taskId, taskTitle);
    return result.success;
  }, [requestTimerStart]);

  const quickPause = useCallback(async () => {
    try {
      const result = await pauseTimer();
      if (result.success) {
        toast({
          title: "Timer paused",
          description: "Time tracking paused",
        });
      }
      return result.success;
    } catch (error) {
      console.error('Quick pause error:', error);
      return false;
    }
  }, [pauseTimer, toast]);

  const quickResume = useCallback(async () => {
    try {
      const result = await resumeTimer();
      if (result.success) {
        toast({
          title: "Timer resumed",
          description: "Time tracking resumed",
        });
      }
      return result.success;
    } catch (error) {
      console.error('Quick resume error:', error);
      return false;
    }
  }, [resumeTimer, toast]);

  const quickStop = useCallback(async () => {
    try {
      const result = await stopTimer();
      if (result.success) {
        toast({
          title: "Timer stopped",
          description: "Time has been saved",
        });
      }
      return result.success;
    } catch (error) {
      console.error('Quick stop error:', error);
      return false;
    }
  }, [stopTimer, toast]);

  const quickToggle = useCallback(async (taskId: string, taskTitle?: string) => {
    if (!activeSession) {
      return await quickStart(taskId, taskTitle);
    }

    if (activeSession.taskId === taskId) {
      // Same task - toggle pause/resume
      if (activeSession.isActive) {
        return await quickPause();
      } else {
        return await quickResume();
      }
    } else {
      // Different task - start new timer (with confirmation if needed)
      return await quickStart(taskId, taskTitle);
    }
  }, [activeSession, quickStart, quickPause, quickResume]);

  return {
    quickStart,
    quickPause,
    quickResume,
    quickStop,
    quickToggle,
  };
}