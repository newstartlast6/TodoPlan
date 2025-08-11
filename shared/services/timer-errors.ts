/**
 * Timer-specific error classes and error handling utilities
 */

export class TimerError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message);
    this.name = 'TimerError';
  }
}

export class TimerValidationError extends TimerError {
  constructor(message: string, details?: any) {
    super(message, 'TIMER_VALIDATION_ERROR', details);
    this.name = 'TimerValidationError';
  }
}

export class TimerStateError extends TimerError {
  constructor(message: string, details?: any) {
    super(message, 'TIMER_STATE_ERROR', details);
    this.name = 'TimerStateError';
  }
}

export class TimerSyncError extends TimerError {
  constructor(message: string, details?: any) {
    super(message, 'TIMER_SYNC_ERROR', details);
    this.name = 'TimerSyncError';
  }
}

export class TimerPersistenceError extends TimerError {
  constructor(message: string, details?: any) {
    super(message, 'TIMER_PERSISTENCE_ERROR', details);
    this.name = 'TimerPersistenceError';
  }
}

/**
 * Timer error codes for consistent error handling
 */
export const TIMER_ERROR_CODES = {
  // Validation errors
  INVALID_TASK_ID: 'INVALID_TASK_ID',
  INVALID_SESSION: 'INVALID_SESSION',
  INVALID_DURATION: 'INVALID_DURATION',
  TIMER_STATE_ERROR: 'TIMER_STATE_ERROR',
  
  // State errors
  NO_ACTIVE_TIMER: 'NO_ACTIVE_TIMER',
  TIMER_ALREADY_ACTIVE: 'TIMER_ALREADY_ACTIVE',
  TIMER_NOT_PAUSED: 'TIMER_NOT_PAUSED',
  TIMER_ALREADY_STOPPED: 'TIMER_ALREADY_STOPPED',
  
  // Sync errors
  SYNC_CONFLICT: 'SYNC_CONFLICT',
  NETWORK_ERROR: 'NETWORK_ERROR',
  SERVER_ERROR: 'SERVER_ERROR',
  
  // Persistence errors
  STORAGE_FULL: 'STORAGE_FULL',
  STORAGE_UNAVAILABLE: 'STORAGE_UNAVAILABLE',
  CORRUPTION_DETECTED: 'CORRUPTION_DETECTED',
  RECOVERY_FAILED: 'RECOVERY_FAILED',
} as const;

/**
 * Error handler utility for consistent error processing
 */
export class TimerErrorHandler {
  static handleError(error: unknown): TimerError {
    if (error instanceof TimerError) {
      return error;
    }
    
    if (error instanceof Error) {
      return new TimerError(error.message, 'UNKNOWN_ERROR', { originalError: error });
    }
    
    return new TimerError('An unknown error occurred', 'UNKNOWN_ERROR', { error });
  }

  static isRetryableError(error: TimerError): boolean {
    const retryableCodes = [
      TIMER_ERROR_CODES.NETWORK_ERROR,
      TIMER_ERROR_CODES.SERVER_ERROR,
      TIMER_ERROR_CODES.STORAGE_UNAVAILABLE,
    ];
    
    return retryableCodes.includes(error.code as any);
  }

  static getErrorMessage(error: TimerError): string {
    const errorMessages: Record<string, string> = {
      [TIMER_ERROR_CODES.INVALID_TASK_ID]: 'Invalid task ID provided',
      [TIMER_ERROR_CODES.INVALID_SESSION]: 'Invalid timer session data',
      [TIMER_ERROR_CODES.INVALID_DURATION]: 'Invalid duration value',
      [TIMER_ERROR_CODES.NO_ACTIVE_TIMER]: 'No active timer found',
      [TIMER_ERROR_CODES.TIMER_ALREADY_ACTIVE]: 'A timer is already running',
      [TIMER_ERROR_CODES.TIMER_NOT_PAUSED]: 'Timer is not in paused state',
      [TIMER_ERROR_CODES.TIMER_ALREADY_STOPPED]: 'Timer has already been stopped',
      [TIMER_ERROR_CODES.SYNC_CONFLICT]: 'Timer state conflict detected',
      [TIMER_ERROR_CODES.NETWORK_ERROR]: 'Network connection error',
      [TIMER_ERROR_CODES.SERVER_ERROR]: 'Server error occurred',
      [TIMER_ERROR_CODES.STORAGE_FULL]: 'Local storage is full',
      [TIMER_ERROR_CODES.STORAGE_UNAVAILABLE]: 'Local storage is unavailable',
      [TIMER_ERROR_CODES.CORRUPTION_DETECTED]: 'Timer data corruption detected',
    };

    return errorMessages[error.code] || error.message || 'An unknown error occurred';
  }

  static createUserFriendlyMessage(error: TimerError): string {
    const userMessages: Record<string, string> = {
      [TIMER_ERROR_CODES.INVALID_TASK_ID]: 'Please select a valid task to start the timer.',
      [TIMER_ERROR_CODES.NO_ACTIVE_TIMER]: 'No timer is currently running.',
      [TIMER_ERROR_CODES.TIMER_ALREADY_ACTIVE]: 'Another timer is already running. Please stop it first or switch timers.',
      [TIMER_ERROR_CODES.NETWORK_ERROR]: 'Connection lost. Your timer will continue running and sync when connection is restored.',
      [TIMER_ERROR_CODES.SERVER_ERROR]: 'Server temporarily unavailable. Your timer data will be saved locally.',
      [TIMER_ERROR_CODES.STORAGE_FULL]: 'Local storage is full. Please clear some data or contact support.',
      [TIMER_ERROR_CODES.CORRUPTION_DETECTED]: 'Timer data appears corrupted. Please restart the timer.',
    };

    return userMessages[error.code] || 'Something went wrong with the timer. Please try again.';
  }
}

/**
 * Retry utility for handling transient errors
 */
export class TimerRetryHandler {
  static async withRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    delayMs: number = 1000
  ): Promise<T> {
    let lastError: TimerError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = TimerErrorHandler.handleError(error);
        
        if (!TimerErrorHandler.isRetryableError(lastError) || attempt === maxRetries) {
          throw lastError;
        }
        
        // Exponential backoff
        const delay = delayMs * Math.pow(2, attempt - 1);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw lastError!;
  }
}