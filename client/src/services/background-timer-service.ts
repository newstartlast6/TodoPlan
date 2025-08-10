import { TimerSession } from '@shared/timer-types';

interface BackgroundTimerMessage {
  type: string;
  payload: any;
}

interface TimerWorkerState {
  isActive: boolean;
  taskId: string | null;
  sessionId: string | null;
  totalSeconds: number;
  timestamp: number;
}

/**
 * Service for managing background timer processing using Web Workers
 */
export class BackgroundTimerService {
  private worker: Worker | null = null;
  private isWorkerSupported = false;
  private isWorkerReady = false;
  private messageQueue: BackgroundTimerMessage[] = [];
  private eventListeners: Map<string, Function[]> = new Map();
  private visibilityHandler: (() => void) | null = null;
  private fallbackInterval: NodeJS.Timeout | null = null;
  private fallbackState: TimerWorkerState = {
    isActive: false,
    taskId: null,
    sessionId: null,
    totalSeconds: 0,
    timestamp: 0,
  };

  constructor() {
    this.initializeWorker();
    this.setupVisibilityListener();
  }

  /**
   * Initialize the Web Worker
   */
  private initializeWorker(): void {
    try {
      // Check if Web Workers are supported
      if (typeof Worker !== 'undefined') {
        this.worker = new Worker('/timer-worker.js');
        this.isWorkerSupported = true;
        this.setupWorkerListeners();
      } else {
        console.warn('Web Workers not supported, falling back to main thread');
        this.isWorkerSupported = false;
        this.isWorkerReady = true; // Consider fallback as "ready"
      }
    } catch (error) {
      console.error('Failed to initialize Web Worker:', error);
      this.isWorkerSupported = false;
      this.isWorkerReady = true;
    }
  }

  /**
   * Setup Web Worker event listeners
   */
  private setupWorkerListeners(): void {
    if (!this.worker) return;

    this.worker.addEventListener('message', (event) => {
      const { type, payload } = event.data;

      switch (type) {
        case 'WORKER_READY':
          this.isWorkerReady = true;
          this.processMessageQueue();
          break;

        case 'TIMER_TICK':
        case 'TIMER_STARTED':
        case 'TIMER_PAUSED':
        case 'TIMER_RESUMED':
        case 'TIMER_STOPPED':
        case 'TIMER_STATE':
        case 'TIMER_SYNCED':
        case 'VISIBILITY_CHANGED':
          this.emit(type, payload);
          break;

        case 'ERROR':
        case 'WORKER_ERROR':
          console.error('Worker error:', payload);
          this.emit('error', payload);
          break;

        case 'PONG':
          this.emit('pong', payload);
          break;

        default:
          console.warn('Unknown worker message type:', type);
      }
    });

    this.worker.addEventListener('error', (error) => {
      console.error('Worker error:', error);
      this.emit('error', { message: error.message, type: 'worker_error' });
    });
  }

  /**
   * Setup page visibility listener
   */
  private setupVisibilityListener(): void {
    if (typeof document !== 'undefined') {
      this.visibilityHandler = () => {
        const isVisible = !document.hidden;
        this.handleVisibilityChange(isVisible);
      };

      document.addEventListener('visibilitychange', this.visibilityHandler);
    }
  }

  /**
   * Handle page visibility changes
   */
  private handleVisibilityChange(isVisible: boolean): void {
    if (this.isWorkerSupported && this.worker) {
      this.postMessage({
        type: 'VISIBILITY_CHANGE',
        payload: { isVisible },
      });
    }

    this.emit('visibilityChange', { isVisible });
  }

  /**
   * Post message to worker or handle with fallback
   */
  private postMessage(message: BackgroundTimerMessage): void {
    if (this.isWorkerSupported && this.worker && this.isWorkerReady) {
      this.worker.postMessage(message);
    } else if (this.isWorkerSupported && this.worker) {
      // Queue message until worker is ready
      this.messageQueue.push(message);
    } else {
      // Fallback to main thread processing
      this.handleFallbackMessage(message);
    }
  }

  /**
   * Process queued messages when worker becomes ready
   */
  private processMessageQueue(): void {
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      if (message && this.worker) {
        this.worker.postMessage(message);
      }
    }
  }

  /**
   * Fallback message handling for browsers without Web Worker support
   */
  private handleFallbackMessage(message: BackgroundTimerMessage): void {
    const { type, payload } = message;

    switch (type) {
      case 'START_TIMER':
        this.startFallbackTimer(payload);
        break;

      case 'PAUSE_TIMER':
        this.pauseFallbackTimer();
        break;

      case 'RESUME_TIMER':
        this.resumeFallbackTimer();
        break;

      case 'STOP_TIMER':
        this.stopFallbackTimer();
        break;

      case 'GET_STATE':
        this.getFallbackState();
        break;

      case 'SYNC_STATE':
        this.syncFallbackState(payload);
        break;
    }
  }

  /**
   * Fallback timer implementation
   */
  private startFallbackTimer(data: any): void {
    this.fallbackState = {
      isActive: true,
      taskId: data.taskId,
      sessionId: data.sessionId,
      totalSeconds: data.accumulatedSeconds || 0,
      timestamp: Date.now(),
    };

    this.startFallbackInterval();
    this.emit('TIMER_STARTED', { sessionId: data.sessionId, taskId: data.taskId });
  }

  private pauseFallbackTimer(): void {
    if (this.fallbackState.isActive) {
      const elapsed = Math.floor((Date.now() - this.fallbackState.timestamp) / 1000);
      this.fallbackState.totalSeconds += elapsed;
      this.fallbackState.isActive = false;
      this.stopFallbackInterval();

      this.emit('TIMER_PAUSED', {
        sessionId: this.fallbackState.sessionId,
        taskId: this.fallbackState.taskId,
        totalSeconds: this.fallbackState.totalSeconds,
        timestamp: Date.now(),
      });
    }
  }

  private resumeFallbackTimer(): void {
    if (!this.fallbackState.isActive && this.fallbackState.taskId) {
      this.fallbackState.isActive = true;
      this.fallbackState.timestamp = Date.now();
      this.startFallbackInterval();

      this.emit('TIMER_RESUMED', {
        sessionId: this.fallbackState.sessionId,
        taskId: this.fallbackState.taskId,
      });
    }
  }

  private stopFallbackTimer(): void {
    let totalSeconds = this.fallbackState.totalSeconds;

    if (this.fallbackState.isActive) {
      const elapsed = Math.floor((Date.now() - this.fallbackState.timestamp) / 1000);
      totalSeconds += elapsed;
    }

    this.stopFallbackInterval();

    const finalState = {
      sessionId: this.fallbackState.sessionId,
      taskId: this.fallbackState.taskId,
      totalSeconds,
      timestamp: Date.now(),
    };

    this.fallbackState = {
      isActive: false,
      taskId: null,
      sessionId: null,
      totalSeconds: 0,
      timestamp: 0,
    };

    this.emit('TIMER_STOPPED', finalState);
  }

  private getFallbackState(): void {
    let totalSeconds = this.fallbackState.totalSeconds;

    if (this.fallbackState.isActive) {
      const elapsed = Math.floor((Date.now() - this.fallbackState.timestamp) / 1000);
      totalSeconds += elapsed;
    }

    this.emit('TIMER_STATE', {
      isActive: this.fallbackState.isActive,
      taskId: this.fallbackState.taskId,
      sessionId: this.fallbackState.sessionId,
      totalSeconds,
      timestamp: Date.now(),
    });
  }

  private syncFallbackState(data: any): void {
    this.fallbackState = {
      isActive: data.isActive,
      taskId: data.taskId,
      sessionId: data.sessionId,
      totalSeconds: data.accumulatedSeconds || 0,
      timestamp: Date.now(),
    };

    if (data.isActive) {
      this.startFallbackInterval();
    } else {
      this.stopFallbackInterval();
    }

    this.emit('TIMER_SYNCED', {
      sessionId: data.sessionId,
      taskId: data.taskId,
      isActive: data.isActive,
    });
  }

  private startFallbackInterval(): void {
    this.stopFallbackInterval();

    this.fallbackInterval = setInterval(() => {
      if (this.fallbackState.isActive) {
        const elapsed = Math.floor((Date.now() - this.fallbackState.timestamp) / 1000);
        const totalSeconds = this.fallbackState.totalSeconds + elapsed;

        this.emit('TIMER_TICK', {
          sessionId: this.fallbackState.sessionId,
          taskId: this.fallbackState.taskId,
          totalSeconds,
          elapsedSeconds: elapsed,
          timestamp: Date.now(),
        });
      }
    }, 1000);
  }

  private stopFallbackInterval(): void {
    if (this.fallbackInterval) {
      clearInterval(this.fallbackInterval);
      this.fallbackInterval = null;
    }
  }

  /**
   * Public API methods
   */

  /**
   * Start background timer
   */
  startTimer(session: TimerSession): void {
    this.postMessage({
      type: 'START_TIMER',
      payload: {
        taskId: session.taskId,
        sessionId: session.id,
        accumulatedSeconds: session.durationSeconds,
      },
    });
  }

  /**
   * Pause background timer
   */
  pauseTimer(): void {
    this.postMessage({
      type: 'PAUSE_TIMER',
      payload: {},
    });
  }

  /**
   * Resume background timer
   */
  resumeTimer(): void {
    this.postMessage({
      type: 'RESUME_TIMER',
      payload: {},
    });
  }

  /**
   * Stop background timer
   */
  stopTimer(): void {
    this.postMessage({
      type: 'STOP_TIMER',
      payload: {},
    });
  }

  /**
   * Get current timer state
   */
  getState(): void {
    this.postMessage({
      type: 'GET_STATE',
      payload: {},
    });
  }

  /**
   * Sync timer state
   */
  syncState(session: TimerSession | null): void {
    this.postMessage({
      type: 'SYNC_STATE',
      payload: session ? {
        isActive: session.isActive,
        taskId: session.taskId,
        sessionId: session.id,
        accumulatedSeconds: session.durationSeconds,
      } : {
        isActive: false,
        taskId: null,
        sessionId: null,
        accumulatedSeconds: 0,
      },
    });
  }

  /**
   * Ping worker to check if it's alive
   */
  ping(): void {
    this.postMessage({
      type: 'PING',
      payload: {},
    });
  }

  /**
   * Add event listener
   */
  on(event: string, callback: Function): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(callback);
  }

  /**
   * Remove event listener
   */
  off(event: string, callback: Function): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  /**
   * Emit event to listeners
   */
  private emit(event: string, data: any): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error('Error in event listener:', error);
        }
      });
    }
  }

  /**
   * Check if Web Workers are supported
   */
  isSupported(): boolean {
    return this.isWorkerSupported;
  }

  /**
   * Check if worker is ready
   */
  isReady(): boolean {
    return this.isWorkerReady;
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }

    if (this.visibilityHandler) {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      this.visibilityHandler = null;
    }

    this.stopFallbackInterval();
    this.eventListeners.clear();
    this.messageQueue = [];
  }
}