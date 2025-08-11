import { TimerSession, TimerEvent, DailyTimeSummaryResponse } from '@shared/timer-types';
import { TimerApiClient as ITimerApiClient } from '@shared/services/sync-service';

/**
 * API client for timer operations
 */
export class TimerApiClient implements ITimerApiClient {
  private baseUrl = '/api';

  constructor() {
    const anyWindow = window as any;
    if (anyWindow?.electronAPI?.getApiBaseUrl) {
      try {
        this.baseUrl = anyWindow.electronAPI.getApiBaseUrl();
        return;
      } catch {}
    }
    // Fallback for web/dev
    this.baseUrl = '/api';
  }

  /**
   * Start a timer for a task
   */
  async startTimer(taskId: string): Promise<{ session: TimerSession; switchedFrom?: string }> {
    const response = await fetch(`${this.baseUrl}/timers/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskId }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to start timer');
    }

    return response.json();
  }

  /**
   * Pause the current active timer
   */
  async pauseTimer(): Promise<{ session: TimerSession; totalElapsedSeconds: number }> {
    const response = await fetch(`${this.baseUrl}/timers/pause`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to pause timer');
    }

    return response.json();
  }

  /**
   * Resume a paused timer
   */
  async resumeTimer(sessionId: string): Promise<{ session: TimerSession }> {
    const response = await fetch(`${this.baseUrl}/timers/resume`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to resume timer');
    }

    return response.json();
  }

  /**
   * Stop the current active timer
   */
  async stopTimer(): Promise<{ session: TimerSession }> {
    const response = await fetch(`${this.baseUrl}/timers/stop`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to stop timer');
    }

    return response.json();
  }

  /**
   * Get current active timer
   */
  async getActiveTimer(): Promise<TimerSession | null> {
    const response = await fetch(`${this.baseUrl}/timers/active`);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to get active timer');
    }

    const data = await response.json();
    return data.session || null;
  }

  /**
   * Update active timer state on server
   */
  async updateActiveTimer(session: TimerSession): Promise<void> {
    // This would typically be a PUT request to update the session
    // For now, we'll use the existing endpoints
    if (session.isActive) {
      await this.startTimer(session.taskId);
    } else if (session.endTime) {
      await this.stopTimer();
    } else {
      await this.pauseTimer();
    }
  }

  /**
   * Clear active timer on server
   */
  async clearActiveTimer(): Promise<void> {
    // Stop any active timer
    try {
      await this.stopTimer();
    } catch (error) {
      // Ignore errors if no active timer
    }
  }

  /**
   * Get daily time summary
   */
  async getDailySummary(date?: Date): Promise<DailyTimeSummaryResponse> {
    const params = new URLSearchParams();
    if (date) {
      params.append('date', date.toISOString().split('T')[0]);
    }

    const response = await fetch(`${this.baseUrl}/timers/daily?${params}`);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to get daily summary');
    }

    return response.json();
  }

  /**
   * Get timer data for a specific task
   */
  async getTaskTimerData(taskId: string): Promise<{
    taskId: string;
    sessions: TimerSession[];
    estimate?: any;
    totalSeconds: number;
  }> {
    const response = await fetch(`${this.baseUrl}/timers/task/${taskId}`);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to get task timer data');
    }

    return response.json();
  }

  /**
   * Sync timer events with server
   */
  async syncEvents(events: TimerEvent[]): Promise<string[]> {
    const response = await fetch(`${this.baseUrl}/timers/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to sync timer events');
    }

    const data = await response.json();
    return data.syncedEventIds || [];
  }

  /**
   * Sync start events
   */
  async syncStartEvents(events: TimerEvent[]): Promise<string[]> {
    return this.syncEvents(events.filter(e => e.type === 'start'));
  }

  /**
   * Sync pause events
   */
  async syncPauseEvents(events: TimerEvent[]): Promise<string[]> {
    return this.syncEvents(events.filter(e => e.type === 'pause'));
  }

  /**
   * Sync resume events
   */
  async syncResumeEvents(events: TimerEvent[]): Promise<string[]> {
    return this.syncEvents(events.filter(e => e.type === 'resume'));
  }

  /**
   * Sync stop events
   */
  async syncStopEvents(events: TimerEvent[]): Promise<string[]> {
    return this.syncEvents(events.filter(e => e.type === 'stop'));
  }

  /**
   * Get or create task estimate
   */
  async getTaskEstimate(taskId: string): Promise<any> {
    const response = await fetch(`${this.baseUrl}/tasks/${taskId}/estimate`);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to get task estimate');
    }

    const data = await response.json();
    return data.estimate;
  }

  /**
   * Set task estimate
   */
  async setTaskEstimate(taskId: string, estimatedDurationMinutes: number): Promise<any> {
    const response = await fetch(`${this.baseUrl}/tasks/${taskId}/estimate`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estimatedDurationMinutes }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to set task estimate');
    }

    const data = await response.json();
    return data.estimate;
  }

  /**
   * Delete task estimate
   */
  async deleteTaskEstimate(taskId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/tasks/${taskId}/estimate`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to delete task estimate');
    }
  }
}