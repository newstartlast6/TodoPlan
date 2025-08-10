import { TimerError, TIMER_ERROR_CODES } from '@shared/services/timer-errors';

interface ErrorReport {
  id: string;
  timestamp: Date;
  error: TimerError;
  context: ErrorContext;
  severity: 'low' | 'medium' | 'high' | 'critical';
  resolved: boolean;
  retryCount: number;
}

interface ErrorContext {
  userId?: string;
  sessionId?: string;
  component?: string;
  action?: string;
  userAgent: string;
  url: string;
  timerState?: any;
  additionalData?: Record<string, any>;
}

interface ErrorMetrics {
  totalErrors: number;
  errorsByType: Record<string, number>;
  errorsBySeverity: Record<string, number>;
  resolvedErrors: number;
  averageResolutionTime: number;
  recentErrors: ErrorReport[];
}

/**
 * Service for monitoring and logging timer-related errors
 */
export class ErrorMonitoringService {
  private errors: Map<string, ErrorReport> = new Map();
  private maxStoredErrors = 100;
  private listeners: Set<(report: ErrorReport) => void> = new Set();

  constructor() {
    this.loadStoredErrors();
    this.setupGlobalErrorHandlers();
  }

  /**
   * Report a timer error
   */
  reportError(
    error: TimerError | Error, 
    context: Partial<ErrorContext> = {}
  ): string {
    const timerError = error instanceof TimerError ? error : this.convertToTimerError(error);
    const errorId = this.generateErrorId();
    
    const report: ErrorReport = {
      id: errorId,
      timestamp: new Date(),
      error: timerError,
      context: {
        userAgent: navigator.userAgent,
        url: window.location.href,
        ...context,
      },
      severity: this.determineSeverity(timerError),
      resolved: false,
      retryCount: 0,
    };

    this.errors.set(errorId, report);
    this.notifyListeners(report);
    this.persistError(report);
    this.cleanupOldErrors();

    // Send to external monitoring service if configured
    this.sendToExternalService(report);

    return errorId;
  }

  /**
   * Mark an error as resolved
   */
  resolveError(errorId: string): boolean {
    const report = this.errors.get(errorId);
    if (report) {
      report.resolved = true;
      this.persistError(report);
      return true;
    }
    return false;
  }

  /**
   * Increment retry count for an error
   */
  incrementRetryCount(errorId: string): void {
    const report = this.errors.get(errorId);
    if (report) {
      report.retryCount++;
      this.persistError(report);
    }
  }

  /**
   * Get error metrics
   */
  getMetrics(): ErrorMetrics {
    const allErrors = Array.from(this.errors.values());
    const resolvedErrors = allErrors.filter(e => e.resolved);
    
    const errorsByType: Record<string, number> = {};
    const errorsBySeverity: Record<string, number> = {};

    allErrors.forEach(report => {
      const type = report.error.code || 'UNKNOWN_ERROR';
      errorsByType[type] = (errorsByType[type] || 0) + 1;
      errorsBySeverity[report.severity] = (errorsBySeverity[report.severity] || 0) + 1;
    });

    const averageResolutionTime = resolvedErrors.length > 0
      ? resolvedErrors.reduce((sum, error) => {
          // Mock resolution time calculation
          return sum + (Date.now() - error.timestamp.getTime());
        }, 0) / resolvedErrors.length
      : 0;

    return {
      totalErrors: allErrors.length,
      errorsByType,
      errorsBySeverity,
      resolvedErrors: resolvedErrors.length,
      averageResolutionTime,
      recentErrors: allErrors
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
        .slice(0, 10),
    };
  }

  /**
   * Get errors by severity
   */
  getErrorsBySeverity(severity: 'low' | 'medium' | 'high' | 'critical'): ErrorReport[] {
    return Array.from(this.errors.values())
      .filter(report => report.severity === severity)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Get unresolved errors
   */
  getUnresolvedErrors(): ErrorReport[] {
    return Array.from(this.errors.values())
      .filter(report => !report.resolved)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Add error listener
   */
  addListener(callback: (report: ErrorReport) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  /**
   * Clear all errors
   */
  clearErrors(): void {
    this.errors.clear();
    localStorage.removeItem('timer_error_reports');
  }

  /**
   * Export error data
   */
  exportErrors(): string {
    const allErrors = Array.from(this.errors.values());
    return JSON.stringify({
      exportDate: new Date().toISOString(),
      totalErrors: allErrors.length,
      errors: allErrors.map(report => ({
        id: report.id,
        timestamp: report.timestamp.toISOString(),
        errorCode: report.error.code,
        errorMessage: report.error.message,
        severity: report.severity,
        resolved: report.resolved,
        retryCount: report.retryCount,
        context: {
          component: report.context.component,
          action: report.context.action,
          url: report.context.url,
        },
      })),
    }, null, 2);
  }

  // Private methods

  private convertToTimerError(error: Error): TimerError {
    return new TimerError(
      error.message,
      'UNKNOWN_ERROR',
      { originalError: error }
    );
  }

  private determineSeverity(error: TimerError): 'low' | 'medium' | 'high' | 'critical' {
    switch (error.code) {
      case TIMER_ERROR_CODES.INVALID_TASK_ID:
      case TIMER_ERROR_CODES.INVALID_DURATION:
      case TIMER_ERROR_CODES.TIMER_NOT_PAUSED:
        return 'low';

      case TIMER_ERROR_CODES.NO_ACTIVE_TIMER:
      case TIMER_ERROR_CODES.TIMER_ALREADY_ACTIVE:
      case TIMER_ERROR_CODES.SYNC_CONFLICT:
        return 'medium';

      case TIMER_ERROR_CODES.STORAGE_UNAVAILABLE:
      case TIMER_ERROR_CODES.NETWORK_ERROR:
      case TIMER_ERROR_CODES.SERVER_ERROR:
        return 'high';

      case TIMER_ERROR_CODES.STORAGE_FULL:
      case TIMER_ERROR_CODES.CORRUPTION_DETECTED:
        return 'critical';

      default:
        return 'medium';
    }
  }

  private generateErrorId(): string {
    return `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private notifyListeners(report: ErrorReport): void {
    this.listeners.forEach(callback => {
      try {
        callback(report);
      } catch (error) {
        console.error('Error in error monitoring listener:', error);
      }
    });
  }

  private persistError(report: ErrorReport): void {
    try {
      const stored = this.getStoredErrors();
      stored[report.id] = {
        ...report,
        timestamp: report.timestamp.toISOString(),
      };
      
      localStorage.setItem('timer_error_reports', JSON.stringify(stored));
    } catch (error) {
      console.warn('Failed to persist error report:', error);
    }
  }

  private loadStoredErrors(): void {
    try {
      const stored = this.getStoredErrors();
      Object.entries(stored).forEach(([id, data]: [string, any]) => {
        const report: ErrorReport = {
          ...data,
          timestamp: new Date(data.timestamp),
          error: new TimerError(data.error.message, data.error.code, data.error.details),
        };
        this.errors.set(id, report);
      });
    } catch (error) {
      console.warn('Failed to load stored error reports:', error);
    }
  }

  private getStoredErrors(): Record<string, any> {
    try {
      const stored = localStorage.getItem('timer_error_reports');
      return stored ? JSON.parse(stored) : {};
    } catch (error) {
      return {};
    }
  }

  private cleanupOldErrors(): void {
    if (this.errors.size > this.maxStoredErrors) {
      const sortedErrors = Array.from(this.errors.entries())
        .sort(([, a], [, b]) => a.timestamp.getTime() - b.timestamp.getTime());
      
      const toRemove = sortedErrors.slice(0, this.errors.size - this.maxStoredErrors);
      toRemove.forEach(([id]) => this.errors.delete(id));
    }
  }

  private setupGlobalErrorHandlers(): void {
    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      if (this.isTimerRelatedError(event.reason)) {
        this.reportError(event.reason, {
          component: 'global',
          action: 'unhandled_promise_rejection',
        });
      }
    });

    // Handle global errors
    window.addEventListener('error', (event) => {
      if (this.isTimerRelatedError(event.error)) {
        this.reportError(event.error, {
          component: 'global',
          action: 'global_error',
          additionalData: {
            filename: event.filename,
            lineno: event.lineno,
            colno: event.colno,
          },
        });
      }
    });
  }

  private isTimerRelatedError(error: any): boolean {
    if (!error) return false;
    
    // Check if it's a TimerError
    if (error instanceof TimerError) return true;
    
    // Check error message for timer-related keywords
    const message = error.message || error.toString();
    const timerKeywords = ['timer', 'tracking', 'session', 'duration', 'sync'];
    
    return timerKeywords.some(keyword => 
      message.toLowerCase().includes(keyword)
    );
  }

  private sendToExternalService(report: ErrorReport): void {
    // In a real application, you would send this to your monitoring service
    // Examples: Sentry, LogRocket, Bugsnag, etc.
    
    if (process.env.NODE_ENV === 'development') {
      console.group(`🚨 Timer Error Report: ${report.id}`);
      console.log('Severity:', report.severity);
      console.log('Error:', report.error);
      console.log('Context:', report.context);
      console.log('Timestamp:', report.timestamp);
      console.log('User Agent:', report.context.userAgent);
      console.log('URL:', report.context.url);
      if (report.context.timerState) {
        console.log('Timer State:', report.context.timerState);
      }
      console.groupEnd();
    }

    // Send to external monitoring services
    this.sendToSentry(report);
    this.sendToAnalytics(report);
    this.logToServer(report);
  }

  private sendToSentry(report: ErrorReport): void {
    try {
      // Example Sentry integration
      if (typeof window !== 'undefined' && (window as any).Sentry) {
        (window as any).Sentry.captureException(report.error, {
          tags: {
            component: 'timer',
            severity: report.severity,
            errorCode: report.error.code,
          },
          extra: {
            ...report.context,
            errorId: report.id,
            retryCount: report.retryCount,
          },
          level: this.mapSeverityToSentryLevel(report.severity),
        });
      }
    } catch (error) {
      console.warn('Failed to send error to Sentry:', error);
    }
  }

  private sendToAnalytics(report: ErrorReport): void {
    try {
      // Example analytics tracking
      if (typeof window !== 'undefined' && (window as any).gtag) {
        (window as any).gtag('event', 'timer_error', {
          event_category: 'error',
          event_label: report.error.code,
          value: this.mapSeverityToNumeric(report.severity),
          custom_parameters: {
            error_id: report.id,
            component: report.context.component,
            action: report.context.action,
          },
        });
      }
    } catch (error) {
      console.warn('Failed to send error to analytics:', error);
    }
  }

  private logToServer(report: ErrorReport): void {
    try {
      // Send error report to server for centralized logging
      if (report.severity === 'critical' || report.severity === 'high') {
        fetch('/api/errors/report', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            errorId: report.id,
            timestamp: report.timestamp.toISOString(),
            severity: report.severity,
            errorCode: report.error.code,
            errorMessage: report.error.message,
            context: {
              component: report.context.component,
              action: report.context.action,
              url: report.context.url,
              userAgent: report.context.userAgent,
              timerState: report.context.timerState,
            },
            retryCount: report.retryCount,
          }),
        }).catch(error => {
          console.warn('Failed to send error report to server:', error);
        });
      }
    } catch (error) {
      console.warn('Failed to log error to server:', error);
    }
  }

  private mapSeverityToSentryLevel(severity: string): string {
    switch (severity) {
      case 'low': return 'info';
      case 'medium': return 'warning';
      case 'high': return 'error';
      case 'critical': return 'fatal';
      default: return 'error';
    }
  }

  private mapSeverityToNumeric(severity: string): number {
    switch (severity) {
      case 'low': return 1;
      case 'medium': return 2;
      case 'high': return 3;
      case 'critical': return 4;
      default: return 2;
    }
  }
}

/**
 * Singleton instance for global use
 */
export const errorMonitoringService = new ErrorMonitoringService();

/**
 * Hook for using error monitoring in React components
 */
export function useErrorMonitoring() {
  const [metrics, setMetrics] = React.useState(() => 
    errorMonitoringService.getMetrics()
  );

  React.useEffect(() => {
    const updateMetrics = () => setMetrics(errorMonitoringService.getMetrics());
    
    const unsubscribe = errorMonitoringService.addListener(updateMetrics);
    
    // Update metrics periodically
    const interval = setInterval(updateMetrics, 30000); // Every 30 seconds
    
    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, []);

  const reportError = React.useCallback((
    error: TimerError | Error,
    context?: Partial<ErrorContext>
  ) => {
    return errorMonitoringService.reportError(error, context);
  }, []);

  const resolveError = React.useCallback((errorId: string) => {
    return errorMonitoringService.resolveError(errorId);
  }, []);

  return {
    metrics,
    reportError,
    resolveError,
    getUnresolvedErrors: () => errorMonitoringService.getUnresolvedErrors(),
    exportErrors: () => errorMonitoringService.exportErrors(),
    clearErrors: () => errorMonitoringService.clearErrors(),
  };
}