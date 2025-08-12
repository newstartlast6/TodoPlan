import { useTimer } from '../contexts/timer-context';
import { TimerStatus } from '@shared/timer-types';
import { TimerCalculator } from '@shared/services/timer-service';

/**
 * Hook for accessing timer state and computed values
 */
export function useTimerState() {
  const { state, config } = useTimer();

  // Computed values
  const currentElapsedSeconds = state.activeSession?.durationSeconds || 0;
  const isTimerRunning = state.activeSession?.isActive || false;
  const currentTaskId = state.activeSession?.taskId;

  const timerStatus: TimerStatus = (() => {
    if (!state.activeSession) return TimerStatus.IDLE;
    if (state.activeSession.isActive) return TimerStatus.RUNNING;
    if (state.activeSession.endTime) return TimerStatus.STOPPED;
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
    activeSession: state.activeSession,
    dailySummary: state.dailySummary,
    isLoading: state.isLoading,
    error: state.error,

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
  const { actions } = useTimer();
  return actions;
}

/**
 * Hook for task-specific timer data
 */
export function useTaskTimer(taskId: string) {
  const { state } = useTimer();
  
  // Find sessions for this task
  const taskSessions = state.dailySummary.filter(summary => summary.taskId === taskId);
  const totalTaskSeconds = taskSessions.reduce((sum, session) => sum + session.totalSeconds, 0);
  const sessionCount = taskSessions.reduce((sum, session) => sum + session.sessionCount, 0);
  
  // Check if this task has the active timer
  const isActiveTask = state.activeSession?.taskId === taskId;
  const isRunning = isActiveTask && state.activeSession?.isActive;
  
  // Current session time for this task (if active)
  const currentSessionSeconds = isActiveTask ? (state.activeSession?.durationSeconds || 0) : 0;
  
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
  const { state } = useTimer();
  const targetDate = date || new Date();
  
  // Filter summary for the target date
  const dateString = targetDate.toISOString().split('T')[0];
  const dayTasks = state.dailySummary.filter(summary => summary.date === dateString);
  
  const totalSeconds = dayTasks.reduce((sum, task) => sum + task.totalSeconds, 0);
  const taskCount = dayTasks.length;
  const sessionCount = dayTasks.reduce((sum, task) => sum + task.sessionCount, 0);
  
  const targetSeconds = 8 * 60 * 60; // 8 hours
  const remainingSeconds = Math.max(0, targetSeconds - totalSeconds);
  const progressPercentage = (totalSeconds / targetSeconds) * 100;
  const isOverTarget = totalSeconds > targetSeconds;
  
  // Find most worked task
  const mostWorkedTask = dayTasks.reduce((max, task) => 
    task.totalSeconds > (max?.totalSeconds || 0) ? task : max, 
    null as typeof dayTasks[0] | null
  );

  return {
    date: dateString,
    totalSeconds,
    remainingSeconds,
    progressPercentage,
    isOverTarget,
    taskCount,
    sessionCount,
    mostWorkedTask,
    tasks: dayTasks,
    formattedTotal: TimerCalculator.formatDuration(totalSeconds),
    formattedRemaining: TimerCalculator.formatDuration(remainingSeconds),
    formattedTarget: TimerCalculator.formatDuration(targetSeconds),
  };
}