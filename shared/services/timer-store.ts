/*
  Framework-agnostic single-source timer store.
  Sessionless: writes absolute time only on pause/stop via provided save function.
*/

export type InitializeTimerStoreParams = {
  loadTaskBaseSeconds: (taskId: string) => Promise<number>;
  loadTaskName: (taskId: string) => Promise<string>;
  saveTimeLogged: (taskId: string, absoluteSeconds: number) => Promise<void>;
  onTick?: (seconds: number) => void;
  onChange?: (state: TimerStoreState) => void;
  setTrayTitle?: (text: string) => void;
  maxTrayTitleLength?: number; // Maximum characters for tray title (default: 25)
};

export type TimerStoreState = {
  activeTaskId: string | null;
  activeTaskName: string | null;
  startedAtMs: number | null;
  baseSecondsAtStart: number;
  currentSeconds: number; // authoritative display seconds
  sessionSeconds: number; // seconds in current session only
  hasActiveSession: boolean; // true if there's a session that can be discarded
};

type PersistedActive = {
  activeTaskId: string;
  activeTaskName: string;
  startedAtMs: number;
  baseSecondsAtStart: number;
};

type PendingUpdate = {
  taskId: string;
  absoluteSeconds: number;
  enqueuedAt: number;
};

class WorkerClock {
  private worker: Worker | null = null;
  private onTick: (() => void) | null = null;

  constructor() {
    try {
      const anyWindow = globalThis as any;
      const url = anyWindow?.electronAPI?.getPublicAssetUrl
        ? anyWindow.electronAPI.getPublicAssetUrl('timer-worker.js')
        : '/timer-worker.js';
      this.worker = new Worker(url);
      this.worker.addEventListener('message', (evt: MessageEvent) => {
        const { type } = evt.data || {};
        if (type === 'TIMER_TICK') {
          this.onTick?.();
        }
      });
    } catch {
      this.worker = null;
    }
  }

  start(taskId: string, accumulatedSeconds: number): void {
    if (this.worker) {
      this.worker.postMessage({
        type: 'START_TIMER',
        payload: { taskId, sessionId: null, accumulatedSeconds }
      });
    }
  }

  pause(): void {
    if (this.worker) {
      this.worker.postMessage({ type: 'PAUSE_TIMER' });
    }
  }

  stop(): void {
    if (this.worker) {
      this.worker.postMessage({ type: 'STOP_TIMER' });
    }
  }

  setOnTick(cb: () => void) {
    this.onTick = cb;
  }
}

class FallbackClock {
  private interval: number | null = null;
  private onTick: (() => void) | null = null;

  start(): void {
    this.stop();
    this.interval = (setInterval(() => this.onTick?.(), 1000) as unknown) as number;
  }

  pause(): void {
    this.stop();
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval as any);
      this.interval = null;
    }
  }

  setOnTick(cb: () => void) {
    this.onTick = cb;
  }
}

class TimerStoreImpl {
  private params!: InitializeTimerStoreParams;
  private state: TimerStoreState = {
    activeTaskId: null,
    activeTaskName: null,
    startedAtMs: null,
    baseSecondsAtStart: 0,
    currentSeconds: 0,
    sessionSeconds: 0,
    hasActiveSession: false,
  };
  private clock: WorkerClock | FallbackClock;
  private listeners: Set<(state: TimerStoreState) => void> = new Set();
  private ticksElapsedSeconds: number = 0;

  constructor() {
    // Try worker first, fall back to setInterval
    const worker = new WorkerClock();
    const fallback = new FallbackClock();
    // Use worker for onTick events if available, else fallback
    worker.setOnTick(() => this.handleTick());
    fallback.setOnTick(() => this.handleTick());
    // Choose implementation based on worker availability
    if ((worker as any)['worker']) {
      this.clock = worker;
    } else {
      this.clock = fallback;
    }
  }

  init(params: InitializeTimerStoreParams) {
    this.params = params;
    this.emitChange();
    // Handle visibility change to resync drift occasionally
    try {
      document?.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && this.state.activeTaskId && this.state.startedAtMs) {
          // Re-seed from wall clock once when tab becomes visible to correct drift
          const elapsed = Math.max(0, Math.floor((Date.now() - this.state.startedAtMs) / 1000));
          this.ticksElapsedSeconds = elapsed;
          this.state.currentSeconds = this.state.baseSecondsAtStart + this.ticksElapsedSeconds;
          this.emitChange();
          // Optional: rebase from server if server is ahead
          void this.rebaseFromServerIfAhead(this.state.activeTaskId);
        }
      });
      window?.addEventListener('online', () => { void this.flushPendingUpdates(); });
    } catch {}
    // Attempt to flush any pending updates on init if online
    try { if (navigator.onLine) { void this.flushPendingUpdates(); } } catch {}
  }

  async start(taskId: string): Promise<void> {
    // If switching tasks, ensure pause first
    if (this.state.activeTaskId && this.state.activeTaskId !== taskId) {
      await this.pause();
    }
    const [base, taskName] = await Promise.all([
      this.params.loadTaskBaseSeconds(taskId),
      this.params.loadTaskName(taskId)
    ]);
    const now = Date.now();
    this.state = {
      activeTaskId: taskId,
      activeTaskName: taskName,
      startedAtMs: now,
      baseSecondsAtStart: Math.max(0, Math.floor(base || 0)),
      currentSeconds: Math.max(0, Math.floor(base || 0)),
      sessionSeconds: 0,
      hasActiveSession: false, // Will become true when ticking starts
    };
    this.ticksElapsedSeconds = 0;
    this.persistActiveState();
    if (this.clock instanceof WorkerClock) {
      (this.clock as WorkerClock).start(taskId, this.state.baseSecondsAtStart);
    } else {
      (this.clock as FallbackClock).start();
    }
    this.emitChange();
  }

  async resume(taskId: string): Promise<void> {
    await this.start(taskId);
  }

  async pause(): Promise<void> {
    if (!this.state.activeTaskId || !this.state.startedAtMs) {
      return;
    }
    // Compute absolute
    const elapsed = Math.max(0, Math.floor((Date.now() - this.state.startedAtMs) / 1000));
    const absolute = this.state.baseSecondsAtStart + elapsed;
    const taskId = this.state.activeTaskId;

    // Stop ticking first
    if (this.clock instanceof WorkerClock) {
      (this.clock as WorkerClock).pause();
    } else {
      (this.clock as FallbackClock).pause();
    }

    // Try to persist server absolute; if offline or failed, enqueue for later flush
    let saved = false;
    try {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        throw new Error('offline');
      }
      await this.params.saveTimeLogged(taskId, absolute);
      saved = true;
    } catch {
      this.enqueuePendingUpdate({ taskId, absoluteSeconds: absolute, enqueuedAt: Date.now() });
    }

    // Clear active but keep session info for potential discard
    this.state = {
      activeTaskId: taskId, // Keep task ID for potential resume
      activeTaskName: this.state.activeTaskName,
      startedAtMs: null,
      baseSecondsAtStart: this.state.baseSecondsAtStart,
      currentSeconds: absolute,
      sessionSeconds: elapsed,
      hasActiveSession: elapsed > 0, // Only if there was actual time logged
    };
    this.ticksElapsedSeconds = 0;
    this.clearPersistedActive();
    this.emitChange();

    // If save was not successful, best-effort flush in background if/when online
    if (!saved) {
      try { if (navigator.onLine) { void this.flushPendingUpdates(); } } catch {}
    }
  }

  async stop(): Promise<void> {
    await this.pause();
  }

  async discardLastSession(): Promise<void> {
    if (!this.state.hasActiveSession) {
      return;
    }

    // Stop ticking first if running
    if (this.state.startedAtMs) {
      if (this.clock instanceof WorkerClock) {
        (this.clock as WorkerClock).pause();
      } else {
        (this.clock as FallbackClock).pause();
      }
    }

    // Reset to the base seconds (discard current session)
    const baseSeconds = this.state.baseSecondsAtStart;

    // Clear session and reset to base time
    this.state = {
      activeTaskId: null,
      activeTaskName: null,
      startedAtMs: null,
      baseSecondsAtStart: 0,
      currentSeconds: baseSeconds,
      sessionSeconds: 0,
      hasActiveSession: false,
    };
    this.ticksElapsedSeconds = 0;
    this.clearPersistedActive();
    
    // Update tray title immediately to reflect the discarded time
    this.updateTrayTitle();
    
    this.emitChange();
  }

  isRunning(): boolean {
    return Boolean(this.state.activeTaskId && this.state.startedAtMs);
  }

  getActiveTaskId(): string | null {
    return this.state.activeTaskId;
  }

  getDisplaySeconds(): number {
    return this.state.currentSeconds;
  }

  getLastActiveTaskId(): string | null {
    // First check current active task
    if (this.state.activeTaskId) {
      return this.state.activeTaskId;
    }
    
    // Then check persisted active state
    try {
      const raw = localStorage.getItem('timer.active');
      if (raw) {
        const data = JSON.parse(raw) as PersistedActive;
        return data?.activeTaskId || null;
      }
    } catch {}
    
    return null;
  }

  updateTrayTitle(): void {
    if (this.params?.setTrayTitle) {
      const timeStr = formatSeconds(this.state.currentSeconds);
      const taskName = this.state.activeTaskName;
      if (taskName && this.state.activeTaskId) {
        // Truncate task name to fit within reasonable limit
        const maxTaskNameLength = 100 - timeStr.length - 3; // 3 for " - "
        const truncatedName = taskName.length > maxTaskNameLength 
          ? taskName.substring(0, maxTaskNameLength - 1) + '…'
          : taskName;
        this.params.setTrayTitle(`${timeStr} - ${truncatedName}`);
      } else {
        this.params.setTrayTitle(timeStr);
      }
    }
  }

  // Persistence
  persistActiveState(): void {
    try {
      if (this.state.activeTaskId && this.state.startedAtMs !== null) {
        const data: PersistedActive = {
          activeTaskId: this.state.activeTaskId,
          activeTaskName: this.state.activeTaskName || '',
          startedAtMs: this.state.startedAtMs,
          baseSecondsAtStart: this.state.baseSecondsAtStart,
        };
        localStorage.setItem('timer.active', JSON.stringify(data));
      }
    } catch {}
  }

  clearPersistedActive(): void {
    try { localStorage.removeItem('timer.active'); } catch {}
  }

  async restoreActiveState(): Promise<void> {
    try {
      const raw = localStorage.getItem('timer.active');
      if (!raw) return;
      const data = JSON.parse(raw) as PersistedActive;
      if (!data?.activeTaskId || !data?.startedAtMs) return;

      // Seed from downtime
      const downtimeElapsed = Math.max(0, Math.floor((Date.now() - data.startedAtMs) / 1000));
      this.state = {
        activeTaskId: data.activeTaskId,
        activeTaskName: data.activeTaskName || null,
        startedAtMs: Date.now(),
        baseSecondsAtStart: Math.max(0, Math.floor(data.baseSecondsAtStart + downtimeElapsed)),
        currentSeconds: Math.max(0, Math.floor(data.baseSecondsAtStart + downtimeElapsed)),
        sessionSeconds: downtimeElapsed,
        hasActiveSession: true,
      };
      this.ticksElapsedSeconds = 0;
      if (this.clock instanceof WorkerClock) {
        (this.clock as WorkerClock).start(this.state.activeTaskId!, this.state.baseSecondsAtStart);
      } else {
        (this.clock as FallbackClock).start();
      }
      this.emitChange();
      // Optional: rebase from server if server is ahead
      void this.rebaseFromServerIfAhead(this.state.activeTaskId!);
    } catch {}
  }

  // Internal
  private handleTick(): void {
    if (this.state.activeTaskId && this.state.startedAtMs !== null) {
      this.ticksElapsedSeconds += 1;
      const seconds = this.state.baseSecondsAtStart + this.ticksElapsedSeconds;
      this.state.currentSeconds = seconds;
      this.state.sessionSeconds = this.ticksElapsedSeconds;
      this.state.hasActiveSession = this.ticksElapsedSeconds > 0;
    }
    const seconds = this.state.currentSeconds;
    this.params.onTick?.(seconds);
    if (this.params.setTrayTitle) {
      const timeStr = formatSeconds(seconds);
      const taskName = this.state.activeTaskName;
      if (taskName && this.state.activeTaskId) {
        // Use configurable max length (default 25)
        const maxTotalLength = this.params.maxTrayTitleLength ?? 25;
        const maxTaskNameLength = maxTotalLength - timeStr.length - 3; // 3 for " - "
        const truncatedName = taskName.length > maxTaskNameLength 
          ? taskName.substring(0, maxTaskNameLength - 1) + '…'
          : taskName;
        this.params.setTrayTitle(`${timeStr} - ${truncatedName}`);
      } else {
        this.params.setTrayTitle(timeStr);
      }
    }
    this.emitChange();
  }

  private emitChange(): void {
    this.params?.onChange?.({ ...this.state });
    const snapshot = { ...this.state };
    this.listeners.forEach((cb) => {
      try { cb(snapshot); } catch {}
    });
  }

  // Rebase baseSecondsAtStart/currentSeconds from server if server value is ahead
  private async rebaseFromServerIfAhead(taskId: string): Promise<void> {
    try {
      const serverBase = await this.params.loadTaskBaseSeconds(taskId);
      if (serverBase > this.state.baseSecondsAtStart) {
        const delta = serverBase - this.state.baseSecondsAtStart;
        this.state.baseSecondsAtStart = serverBase;
        if (this.state.startedAtMs) {
          // Keep current ticking, just adjust currentSeconds upward
          this.state.currentSeconds = serverBase + this.ticksElapsedSeconds;
          this.state.sessionSeconds = this.ticksElapsedSeconds;
        } else {
          this.state.currentSeconds = serverBase;
          this.state.sessionSeconds = 0;
        }
        this.state.hasActiveSession = this.state.sessionSeconds > 0;
        this.persistActiveState();
        this.emitChange();
      }
    } catch {}
  }

  // Pending updates queue management (offline handling)
  private readPendingUpdates(): PendingUpdate[] {
    try {
      const raw = localStorage.getItem('timer.pending');
      if (!raw) return [];
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr as PendingUpdate[] : [];
    } catch { return []; }
  }
  private writePendingUpdates(items: PendingUpdate[]): void {
    try { localStorage.setItem('timer.pending', JSON.stringify(items)); } catch {}
  }
  private enqueuePendingUpdate(update: PendingUpdate): void {
    const items = this.readPendingUpdates();
    items.push(update);
    this.writePendingUpdates(items);
  }
  private dequeuePendingUpdate(): PendingUpdate | undefined {
    const items = this.readPendingUpdates();
    if (items.length === 0) return undefined;
    const first = items.shift()!;
    this.writePendingUpdates(items);
    return first;
  }
  async flushPendingUpdates(): Promise<void> {
    try {
      if (typeof navigator !== 'undefined' && !navigator.onLine) return;
      let item: PendingUpdate | undefined;
      // Limit loop iterations to avoid blocking
      let guard = 0;
      while ((item = this.peekPendingUpdate()) && guard++ < 50) {
        const pending = item!;
        try {
          const serverBase = await this.params.loadTaskBaseSeconds(pending.taskId);
          if (serverBase >= pending.absoluteSeconds) {
            // Already persisted or newer; drop this item
            this.dequeuePendingUpdate();
            continue;
          }
          await this.params.saveTimeLogged(pending.taskId, pending.absoluteSeconds);
          this.dequeuePendingUpdate();
        } catch (e) {
          // keep item for retry later
          break;
        }
      }
    } catch {}
  }
  private peekPendingUpdate(): PendingUpdate | undefined {
    const items = this.readPendingUpdates();
    return items[0];
  }

  subscribe(cb: (state: TimerStoreState) => void): () => void {
    this.listeners.add(cb);
    // emit current immediately
    try { cb({ ...this.state }); } catch {}
    return () => { this.listeners.delete(cb); };
  }
}

function formatSeconds(total: number): string {
  const s = Math.max(0, Math.floor(total));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
}

export const TimerStore = new TimerStoreImpl();
// Export a small calculator for formatting/analytics to replace legacy TimerCalculator usage
export const TimerCalculator = {
  formatDuration(totalSeconds: number): string {
    const s = Math.max(0, Math.floor(totalSeconds || 0));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  },
  calculateProgress(elapsedSeconds: number, estimatedSeconds?: number): number {
    if (!estimatedSeconds || estimatedSeconds <= 0) return 0;
    return (elapsedSeconds / estimatedSeconds) * 100;
  },
  isOverEstimate(elapsedSeconds: number, estimatedSeconds?: number): boolean {
    if (!estimatedSeconds || estimatedSeconds <= 0) return false;
    return elapsedSeconds > estimatedSeconds;
  },
};


