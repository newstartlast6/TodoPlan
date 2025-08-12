import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { TimerState, TimerSession, DailyTimeSummary, DEFAULT_TIMER_CONFIG, TimerStatus } from '@shared/timer-types';
import { TimerService } from '@shared/services/timer-service';
import { apiRequest } from '@/lib/queryClient';
import { PersistenceService, TimerRecoveryManager } from '@shared/services/persistence-service';
import { SyncService, ConnectionMonitor } from '@shared/services/sync-service';
import { TimerApiClient } from '../services/timer-api-client';

// Timer state management
interface TimerContextType {
  state: TimerState;
  actions: {
    startTimer: (taskId: string) => Promise<{ success: boolean; requiresConfirmation?: boolean; currentActiveTask?: string }>;
    pauseTimer: () => Promise<{ success: boolean }>;
    resumeTimer: () => Promise<{ success: boolean }>;
    stopTimer: () => Promise<{ success: boolean }>;
    switchTimer: (taskId: string) => Promise<{ success: boolean }>;
    loadDailySummary: (date?: Date) => Promise<void>;
    confirmTimerSwitch: (newTaskId: string) => Promise<{ success: boolean }>;
    cancelTimerSwitch: () => void;
    refreshState: () => Promise<void>;
  };
  config: typeof DEFAULT_TIMER_CONFIG;
}

// Timer state reducer
type TimerAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | undefined }
  | { type: 'SET_ACTIVE_SESSION'; payload: TimerSession | undefined }
  | { type: 'SET_DAILY_SUMMARY'; payload: DailyTimeSummary[] }
  | { type: 'UPDATE_TIMER_TICK'; payload: TimerSession }
  | { type: 'SET_CONFIRMATION_NEEDED'; payload: { taskId: string; currentActiveTask: string } | undefined };

interface TimerStateWithConfirmation extends TimerState {
  confirmationNeeded?: {
    taskId: string;
    currentActiveTask: string;
  };
}

function timerReducer(state: TimerStateWithConfirmation, action: TimerAction): TimerStateWithConfirmation {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    
    case 'SET_ERROR':
      return { ...state, error: action.payload, isLoading: false };
    
    case 'SET_ACTIVE_SESSION':
      return {
        ...state,
        activeSession: action.payload,
        isLoading: false,
        error: undefined,
      };
    
    case 'SET_DAILY_SUMMARY':
      // Simplified: ignore daily summary mechanics
      return {
        ...state,
        dailySummary: [],
        totalDailySeconds: 0,
        remainingSeconds: 0,
        isLoading: false,
      };
    
    case 'UPDATE_TIMER_TICK':
      return {
        ...state,
        activeSession: action.payload,
      };
    
    case 'SET_CONFIRMATION_NEEDED':
      return {
        ...state,
        confirmationNeeded: action.payload,
        isLoading: false,
      };
    
    default:
      return state;
  }
}

const initialState: TimerStateWithConfirmation = {
  activeSession: undefined,
  dailySummary: [],
  totalDailySeconds: 0,
  remainingSeconds: DEFAULT_TIMER_CONFIG.dailyTargetHours * 60 * 60,
  isLoading: false,
  error: undefined,
  confirmationNeeded: undefined,
};

const TimerContext = createContext<TimerContextType | undefined>(undefined);

export function TimerProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(timerReducer, initialState);
  const queryClient = useQueryClient();
  const taskTitleCacheRef = React.useRef<Map<string, string>>(new Map());
  const currentTaskTitleRef = React.useRef<string>('');
  const formatTrayTime = React.useCallback((totalSeconds: number): string => {
    const seconds = Math.max(0, Math.floor(totalSeconds));
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }, []);
  const setTrayTitle = React.useCallback((seconds: number, title?: string) => {
    const anyWindow = window as any;
    const timeText = formatTrayTime(seconds);
    const text = title ? `${timeText} ${title}` : timeText;
    try { anyWindow?.electronAPI?.setTrayTitle?.(text); } catch {}
  }, [formatTrayTime]);
  
  // Initialize services
  const persistenceService = React.useMemo(() => new PersistenceService(), []);
  const apiClient = React.useMemo(() => new TimerApiClient(), []);
  const syncService = React.useMemo(() => new SyncService(persistenceService, apiClient), [persistenceService, apiClient]);
  const connectionMonitor = React.useMemo(() => new ConnectionMonitor(), []);
  const recoveryManager = React.useMemo(() => new TimerRecoveryManager(persistenceService), [persistenceService]);
  
  const timerService = React.useMemo(() => {
    return new TimerService(DEFAULT_TIMER_CONFIG, (session) => {
      // TimerService callback may pass null to clear state; align type
      dispatch({ type: 'SET_ACTIVE_SESSION', payload: session ?? undefined });
      // Notify Electron tray about state changes
      const status = timerServiceRef.current?.getStatus();
      const anyWindow = window as any;
      if (anyWindow?.electronAPI?.notifyTimerState && status !== undefined) {
        const statusMap: Record<TimerStatus, 'IDLE' | 'RUNNING' | 'PAUSED' | 'STOPPED'> = {
          idle: 'IDLE',
          running: 'RUNNING',
          paused: 'PAUSED',
          stopped: 'STOPPED',
        };
        const statusStr = statusMap[status as TimerStatus];
        anyWindow.electronAPI.notifyTimerState(statusStr);
      }
    });
  }, []);

  // Keep a ref to TimerService for status during callback
  const timerServiceRef = React.useRef<TimerService | null>(null);
  // Track the server-side session id to coordinate pause/resume/stop
  const serverSessionIdRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    timerServiceRef.current = timerService;
    return () => { timerServiceRef.current = null; };
  }, [timerService]);

  // Timer recovery on app start
  useEffect(() => {
    const performRecovery = async () => {
      try {
        dispatch({ type: 'SET_LOADING', payload: true });
        
        const recoveryCheck = await recoveryManager.checkRecovery();
        
        if (recoveryCheck.needsRecovery && recoveryCheck.recoveryData) {
          if (recoveryCheck.recoveryData.shouldPromptUser) {
            // Show recovery confirmation to user
            const confirmed = window.confirm(
              `You have an active timer for task ${recoveryCheck.recoveryData.taskId} ` +
              `that has been running for ${Math.floor(recoveryCheck.recoveryData.elapsedSeconds / 60)} minutes. ` +
              `Would you like to continue this timer?`
            );
            
            const recovery = await recoveryManager.performRecovery(confirmed);
            if (recovery.session) {
              timerService.restoreState(recovery.session, recovery.accumulatedSeconds);
            }
          } else {
            // Auto-recover short sessions
            const recovery = await recoveryManager.performRecovery(true);
            if (recovery.session) {
              timerService.restoreState(recovery.session, recovery.accumulatedSeconds);
            }
          }
        }
        
        // Load daily summary
        await loadDailySummary();
        
      } catch (error) {
        console.error('Timer recovery failed:', error);
        dispatch({ type: 'SET_ERROR', payload: 'Failed to recover timer state' });
      }
    };

    performRecovery();
  }, [recoveryManager, timerService]);

  // Auto-save active session
  useEffect(() => {
    const saveInterval = setInterval(async () => {
      if (state.activeSession) {
        try {
          await persistenceService.saveActiveSession(state.activeSession);
        } catch (error) {
          console.error('Failed to save timer state:', error);
        }
      }
    }, DEFAULT_TIMER_CONFIG.autoSaveInterval);

    return () => clearInterval(saveInterval);
  }, [state.activeSession, persistenceService]);

  // Sync with server periodically
  useEffect(() => {
    const syncInterval = setInterval(async () => {
      try {
        await syncService.syncPendingEvents();
      } catch (error) {
        console.error('Timer sync failed:', error);
      }
    }, DEFAULT_TIMER_CONFIG.syncInterval);

    return () => clearInterval(syncInterval);
  }, [syncService]);

  // Timer actions
  const startTimer = useCallback(async (taskId: string) => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      
      // Seed the local timer with the latest persisted total before starting
      try {
        const res = await apiRequest('GET', `/api/tasks/${taskId}`);
        const task: any = await res.json();
        const baseSeconds = typeof task?.timeLoggedSeconds === 'number' ? task.timeLoggedSeconds : 0;
        // Debug logging removed
        timerService.setAccumulatedSeconds(baseSeconds);
      } catch {
        // Debug logging removed
        timerService.setAccumulatedSeconds(0);
      }

      const result = await timerService.startTimer(taskId);
      
      if (result.requiresConfirmation) {
        dispatch({ 
          type: 'SET_CONFIRMATION_NEEDED', 
          payload: { taskId, currentActiveTask: result.currentActiveTask! }
        });
        return { success: false, requiresConfirmation: true, currentActiveTask: result.currentActiveTask };
      }
      
      if (result.success && result.session) {
        await persistenceService.saveActiveSession(result.session);
        // Start a server-side session to persist deltas on pause/stop
        try {
          const server = await apiClient.startTimer(taskId);
          serverSessionIdRef.current = server.session.id;
        } catch (e) {
          // Silently ignore server timer start issues
        }
        await persistenceService.queueEvent({
          id: `start_${Date.now()}`,
          type: 'start',
          taskId,
          timestamp: new Date().toISOString(),
          synced: false,
        });
      }
      
      dispatch({ type: 'SET_ERROR', payload: result.error });
      return { success: result.success };
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to start timer';
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
      return { success: false };
    }
  }, [timerService, persistenceService]);

  const pauseTimer = useCallback(async () => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      
      const result = await timerService.pauseTimer();
      
      if (result.success && result.session) {
        await persistenceService.saveActiveSession(result.session);
        // Persist the pause server-side to accumulate logged time
        try {
          await apiClient.pauseTimer(result.session.durationSeconds);
          // Refresh persisted task total in caches so UI updates immediately
          try {
            const taskId = result.session.taskId;
            const res = await apiRequest('GET', `/api/tasks/${taskId}`);
            const updatedTask = await res.json();
            // Update detail cache
            queryClient.setQueryData(['task', taskId], (old: any) => old ? { ...old, timeLoggedSeconds: updatedTask?.timeLoggedSeconds || 0 } : updatedTask);
            // Update lists cache
            queryClient.setQueriesData({ queryKey: ['/api/tasks'] }, (old: any) => Array.isArray(old) ? old.map((t) => t.id === taskId ? { ...t, timeLoggedSeconds: updatedTask?.timeLoggedSeconds || 0 } : t) : old);
          } catch {}
        } catch (e) {
          // Silently ignore server timer pause issues
        }
        await persistenceService.queueEvent({
          id: `pause_${Date.now()}`,
          type: 'pause',
          taskId: result.session.taskId,
          timestamp: new Date().toISOString(),
          synced: false,
        });
      }
      
      dispatch({ type: 'SET_ERROR', payload: result.error });
      return { success: result.success };
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to pause timer';
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
      return { success: false };
    }
  }, [timerService, persistenceService]);

  const resumeTimer = useCallback(async () => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      // Seed from persisted total before resuming to keep display == counting
      const taskId = state.activeSession?.taskId;
      if (taskId) {
        try {
          const res = await apiRequest('GET', `/api/tasks/${taskId}`);
          const task: any = await res.json();
          const baseSeconds = typeof task?.timeLoggedSeconds === 'number' ? task.timeLoggedSeconds : 0;
          // Debug logging removed
          timerService.setAccumulatedSeconds(baseSeconds);
        } catch {
          // Debug logging removed
        }
      }

      const result = await timerService.resumeTimer();
      
      if (result.success && result.session) {
        await persistenceService.saveActiveSession(result.session);
        // Resume the server session as well
        try {
          const sid = serverSessionIdRef.current;
          if (sid) {
            await apiClient.resumeTimer(sid);
          } else {
            // Fallback: fetch active and resume it
            const active = await apiClient.getActiveTimer();
            if (active) {
              serverSessionIdRef.current = active.id;
              await apiClient.resumeTimer(active.id);
            }
          }
        } catch (e) {
          // Silently ignore server timer resume issues
        }
        await persistenceService.queueEvent({
          id: `resume_${Date.now()}`,
          type: 'resume',
          taskId: result.session.taskId,
          timestamp: new Date().toISOString(),
          synced: false,
        });
      }
      
      dispatch({ type: 'SET_ERROR', payload: result.error });
      return { success: result.success };
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to resume timer';
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
      return { success: false };
    }
  }, [timerService, persistenceService]);

  const stopTimer = useCallback(async () => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      
      const result = await timerService.stopTimer();
      
      if (result.success && result.session) {
        await persistenceService.saveActiveSession(null);
        // Complete the server session and clear server session id
        try {
          await apiClient.stopTimer(result.session.durationSeconds);
          // Refresh persisted total
          try {
            const taskId = result.session.taskId;
            const res = await apiRequest('GET', `/api/tasks/${taskId}`);
            const updatedTask = await res.json();
            queryClient.setQueryData(['task', taskId], (old: any) => old ? { ...old, timeLoggedSeconds: updatedTask?.timeLoggedSeconds || 0 } : updatedTask);
            queryClient.setQueriesData({ queryKey: ['/api/tasks'] }, (old: any) => Array.isArray(old) ? old.map((t) => t.id === taskId ? { ...t, timeLoggedSeconds: updatedTask?.timeLoggedSeconds || 0 } : t) : old);
          } catch {}
        } catch (e) {
          console.error('Failed to stop server timer session', e);
        } finally {
          serverSessionIdRef.current = null;
        }
        await persistenceService.queueEvent({
          id: `stop_${Date.now()}`,
          type: 'stop',
          taskId: result.session.taskId,
          timestamp: new Date().toISOString(),
          synced: false,
        });
        
        // Refresh daily summary after stopping
        await loadDailySummary();
      }
      
      dispatch({ type: 'SET_ERROR', payload: result.error });
      return { success: result.success };
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to stop timer';
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
      return { success: false };
    }
  }, [timerService, persistenceService]);

  const switchTimer = useCallback(async (taskId: string) => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      
      // Stop the current server and local timers, then start the new one (server + local)
      const stopResult = await timerService.stopTimer();
      if (stopResult.success) {
        try { await apiClient.stopTimer(); } catch (e) { /* ignore */ }
      }
      // Seed base before starting new task
      try {
        const res = await apiRequest('GET', `/api/tasks/${taskId}`);
        const task: any = await res.json();
        const baseSeconds = typeof task?.timeLoggedSeconds === 'number' ? task.timeLoggedSeconds : 0;
        // Debug logging removed
        timerService.setAccumulatedSeconds(baseSeconds);
      } catch {
        // Debug logging removed
        timerService.setAccumulatedSeconds(0);
      }
      const result = await timerService.startTimer(taskId);
      
      if (result.success && result.session) {
        await persistenceService.saveActiveSession(result.session);
        // Start server session for the new task
        try {
          const server = await apiClient.startTimer(taskId);
          serverSessionIdRef.current = server.session.id;
        } catch (e) {
          // Silently ignore server session start issues
        }
        // Queue both stop and start events
        const now = new Date().toISOString();
        await persistenceService.queueEvent({
          id: `switch_stop_${Date.now()}`,
          type: 'stop',
          taskId: state.activeSession?.taskId || '',
          timestamp: now,
          synced: false,
        });
        await persistenceService.queueEvent({
          id: `switch_start_${Date.now()}`,
          type: 'start',
          taskId,
          timestamp: now,
          synced: false,
        });
      }
      
      dispatch({ type: 'SET_ERROR', payload: result.error });
      return { success: result.success };
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to switch timer';
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
      return { success: false };
    }
  }, [timerService, persistenceService, state.activeSession, apiClient]);

  const loadDailySummary = useCallback(async (date?: Date) => {
    try {
      const targetDate = date || new Date();
      const response = await apiClient.getDailySummary(targetDate);
      dispatch({ type: 'SET_DAILY_SUMMARY', payload: response.taskBreakdown });
    } catch (error) {
      console.error('Failed to load daily summary:', error);
    }
  }, [apiClient]);

  const confirmTimerSwitch = useCallback(async (newTaskId: string) => {
    dispatch({ type: 'SET_CONFIRMATION_NEEDED', payload: undefined });
    // Use our switch implementation (stop then start with seeding)
    return await switchTimer(newTaskId);
  }, [switchTimer]);

  const cancelTimerSwitch = useCallback(() => {
    dispatch({ type: 'SET_CONFIRMATION_NEEDED', payload: undefined });
  }, []);

  const refreshState = useCallback(async () => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      
      // Get active session from server
      const activeSession = await apiClient.getActiveTimer();
      dispatch({ type: 'SET_ACTIVE_SESSION', payload: activeSession ?? undefined });
      
      // Refresh daily summary
      await loadDailySummary();
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to refresh timer state';
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
    }
  }, [apiClient, loadDailySummary]);

  // Setup timer tick updates
  useEffect(() => {
    const handleTimerTick = (session: TimerSession) => {
      dispatch({ type: 'UPDATE_TIMER_TICK', payload: session });
      const anyWindow = window as any;
      if (anyWindow?.electronAPI?.sendTimerTick) {
        anyWindow.electronAPI.sendTimerTick(session.durationSeconds);
      }
      // Also set combined tray title with task name when available
      setTrayTitle(session.durationSeconds, currentTaskTitleRef.current || undefined);
    };

    timerService.on('timer:tick', handleTimerTick);
    
    return () => {
      timerService.off('timer:tick', handleTimerTick);
    };
  }, [timerService]);

  // Keep tray title in sync with active session/task title
  useEffect(() => {
    const active = state.activeSession;
    const anyWindow = window as any;
    if (!active) {
      currentTaskTitleRef.current = '';
      try { anyWindow?.electronAPI?.setTrayTitle?.('00:00'); } catch {}
      return;
    }

    const { taskId, durationSeconds } = active;
    const cached = taskTitleCacheRef.current.get(taskId);
    if (cached) {
      currentTaskTitleRef.current = cached;
      setTrayTitle(durationSeconds, cached);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await apiRequest('GET', `/api/tasks/${taskId}`);
        const task = await res.json();
        const title = typeof task?.title === 'string' ? task.title : '';
        if (!cancelled) {
          taskTitleCacheRef.current.set(taskId, title);
          currentTaskTitleRef.current = title;
          setTrayTitle(durationSeconds, title);
        }
      } catch {
        // Ignore
      }
    })();

    return () => { cancelled = true; };
  }, [state.activeSession, setTrayTitle]);

  // Handle tray actions from Electron
  useEffect(() => {
    const anyWindow = window as any;
    if (!anyWindow?.electronAPI?.onTrayAction) return;
    const off = anyWindow.electronAPI.onTrayAction(async (action: 'show' | 'hide' | 'pause' | 'resume' | 'stop') => {
      try {
        if (action === 'pause') await pauseTimer();
        if (action === 'resume') await resumeTimer();
        if (action === 'stop') await stopTimer();
      } catch (e) {
        console.error('Tray action failed', e);
      }
    });
    return () => { try { off?.(); } catch {} };
  }, [pauseTimer, resumeTimer, stopTimer]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      timerService.destroy();
      syncService.destroy();
    };
  }, [timerService, syncService]);

  const contextValue: TimerContextType = {
    state,
    actions: {
      startTimer,
      pauseTimer,
      resumeTimer,
      stopTimer,
      switchTimer,
      loadDailySummary,
      confirmTimerSwitch,
      cancelTimerSwitch,
      refreshState,
    },
    config: DEFAULT_TIMER_CONFIG,
  };

  return (
    <TimerContext.Provider value={contextValue}>
      {children}
    </TimerContext.Provider>
  );
}

export function useTimer() {
  const context = useContext(TimerContext);
  if (context === undefined) {
    throw new Error('useTimer must be used within a TimerProvider');
  }
  return context;
}