import { TimerLocalStorage, TimerEvent, TimerSession, DEFAULT_TIMER_CONFIG } from '../timer-types';
import { TimerError, TimerPersistenceError, TIMER_ERROR_CODES, TimerErrorHandler } from './timer-errors';

/**
 * Service for handling timer data persistence to localStorage and recovery
 */
export class PersistenceService {
  private static readonly STORAGE_KEYS = {
    ACTIVE_SESSION: 'timer_active_session',
    PENDING_EVENTS: 'timer_pending_events',
    LAST_SYNC: 'timer_last_sync',
    DAILY_CACHE: 'timer_daily_cache',
  } as const;

  private eventQueue: TimerEvent[] = [];
  private isOnline = true;

  constructor(
    private config = DEFAULT_TIMER_CONFIG,
    private onStorageError?: (error: TimerError) => void
  ) {
    this.initializeEventQueue();
    this.setupOnlineStatusListener();
  }

  /**
   * Save active timer session to localStorage
   */
  async saveActiveSession(session: TimerSession | null): Promise<void> {
    try {
      if (session) {
        const sessionData = {
          taskId: session.taskId,
          startTime: session.startTime.toISOString(),
          accumulatedSeconds: session.durationSeconds,
          isActive: session.isActive,
          sessionId: session.id,
        };
        
        this.setStorageItem(PersistenceService.STORAGE_KEYS.ACTIVE_SESSION, sessionData);
      } else {
        this.removeStorageItem(PersistenceService.STORAGE_KEYS.ACTIVE_SESSION);
      }
    } catch (error) {
      const timerError = new TimerPersistenceError('Failed to save active session', { 
        error, 
        session 
      });
      this.onStorageError?.(timerError);
      throw timerError;
    }
  }

  /**
   * Load active timer session from localStorage
   */
  async loadActiveSession(): Promise<{ session: TimerSession | null; accumulatedSeconds: number }> {
    try {
      const sessionData = this.getStorageItem(PersistenceService.STORAGE_KEYS.ACTIVE_SESSION);
      
      if (!sessionData) {
        return { session: null, accumulatedSeconds: 0 };
      }

      // Calculate elapsed time since last save
      const startTime = new Date(sessionData.startTime);
      const now = new Date();
      const elapsedSinceStart = Math.floor((now.getTime() - startTime.getTime()) / 1000);
      
      // Create session object
      const session: TimerSession = {
        id: sessionData.sessionId || this.generateId(),
        taskId: sessionData.taskId,
        startTime,
        durationSeconds: sessionData.accumulatedSeconds + (sessionData.isActive ? elapsedSinceStart : 0),
        isActive: sessionData.isActive,
        createdAt: startTime,
        updatedAt: now,
      };

      const accumulatedSeconds = sessionData.accumulatedSeconds + (sessionData.isActive ? elapsedSinceStart : 0);

      return { session, accumulatedSeconds };
    } catch (error) {
      const timerError = new TimerPersistenceError('Failed to load active session', { error });
      this.onStorageError?.(timerError);
      
      // Return empty state on corruption
      this.removeStorageItem(PersistenceService.STORAGE_KEYS.ACTIVE_SESSION);
      return { session: null, accumulatedSeconds: 0 };
    }
  }

  /**
   * Queue timer event for later synchronization
   */
  async queueEvent(event: TimerEvent): Promise<void> {
    try {
      this.eventQueue.push(event);
      this.setStorageItem(PersistenceService.STORAGE_KEYS.PENDING_EVENTS, this.eventQueue);
      
      // Try to sync immediately if online
      if (this.isOnline) {
        await this.syncPendingEvents();
      }
    } catch (error) {
      const timerError = new TimerPersistenceError('Failed to queue event', { error, event });
      this.onStorageError?.(timerError);
      throw timerError;
    }
  }

  /**
   * Get all pending events that need to be synced
   */
  getPendingEvents(): TimerEvent[] {
    return [...this.eventQueue];
  }

  /**
   * Mark events as synced and remove from queue
   */
  async markEventsSynced(eventIds: string[]): Promise<void> {
    try {
      this.eventQueue = this.eventQueue.filter(event => !eventIds.includes(event.id));
      this.setStorageItem(PersistenceService.STORAGE_KEYS.PENDING_EVENTS, this.eventQueue);
      this.setStorageItem(PersistenceService.STORAGE_KEYS.LAST_SYNC, new Date().toISOString());
    } catch (error) {
      const timerError = new TimerPersistenceError('Failed to mark events as synced', { 
        error, 
        eventIds 
      });
      this.onStorageError?.(timerError);
      throw timerError;
    }
  }

  /**
   * Sync pending events with server (to be implemented by consumer)
   */
  async syncPendingEvents(syncFunction?: (events: TimerEvent[]) => Promise<string[]>): Promise<void> {
    if (!this.isOnline || this.eventQueue.length === 0) {
      return;
    }

    try {
      if (syncFunction) {
        const syncedEventIds = await syncFunction(this.eventQueue);
        await this.markEventsSynced(syncedEventIds);
      }
    } catch (error) {
      // Don't throw on sync errors - they'll be retried later
      console.warn('Failed to sync timer events:', error);
    }
  }

  /**
   * Cache daily summary data
   */
  async cacheDailySummary(date: string, data: any): Promise<void> {
    try {
      const cache = this.getStorageItem(PersistenceService.STORAGE_KEYS.DAILY_CACHE) || {};
      cache[date] = {
        data,
        timestamp: new Date().toISOString(),
      };
      
      // Keep only last 7 days of cache
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 7);
      
      Object.keys(cache).forEach(cacheDate => {
        if (new Date(cacheDate) < cutoffDate) {
          delete cache[cacheDate];
        }
      });
      
      this.setStorageItem(PersistenceService.STORAGE_KEYS.DAILY_CACHE, cache);
    } catch (error) {
      // Cache errors are non-critical
      console.warn('Failed to cache daily summary:', error);
    }
  }

  /**
   * Get cached daily summary data
   */
  getCachedDailySummary(date: string): any | null {
    try {
      const cache = this.getStorageItem(PersistenceService.STORAGE_KEYS.DAILY_CACHE) || {};
      const cached = cache[date];
      
      if (!cached) return null;
      
      // Check if cache is still fresh (within 5 minutes)
      const cacheTime = new Date(cached.timestamp);
      const now = new Date();
      const ageMinutes = (now.getTime() - cacheTime.getTime()) / (1000 * 60);
      
      if (ageMinutes > 5) {
        delete cache[date];
        this.setStorageItem(PersistenceService.STORAGE_KEYS.DAILY_CACHE, cache);
        return null;
      }
      
      return cached.data;
    } catch (error) {
      return null;
    }
  }

  /**
   * Clear all timer data from localStorage
   */
  async clearAllData(): Promise<void> {
    try {
      Object.values(PersistenceService.STORAGE_KEYS).forEach(key => {
        this.removeStorageItem(key);
      });
      this.eventQueue = [];
    } catch (error) {
      const timerError = new TimerPersistenceError('Failed to clear timer data', { error });
      this.onStorageError?.(timerError);
      throw timerError;
    }
  }

  /**
   * Get storage usage statistics
   */
  getStorageStats(): { used: number; available: number; percentage: number } {
    try {
      let used = 0;
      Object.values(PersistenceService.STORAGE_KEYS).forEach(key => {
        const item = localStorage.getItem(key);
        if (item) {
          used += item.length;
        }
      });

      // Estimate available storage (most browsers have ~5-10MB limit)
      const estimated = 5 * 1024 * 1024; // 5MB
      const available = Math.max(0, estimated - used);
      const percentage = (used / estimated) * 100;

      return { used, available, percentage };
    } catch (error) {
      return { used: 0, available: 0, percentage: 0 };
    }
  }

  /**
   * Check if timer data recovery is needed
   */
  needsRecovery(): boolean {
    try {
      const sessionData = this.getStorageItem(PersistenceService.STORAGE_KEYS.ACTIVE_SESSION);
      return sessionData && sessionData.isActive;
    } catch (error) {
      return false;
    }
  }

  /**
   * Create recovery prompt data for user confirmation
   */
  getRecoveryData(): { taskId: string; elapsedSeconds: number; startTime: Date } | null {
    try {
      const sessionData = this.getStorageItem(PersistenceService.STORAGE_KEYS.ACTIVE_SESSION);
      if (!sessionData || !sessionData.isActive) {
        return null;
      }

      const startTime = new Date(sessionData.startTime);
      const now = new Date();
      const elapsedSeconds = Math.floor((now.getTime() - startTime.getTime()) / 1000);

      return {
        taskId: sessionData.taskId,
        elapsedSeconds: sessionData.accumulatedSeconds + elapsedSeconds,
        startTime,
      };
    } catch (error) {
      return null;
    }
  }

  // Private methods

  private initializeEventQueue(): void {
    try {
      const events = this.getStorageItem(PersistenceService.STORAGE_KEYS.PENDING_EVENTS);
      this.eventQueue = Array.isArray(events) ? events : [];
    } catch (error) {
      this.eventQueue = [];
    }
  }

  private setupOnlineStatusListener(): void {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.isOnline = true;
        this.syncPendingEvents();
      });

      window.addEventListener('offline', () => {
        this.isOnline = false;
      });

      this.isOnline = navigator.onLine;
    }
  }

  private setStorageItem(key: string, value: any): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      if (error instanceof DOMException && error.code === 22) {
        throw new TimerPersistenceError('Storage quota exceeded', { 
          code: TIMER_ERROR_CODES.STORAGE_FULL 
        });
      }
      throw new TimerPersistenceError('Storage unavailable', { 
        code: TIMER_ERROR_CODES.STORAGE_UNAVAILABLE,
        error 
      });
    }
  }

  private getStorageItem(key: string): any {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : null;
    } catch (error) {
      // Return null on parse errors (corrupted data)
      return null;
    }
  }

  private removeStorageItem(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      // Ignore removal errors
    }
  }

  private generateId(): string {
    return `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Timer recovery manager for handling application restart scenarios
 */
export class TimerRecoveryManager {
  constructor(private persistenceService: PersistenceService) {}

  /**
   * Check if recovery is needed and get recovery options
   */
  async checkRecovery(): Promise<{
    needsRecovery: boolean;
    recoveryData?: {
      taskId: string;
      elapsedSeconds: number;
      startTime: Date;
      shouldPromptUser: boolean;
    };
  }> {
    const needsRecovery = this.persistenceService.needsRecovery();
    
    if (!needsRecovery) {
      return { needsRecovery: false };
    }

    const recoveryData = this.persistenceService.getRecoveryData();
    if (!recoveryData) {
      return { needsRecovery: false };
    }

    // Determine if we should prompt user based on elapsed time
    const shouldPromptUser = recoveryData.elapsedSeconds > 300; // 5 minutes

    return {
      needsRecovery: true,
      recoveryData: {
        ...recoveryData,
        shouldPromptUser,
      },
    };
  }

  /**
   * Perform timer recovery
   */
  async performRecovery(confirmed: boolean = true): Promise<{
    session: TimerSession | null;
    accumulatedSeconds: number;
  }> {
    if (!confirmed) {
      // User declined recovery, clear the session
      await this.persistenceService.saveActiveSession(null);
      return { session: null, accumulatedSeconds: 0 };
    }

    // Load and return the recovered session
    return await this.persistenceService.loadActiveSession();
  }
}