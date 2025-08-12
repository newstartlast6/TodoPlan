// Legacy hooks retained for compatibility in some components/tests.
// These now proxy to the new sessionless TimerStore where possible.
import { TimerStatus } from '@shared/timer-types';
import { TimerCalculator } from '@shared/services/timer-store';
import { useTimerStore } from './use-timer-store';

/**
 * Hook for accessing timer state and computed values
 */
export function useTimerState() {
  const timer = useTimerStore();

  // Computed values
  const currentElapsedSeconds = timer.displaySeconds || 0;
  const isTimerRunning = timer.isRunning;
  const currentTaskId = timer.activeTaskId || undefined;

  const timerStatus: TimerStatus = (() => {
    if (!timer.activeTaskId) return TimerStatus.IDLE;
    if (timer.isRunning) return TimerStatus.RUNNING;
    return TimerStatus.PAUSED;
  })();

  // Format current elapsed time
  const formattedElapsedTime = TimerCalculator.formatDuration(currentElapsedSeconds);

  // Daily progress removed per simplification request
  const dailyProgressPercentage = 0;
  const isOverDailyTarget = false;
  const formattedDailyTotal = '0:00';
  const formattedRemainingTime = '0:00';

  return {
    // Raw state
    activeSession: timer.activeTaskId
      ? { taskId: timer.activeTaskId, isActive: timer.isRunning, durationSeconds: timer.displaySeconds } as any
      : undefined,
    dailySummary: [],
    isLoading: false,
    error: undefined,

    // Computed values
    currentElapsedSeconds,
    isTimerRunning,
    currentTaskId,
    timerStatus,
    formattedElapsedTime,

    // Daily progress
    totalDailySeconds: 0,
    remainingSeconds: 0,
    dailyProgressPercentage,
    isOverDailyTarget,
    formattedDailyTotal,
    formattedRemainingTime,

    // Config
    dailyTargetHours: 0,
  };
}

/**
 * Hook for timer actions
 */
export function useTimerActions() {
  const timer = useTimerStore();
  return {
    startTimer: async (taskId: string) => { await timer.start(taskId); return { success: true }; },
    pauseTimer: async () => { await timer.pause(); return { success: true }; },
    resumeTimer: async () => { if (timer.activeTaskId) { await timer.resume(timer.activeTaskId); } return { success: true }; },
    stopTimer: async () => { await timer.stop(); return { success: true }; },
    switchTimer: async (taskId: string) => { await timer.stop(); await timer.start(taskId); return { success: true }; },
    loadDailySummary: async () => {},
    confirmTimerSwitch: async (newTaskId: string) => { await timer.stop(); await timer.start(newTaskId); return { success: true }; },
    cancelTimerSwitch: () => {},
    refreshState: async () => { await timer.restore(); },
  } as any;
}

/**
 * Hook for task-specific timer data
 */
export function useTaskTimer(taskId: string) {
  const timer = useTimerStore();
  
  // Find sessions for this task
  const totalTaskSeconds = 0;
  const sessionCount = 0;
  
  // Check if this task has the active timer
  const isActiveTask = timer.activeTaskId === taskId;
  const isRunning = isActiveTask && timer.isRunning;
  
  // Current session time for this task (if active)
  const currentSessionSeconds = isActiveTask ? (timer.displaySeconds || 0) : 0;
  
  // Total time including current session
  const totalTimeSeconds = totalTaskSeconds + (isActiveTask ? currentSessionSeconds : 0);
  
  return {
    taskId,
    isActiveTask,
    isRunning,
    totalTaskSeconds,
    currentSessionSeconds,
    totalTimeSeconds,
    sessionCount,
    formattedTotalTime: TimerCalculator.formatDuration(totalTimeSeconds),
    formattedCurrentSession: TimerCalculator.formatDuration(currentSessionSeconds),
  };
}

/**
 * Hook for timer progress against estimates
 */
export function useTimerProgress(taskId: string, estimatedMinutes?: number) {
  const taskTimer = useTaskTimer(taskId);
  
  if (!estimatedMinutes) {
    return {
      hasEstimate: false,
      progressPercentage: 0,
      isOverEstimate: false,
      remainingSeconds: 0,
      formattedRemaining: '0:00',
    };
  }

  const estimatedSeconds = estimatedMinutes * 60;
  const progressPercentage = TimerCalculator.calculateProgress(taskTimer.totalTimeSeconds, estimatedSeconds);
  const isOverEstimate = TimerCalculator.isOverEstimate(taskTimer.totalTimeSeconds, estimatedSeconds);
  const remainingSeconds = Math.max(0, estimatedSeconds - taskTimer.totalTimeSeconds);

  return {
    hasEstimate: true,
    estimatedSeconds,
    progressPercentage,
    isOverEstimate,
    remainingSeconds,
    formattedRemaining: TimerCalculator.formatDuration(remainingSeconds),
    formattedEstimate: TimerCalculator.formatDuration(estimatedSeconds),
  };
}

/**
 * Hook for daily timer statistics
 */
export function useDailyTimerStats(date?: Date) {
  const targetDate = date || new Date();
  const dateString = targetDate.toISOString().split('T')[0];
  const totalSeconds = 0;
  const targetSeconds = 8 * 60 * 60;
  const remainingSeconds = targetSeconds;
  return {
    date: dateString,
    totalSeconds,
    remainingSeconds,
    progressPercentage: 0,
    isOverTarget: false,
    taskCount: 0,
    sessionCount: 0,
    mostWorkedTask: null as any,
    tasks: [] as any[],
    formattedTotal: TimerCalculator.formatDuration(totalSeconds),
    formattedRemaining: TimerCalculator.formatDuration(remainingSeconds),
    formattedTarget: TimerCalculator.formatDuration(targetSeconds),
  };
}