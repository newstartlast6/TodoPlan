import { TimerEvent, TimerSession, DEFAULT_TIMER_CONFIG } from '../timer-types';
import { TimerError, TimerSyncError, TIMER_ERROR_CODES, TimerRetryHandler } from './timer-errors';
import { PersistenceService } from './persistence-service';

/**
 * Service for synchronizing timer data between client and server
 */
export class SyncService {
  private syncInterval: NodeJS.Timeout | null = null;
  private isSyncing = false;
  private lastSyncTime: Date | null = null;

  constructor(
    private persistenceService: PersistenceService,
    private apiClient: TimerApiClient,
    private config = DEFAULT_TIMER_CONFIG,
    private onSyncError?: (error: TimerError) => void
  ) {
    this.startPeriodicSync();
  }

  /**
   * Sync all pending events with the server
   */
  async syncPendingEvents(): Promise<{ synced: number; failed: number }> {
    if (this.isSyncing) {
      return { synced: 0, failed: 0 };
    }

    this.isSyncing = true;
    let synced = 0;
    let failed = 0;

    try {
      const pendingEvents = this.persistenceService.getPendingEvents();
      
      if (pendingEvents.length === 0) {
        return { synced: 0, failed: 0 };
      }

      // Group events by type for batch processing
      const eventGroups = this.groupEventsByType(pendingEvents);
      
      for (const [eventType, events] of eventGroups) {
        try {
          const syncedIds = await this.syncEventGroup(eventType, events);
          await this.persistenceService.markEventsSynced(syncedIds);
          synced += syncedIds.length;
        } catch (error) {
          failed += events.length;
          const syncError = new TimerSyncError(`Failed to sync ${eventType} events`, { 
            error, 
            events 
          });
          this.onSyncError?.(syncError);
        }
      }

      this.lastSyncTime = new Date();
      return { synced, failed };

    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Sync active timer state with server
   */
  async syncActiveTimer(session: TimerSession | null): Promise<void> {
    try {
      if (session) {
        await TimerRetryHandler.withRetry(
          () => this.apiClient.updateActiveTimer(session),
          this.config.maxRetries
        );
      } else {
        await TimerRetryHandler.withRetry(
          () => this.apiClient.clearActiveTimer(),
          this.config.maxRetries
        );
      }
    } catch (error) {
      const syncError = new TimerSyncError('Failed to sync active timer', { error, session });
      this.onSyncError?.(syncError);
      throw syncError;
    }
  }

  /**
   * Resolve conflicts between local and server state
   */
  async resolveConflicts(): Promise<{ resolved: boolean; action: string; details?: any }> {
    try {
      // Get server state
      const serverState = await this.apiClient.getActiveTimer();
      const localState = await this.persistenceService.loadActiveSession();

      // No conflict if both are null
      if (!serverState && !localState.session) {
        return { resolved: true, action: 'no_conflict' };
      }

      // Server has active timer, local doesn't
      if (serverState && !localState.session) {
        await this.persistenceService.saveActiveSession(serverState);
        return { 
          resolved: true, 
          action: 'server_wins',
          details: { serverSession: serverState }
        };
      }

      // Local has active timer, server doesn't
      if (!serverState && localState.session) {
        await this.syncActiveTimer(localState.session);
        return { 
          resolved: true, 
          action: 'local_wins',
          details: { localSession: localState.session }
        };
      }

      // Both have active timers - advanced conflict resolution
      if (serverState && localState.session) {
        const resolution = await this.advancedConflictResolution(serverState, localState.session);
        return resolution;
      }

      return { resolved: false, action: 'manual_resolution_needed' };

    } catch (error) {
      const syncError = new TimerSyncError('Failed to resolve conflicts', { error });
      this.onSyncError?.(syncError);
      return { resolved: false, action: 'error', details: { error } };
    }
  }

  /**
   * Advanced conflict resolution for complex scenarios
   */
  private async advancedConflictResolution(
    serverSession: TimerSession, 
    localSession: TimerSession
  ): Promise<{ resolved: boolean; action: string; details?: any }> {
    const serverTime = new Date(serverSession.updatedAt);
    const localTime = new Date(localSession.updatedAt);
    const timeDiff = Math.abs(serverTime.getTime() - localTime.getTime());

    // If sessions are for the same task
    if (serverSession.taskId === localSession.taskId) {
      // Merge time if both are recent (within 5 minutes)
      if (timeDiff < 5 * 60 * 1000) {
        const mergedSession = await this.mergeTimerSessions(serverSession, localSession);
        await this.persistenceService.saveActiveSession(mergedSession);
        await this.syncActiveTimer(mergedSession);
        
        return {
          resolved: true,
          action: 'sessions_merged',
          details: { 
            mergedSession,
            serverDuration: serverSession.durationSeconds,
            localDuration: localSession.durationSeconds,
            finalDuration: mergedSession.durationSeconds
          }
        };
      }
    }

    // Different tasks or significant time difference - use most recent
    if (serverTime > localTime) {
      // Check if local session has significant time that would be lost
      if (localSession.durationSeconds > 300) { // 5 minutes
        // Save local session as completed before switching
        const completedLocal = {
          ...localSession,
          endTime: new Date(),
          isActive: false,
        };
        
        // Queue the completed session for sync
        await this.persistenceService.queueEvent({
          id: `conflict_save_${Date.now()}`,
          type: 'stop',
          taskId: localSession.taskId,
          timestamp: new Date().toISOString(),
          synced: false,
        });
      }

      await this.persistenceService.saveActiveSession(serverSession);
      return { 
        resolved: true, 
        action: 'server_wins_with_local_save',
        details: { 
          serverSession, 
          localSessionSaved: localSession.durationSeconds > 300,
          localDuration: localSession.durationSeconds
        }
      };
    } else {
      // Local is more recent
      await this.syncActiveTimer(localSession);
      return { 
        resolved: true, 
        action: 'local_wins',
        details: { 
          localSession,
          serverSessionOverridden: true,
          serverDuration: serverSession.durationSeconds
        }
      };
    }
  }

  /**
   * Merge two timer sessions for the same task
   */
  private async mergeTimerSessions(
    serverSession: TimerSession, 
    localSession: TimerSession
  ): TimerSession {
    // Use the maximum duration (assuming both were tracking the same work)
    const maxDuration = Math.max(serverSession.durationSeconds, localSession.durationSeconds);
    
    // Use the most recent update time
    const mostRecentTime = serverSession.updatedAt > localSession.updatedAt 
      ? serverSession.updatedAt 
      : localSession.updatedAt;

    // Use server session as base but with merged data
    return {
      ...serverSession,
      durationSeconds: maxDuration,
      updatedAt: mostRecentTime,
      // Keep active state from most recent session
      isActive: serverSession.updatedAt > localSession.updatedAt 
        ? serverSession.isActive 
        : localSession.isActive,
    };
  }

  /**
   * Handle optimistic locking conflicts
   */
  async handleOptimisticLockingConflict(
    operation: 'start' | 'pause' | 'resume' | 'stop',
    sessionId: string,
    expectedVersion?: string
  ): Promise<{ success: boolean; action: string; newState?: TimerSession }> {
    try {
      // Get current server state
      const currentServerState = await this.apiClient.getActiveTimer();
      
      if (!currentServerState) {
        return { success: false, action: 'session_not_found' };
      }

      // Check if the session we're trying to modify still exists and matches
      if (currentServerState.id !== sessionId) {
        return { 
          success: false, 
          action: 'session_changed',
          newState: currentServerState
        };
      }

      // If we have version checking and versions don't match
      if (expectedVersion && currentServerState.updatedAt.toString() !== expectedVersion) {
        return {
          success: false,
          action: 'version_conflict',
          newState: currentServerState
        };
      }

      // Retry the operation with current state
      switch (operation) {
        case 'start':
          // Cannot start if another session is active
          return { success: false, action: 'already_active', newState: currentServerState };
          
        case 'pause':
          if (!currentServerState.isActive) {
            return { success: false, action: 'already_paused', newState: currentServerState };
          }
          break;
          
        case 'resume':
          if (currentServerState.isActive) {
            return { success: false, action: 'already_active', newState: currentServerState };
          }
          break;
          
        case 'stop':
          // Stop operation can usually proceed regardless of current state
          break;
      }

      return { success: true, action: 'retry_allowed', newState: currentServerState };

    } catch (error) {
      return { success: false, action: 'error', newState: undefined };
    }
  }

  /**
   * Detect and resolve data inconsistencies
   */
  async detectAndResolveInconsistencies(): Promise<{
    inconsistenciesFound: number;
    resolved: number;
    issues: Array<{ type: string; description: string; resolved: boolean }>;
  }> {
    const issues: Array<{ type: string; description: string; resolved: boolean }> = [];
    let resolved = 0;

    try {
      // Check for orphaned active sessions
      const serverState = await this.apiClient.getActiveTimer();
      const localState = await this.persistenceService.loadActiveSession();

      // Check for multiple active sessions (should not happen)
      if (serverState && localState.session && 
          serverState.id !== localState.session.id && 
          serverState.isActive && localState.session.isActive) {
        
        issues.push({
          type: 'multiple_active_sessions',
          description: 'Multiple active timer sessions detected',
          resolved: false,
        });

        // Resolve by keeping the most recent
        const resolution = await this.resolveConflicts();
        if (resolution.resolved) {
          issues[issues.length - 1].resolved = true;
          resolved++;
        }
      }

      // Check for sessions with invalid durations
      if (localState.session && localState.session.durationSeconds < 0) {
        issues.push({
          type: 'negative_duration',
          description: 'Timer session has negative duration',
          resolved: false,
        });

        // Fix by resetting to 0
        const fixedSession = { ...localState.session, durationSeconds: 0 };
        await this.persistenceService.saveActiveSession(fixedSession);
        issues[issues.length - 1].resolved = true;
        resolved++;
      }

      // Check for very old active sessions (likely stale)
      const now = new Date();
      if (localState.session && localState.session.isActive) {
        const sessionAge = now.getTime() - new Date(localState.session.startTime).getTime();
        const maxAge = 24 * 60 * 60 * 1000; // 24 hours

        if (sessionAge > maxAge) {
          issues.push({
            type: 'stale_active_session',
            description: 'Active timer session is very old (>24 hours)',
            resolved: false,
          });

          // Auto-complete the stale session
          const completedSession = {
            ...localState.session,
            endTime: new Date(new Date(localState.session.startTime).getTime() + sessionAge),
            isActive: false,
          };

          await this.persistenceService.saveActiveSession(null);
          
          // Queue for sync
          await this.persistenceService.queueEvent({
            id: `stale_cleanup_${Date.now()}`,
            type: 'stop',
            taskId: completedSession.taskId,
            timestamp: completedSession.endTime!.toISOString(),
            synced: false,
          });

          issues[issues.length - 1].resolved = true;
          resolved++;
        }
      }

      // Check for pending events that are too old
      const pendingEvents = this.persistenceService.getPendingEvents();
      const oldEvents = pendingEvents.filter(event => {
        const eventAge = now.getTime() - new Date(event.timestamp).getTime();
        return eventAge > 7 * 24 * 60 * 60 * 1000; // 7 days
      });

      if (oldEvents.length > 0) {
        issues.push({
          type: 'old_pending_events',
          description: `${oldEvents.length} pending sync events are very old (>7 days)`,
          resolved: false,
        });

        // Mark old events as synced to clean them up
        const oldEventIds = oldEvents.map(event => event.id);
        await this.persistenceService.markEventsSynced(oldEventIds);
        issues[issues.length - 1].resolved = true;
        resolved++;
      }

      return {
        inconsistenciesFound: issues.length,
        resolved,
        issues,
      };

    } catch (error) {
      issues.push({
        type: 'detection_error',
        description: 'Error occurred while detecting inconsistencies',
        resolved: false,
      });

      return {
        inconsistenciesFound: issues.length,
        resolved,
        issues,
      };
    }
  }

  /**
   * Force a full synchronization
   */
  async forceSyncAll(): Promise<{ success: boolean; details: any }> {
    try {
      // Sync pending events
      const eventSync = await this.syncPendingEvents();
      
      // Resolve conflicts
      const conflictResolution = await this.resolveConflicts();
      
      // Sync active timer
      const localState = await this.persistenceService.loadActiveSession();
      if (localState.session) {
        await this.syncActiveTimer(localState.session);
      }

      return {
        success: true,
        details: {
          eventSync,
          conflictResolution,
          timestamp: new Date().toISOString(),
        },
      };

    } catch (error) {
      return {
        success: false,
        details: { error: error instanceof Error ? error.message : 'Unknown error' },
      };
    }
  }

  /**
   * Get sync status information
   */
  getSyncStatus(): {
    isOnline: boolean;
    isSyncing: boolean;
    lastSyncTime: Date | null;
    pendingEvents: number;
  } {
    return {
      isOnline: navigator.onLine,
      isSyncing: this.isSyncing,
      lastSyncTime: this.lastSyncTime,
      pendingEvents: this.persistenceService.getPendingEvents().length,
    };
  }

  /**
   * Start periodic synchronization
   */
  startPeriodicSync(): void {
    this.stopPeriodicSync();
    
    this.syncInterval = setInterval(async () => {
      if (navigator.onLine && !this.isSyncing) {
        await this.syncPendingEvents();
      }
    }, this.config.syncInterval);
  }

  /**
   * Stop periodic synchronization
   */
  stopPeriodicSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.stopPeriodicSync();
  }

  // Private methods

  private groupEventsByType(events: TimerEvent[]): Map<string, TimerEvent[]> {
    const groups = new Map<string, TimerEvent[]>();
    
    events.forEach(event => {
      if (!groups.has(event.type)) {
        groups.set(event.type, []);
      }
      groups.get(event.type)!.push(event);
    });
    
    return groups;
  }

  private async syncEventGroup(eventType: string, events: TimerEvent[]): Promise<string[]> {
    switch (eventType) {
      case 'start':
        return await this.apiClient.syncStartEvents(events);
      case 'pause':
        return await this.apiClient.syncPauseEvents(events);
      case 'resume':
        return await this.apiClient.syncResumeEvents(events);
      case 'stop':
        return await this.apiClient.syncStopEvents(events);
      default:
        throw new TimerSyncError(`Unknown event type: ${eventType}`, { eventType, events });
    }
  }
}

/**
 * Interface for timer API client (to be implemented by consumer)
 */
export interface TimerApiClient {
  getActiveTimer(): Promise<TimerSession | null>;
  updateActiveTimer(session: TimerSession): Promise<void>;
  clearActiveTimer(): Promise<void>;
  syncStartEvents(events: TimerEvent[]): Promise<string[]>;
  syncPauseEvents(events: TimerEvent[]): Promise<string[]>;
  syncResumeEvents(events: TimerEvent[]): Promise<string[]>;
  syncStopEvents(events: TimerEvent[]): Promise<string[]>;
}

/**
 * Connection monitor for handling online/offline states
 */
export class ConnectionMonitor {
  private listeners: Set<(isOnline: boolean) => void> = new Set();
  private isOnline = true;

  constructor() {
    this.setupEventListeners();
  }

  /**
   * Add listener for connection state changes
   */
  addListener(callback: (isOnline: boolean) => void): void {
    this.listeners.add(callback);
  }

  /**
   * Remove connection state listener
   */
  removeListener(callback: (isOnline: boolean) => void): void {
    this.listeners.delete(callback);
  }

  /**
   * Get current connection state
   */
  getConnectionState(): boolean {
    return this.isOnline;
  }

  /**
   * Manually trigger connection check
   */
  async checkConnection(): Promise<boolean> {
    try {
      // Try to fetch a small resource to verify connectivity
      const response = await fetch('/api/health', { 
        method: 'HEAD',
        cache: 'no-cache',
      });
      
      const wasOnline = this.isOnline;
      this.isOnline = response.ok;
      
      if (wasOnline !== this.isOnline) {
        this.notifyListeners();
      }
      
      return this.isOnline;
    } catch (error) {
      const wasOnline = this.isOnline;
      this.isOnline = false;
      
      if (wasOnline !== this.isOnline) {
        this.notifyListeners();
      }
      
      return false;
    }
  }

  private setupEventListeners(): void {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.isOnline = true;
        this.notifyListeners();
      });

      window.addEventListener('offline', () => {
        this.isOnline = false;
        this.notifyListeners();
      });

      this.isOnline = navigator.onLine;
    }
  }

  private notifyListeners(): void {
    this.listeners.forEach(callback => {
      try {
        callback(this.isOnline);
      } catch (error) {
        console.error('Error in connection listener:', error);
      }
    });
  }
}