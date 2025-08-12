import { useEffect, useState } from 'react';
import { TimerStore, type TimerStoreState } from '@shared/services/timer-store';
import { queryClient, apiRequest } from '@/lib/queryClient';

export function initTimerStore() {
  TimerStore.init({
    loadTaskBaseSeconds: async (taskId: string) => {
      const res = await apiRequest('GET', `/api/tasks/${taskId}`);
      const task: any = await res.json();
      return Math.max(0, Math.floor((task?.timeLoggedSeconds ?? task?.time_logged_seconds ?? 0) || 0));
    },
    saveTimeLogged: async (taskId: string, absoluteSeconds: number) => {
      const res = await apiRequest('PUT', `/api/tasks/${taskId}/time-logged`, { timeLoggedSeconds: absoluteSeconds });
      const updated = await res.json();
      // Update caches
      queryClient.setQueryData(['task', taskId], (old: any) => old ? { ...old, timeLoggedSeconds: updated?.timeLoggedSeconds ?? updated?.time_logged_seconds ?? 0 } : updated);
      queryClient.setQueriesData({ queryKey: ['/api/tasks'] }, (old: any) => Array.isArray(old) ? old.map((t) => t.id === taskId ? { ...t, timeLoggedSeconds: updated?.timeLoggedSeconds ?? updated?.time_logged_seconds ?? 0 } : t) : old);
    },
    onTick: () => {},
    onChange: () => {},
    setTrayTitle: (text: string) => {
      const anyWindow = window as any;
      try { anyWindow?.electronAPI?.setTrayTitle?.(text); } catch {}
    },
  });
  // Attempt to restore any active timer persisted locally
  try { void TimerStore.restoreActiveState(); } catch {}
}

export function useTimerStore() {
  const [state, setState] = useState<TimerStoreState>({
    activeTaskId: null,
    startedAtMs: null,
    baseSecondsAtStart: 0,
    currentSeconds: 0,
  });

  useEffect(() => {
    const unsubscribe = TimerStore.subscribe((s) => setState(s));
    return () => { unsubscribe(); };
  }, []);

  return {
    state,
    isRunning: !!(state.activeTaskId && state.startedAtMs),
    activeTaskId: state.activeTaskId,
    displaySeconds: state.currentSeconds,
    start: TimerStore.start.bind(TimerStore),
    pause: TimerStore.pause.bind(TimerStore),
    resume: TimerStore.resume.bind(TimerStore),
    stop: TimerStore.stop.bind(TimerStore),
    restore: TimerStore.restoreActiveState.bind(TimerStore),
  } as const;
}


