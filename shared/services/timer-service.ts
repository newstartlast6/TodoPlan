import { TimerSession, TimerEvent, TimerOperationResult, TimerStatus, DEFAULT_TIMER_CONFIG } from '../timer-types';
import { TimerError, TimerValidationError, TimerStateError, TIMER_ERROR_CODES, TimerErrorHandler } from './timer-errors';

/**
 * Core timer service that handles timer logic and state management
 * This service is framework-agnostic and can be used on both client and server
 */
export class TimerService {
  private activeSession: TimerSession | null = null;
  private accumulatedSeconds = 0;
  private startTime: Date | null = null;
  private intervalId: NodeJS.Timeout | null = null;
  private eventListeners: Map<string, Function[]> = new Map();

  constructor(
    private config = DEFAULT_TIMER_CONFIG,
    private onStateChange?: (session: TimerSession | null) => void
  ) {}

  /**
   * Start a timer for a specific task
   */
  async startTimer(taskId: string): Promise<TimerOperationResult> {
    try {
      // Validate task ID
      if (!TimerValidator.validateTaskId(taskId)) {
        throw new TimerValidationError('Invalid task ID', { taskId });
      }

      // If there is an active session, require confirmation (avoid accidental switch)
      if (this.activeSession && this.activeSession.isActive) {
        return {
          success: false,
          requiresConfirmation: true,
          currentActiveTask: this.activeSession.taskId,
          error: 'Another timer is already running'
        };
      }

      // If there's a paused session lingering, discard it to avoid carrying over its accumulated seconds
      if (this.activeSession && !this.activeSession.isActive) {
        this.reset();
      }

      // Create new timer session (start from seeded accumulatedSeconds)
      const now = new Date();
      this.activeSession = {
        id: this.generateId(),
        taskId,
        startTime: now,
        durationSeconds: this.accumulatedSeconds,
        isActive: true,
        createdAt: now,
        updatedAt: now
      };

      this.startTime = now;
      this.startInterval();
      
      this.emit('timer:started', this.activeSession);
      this.onStateChange?.(this.activeSession);

      return {
        success: true,
        session: this.activeSession
      };
    } catch (error) {
      const timerError = TimerErrorHandler.handleError(error);
      return {
        success: false,
        error: TimerErrorHandler.getErrorMessage(timerError)
      };
    }
  }

  /**
   * Pause the current active timer
   */
  async pauseTimer(): Promise<TimerOperationResult> {
    try {
      if (!this.activeSession || !this.activeSession.isActive) {
        throw new TimerStateError('No active timer to pause', { 
          code: TIMER_ERROR_CODES.NO_ACTIVE_TIMER 
        });
      }

      // Calculate elapsed time and update accumulated seconds (snap to at least last displayed)
      const elapsedSeconds = this.calculateElapsedSeconds();
      const recomputedTotal = this.accumulatedSeconds + elapsedSeconds;
      const lastDisplayed = this.activeSession?.durationSeconds ?? this.accumulatedSeconds;
      const snappedTotal = Math.max(recomputedTotal, lastDisplayed);
      this.accumulatedSeconds = snappedTotal;

      // Update session
      this.activeSession = {
        ...this.activeSession,
        durationSeconds: snappedTotal,
        isActive: false,
        updatedAt: new Date()
      };

      this.stopInterval();
      this.startTime = null;

      this.emit('timer:paused', this.activeSession);
      this.onStateChange?.(this.activeSession);

      return {
        success: true,
        session: this.activeSession
      };
    } catch (error) {
      const timerError = TimerErrorHandler.handleError(error);
      return {
        success: false,
        error: TimerErrorHandler.getErrorMessage(timerError)
      };
    }
  }

  /**
   * Resume a paused timer
   */
  async resumeTimer(): Promise<TimerOperationResult> {
    try {
      if (!this.activeSession || this.activeSession.isActive) {
        return {
          success: false,
          error: 'No paused timer to resume'
        };
      }

      // Resume the timer; keep accumulatedSeconds as the seeded base
      this.activeSession = {
        ...this.activeSession,
        isActive: true,
        updatedAt: new Date()
      };

      this.startTime = new Date();
      this.startInterval();

      this.emit('timer:resumed', this.activeSession);
      this.onStateChange?.(this.activeSession);

      return {
        success: true,
        session: this.activeSession
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to resume timer'
      };
    }
  }

  /**
   * Stop and complete the current timer session
   */
  async stopTimer(): Promise<TimerOperationResult> {
    try {
      if (!this.activeSession) {
        return {
          success: false,
          error: 'No timer to stop'
        };
      }

      // Calculate final elapsed time (snap to at least last displayed)
      const elapsedSeconds = this.activeSession.isActive ? this.calculateElapsedSeconds() : 0;
      const recomputedTotal = this.accumulatedSeconds + elapsedSeconds;
      const lastDisplayed = this.activeSession?.durationSeconds ?? this.accumulatedSeconds;
      const totalSeconds = Math.max(recomputedTotal, lastDisplayed);

      // Complete the session
      const completedSession = {
        ...this.activeSession,
        endTime: new Date(),
        durationSeconds: totalSeconds,
        isActive: false,
        updatedAt: new Date()
      };

      this.stopInterval();
      this.reset();

      this.emit('timer:stopped', completedSession);
      this.onStateChange?.(null);

      return {
        success: true,
        session: completedSession
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to stop timer'
      };
    }
  }

  /**
   * Switch timer to a different task (with confirmation handled externally)
   */
  async switchTimer(newTaskId: string): Promise<TimerOperationResult> {
    try {
      // Stop current timer
      const stopResult = await this.stopTimer();
      if (!stopResult.success) {
        return stopResult;
      }

      // Start new timer
      return await this.startTimer(newTaskId);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to switch timer'
      };
    }
  }

  /**
   * Get current timer status
   */
  getStatus(): TimerStatus {
    if (!this.activeSession) return TimerStatus.IDLE;
    if (this.activeSession.isActive) return TimerStatus.RUNNING;
    if (this.activeSession.endTime) return TimerStatus.STOPPED;
    return TimerStatus.PAUSED;
  }

  /**
   * Get current active session
   */
  getActiveSession(): TimerSession | null {
    return this.activeSession;
  }

  /**
   * Get current elapsed time in seconds
   */
  getCurrentElapsedSeconds(): number {
    if (!this.activeSession) return 0;
    
    const currentElapsed = this.activeSession.isActive ? this.calculateElapsedSeconds() : 0;
    return this.accumulatedSeconds + currentElapsed;
  }

  /**
   * Restore timer state from saved data (for recovery)
   */
  restoreState(session: TimerSession, accumulatedSeconds: number): void {
    this.activeSession = session;
    this.accumulatedSeconds = accumulatedSeconds;
    
    if (session.isActive) {
      this.startTime = new Date();
      this.startInterval();
    }
    
    this.onStateChange?.(this.activeSession);
  }

  /**
   * Seed the timer's accumulated seconds before starting a session.
   * Use this to continue timing from a previously persisted total.
   */
  setAccumulatedSeconds(seconds: number): void {
    this.accumulatedSeconds = Math.max(0, Math.floor(seconds || 0));
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
   * Clean up resources
   */
  destroy(): void {
    this.stopInterval();
    this.eventListeners.clear();
    this.reset();
  }

  // Private methods

  private calculateElapsedSeconds(): number {
    if (!this.startTime) return 0;
    return Math.floor((Date.now() - this.startTime.getTime()) / 1000);
  }

  private startInterval(): void {
    this.stopInterval();
    this.intervalId = setInterval(() => {
      if (this.activeSession && this.activeSession.isActive) {
        const updatedSession = {
          ...this.activeSession,
          durationSeconds: this.accumulatedSeconds + this.calculateElapsedSeconds(),
          updatedAt: new Date()
        };
        this.activeSession = updatedSession;
        this.emit('timer:tick', updatedSession);
        this.onStateChange?.(updatedSession);
      }
    }, 1000);
  }

  private stopInterval(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private reset(): void {
    this.activeSession = null;
    this.accumulatedSeconds = 0;
    this.startTime = null;
  }

  private emit(event: string, data: any): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => callback(data));
    }
  }

  private generateId(): string {
    return `timer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Timer validation utilities
 */
export class TimerValidator {
  static validateTaskId(taskId: string): boolean {
    return typeof taskId === 'string' && taskId.length > 0;
  }

  static validateSession(session: TimerSession): boolean {
    return (
      session &&
      typeof session.id === 'string' &&
      typeof session.taskId === 'string' &&
      session.startTime instanceof Date &&
      typeof session.durationSeconds === 'number' &&
      typeof session.isActive === 'boolean'
    );
  }

  static validateDuration(seconds: number): boolean {
    return typeof seconds === 'number' && seconds >= 0;
  }
}

/**
 * Timer calculation utilities
 */
export class TimerCalculator {
  static formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  }

  static calculateProgress(elapsedSeconds: number, estimatedSeconds?: number): number {
    if (!estimatedSeconds || estimatedSeconds <= 0) return 0;
    return Math.min((elapsedSeconds / estimatedSeconds) * 100, 100);
  }

  static isOverEstimate(elapsedSeconds: number, estimatedSeconds?: number): boolean {
    if (!estimatedSeconds || estimatedSeconds <= 0) return false;
    return elapsedSeconds > estimatedSeconds;
  }

  static calculateRemainingTime(totalSeconds: number, targetSeconds: number): number {
    return Math.max(targetSeconds - totalSeconds, 0);
  }
}