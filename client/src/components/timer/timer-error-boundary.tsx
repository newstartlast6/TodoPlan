import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Bug, Clock, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TimerError, TimerErrorHandler } from '@shared/services/timer-errors';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorId: string | null;
  retryCount: number;
}

/**
 * Error boundary specifically for timer-related components
 */
export class TimerErrorBoundary extends Component<Props, State> {
  private maxRetries = 3;

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
      retryCount: 0,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
      errorId: `timer_error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({
      errorInfo,
    });

    // Log error details
    console.error('Timer Error Boundary caught an error:', error, errorInfo);

    // Call custom error handler if provided
    this.props.onError?.(error, errorInfo);

    // Report error to monitoring service (if available)
    this.reportError(error, errorInfo);
  }

  private reportError = (error: Error, errorInfo: ErrorInfo) => {
    // In a real application, you would send this to your error monitoring service
    const errorReport = {
      errorId: this.state.errorId,
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
    };

    // Example: Send to monitoring service
    // errorMonitoringService.report(errorReport);
    
    console.warn('Error report generated:', errorReport);
  };

  private handleRetry = () => {
    if (this.state.retryCount < this.maxRetries) {
      this.setState(prevState => ({
        hasError: false,
        error: null,
        errorInfo: null,
        errorId: null,
        retryCount: prevState.retryCount + 1,
      }));
    }
  };

  private handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
      retryCount: 0,
    });
  };

  private getErrorSeverity = (error: Error): 'low' | 'medium' | 'high' | 'critical' => {
    if (error instanceof TimerError) {
      // Timer-specific error severity
      if (error.code === 'TIMER_SYNC_ERROR') return 'medium';
      if (error.code === 'TIMER_PERSISTENCE_ERROR') return 'high';
      if (error.code === 'TIMER_STATE_ERROR') return 'low';
      if (error.code === 'TIMER_VALIDATION_ERROR') return 'low';
    }

    // Check for critical errors
    if (error.message.includes('ChunkLoadError') || 
        error.message.includes('Loading chunk')) {
      return 'critical';
    }

    // Network errors
    if (error.message.includes('fetch') || 
        error.message.includes('network')) {
      return 'medium';
    }

    return 'medium';
  };

  private getErrorActions = (error: Error) => {
    const severity = this.getErrorSeverity(error);
    const canRetry = this.state.retryCount < this.maxRetries;

    const actions = [];

    if (canRetry) {
      actions.push({
        label: 'Retry',
        action: this.handleRetry,
        variant: 'default' as const,
        icon: RefreshCw,
      });
    }

    actions.push({
      label: 'Reset',
      action: this.handleReset,
      variant: 'outline' as const,
      icon: X,
    });

    if (severity === 'critical') {
      actions.push({
        label: 'Reload Page',
        action: () => window.location.reload(),
        variant: 'destructive' as const,
        icon: RefreshCw,
      });
    }

    return actions;
  };

  render() {
    if (this.state.hasError && this.state.error) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const error = this.state.error;
      const severity = this.getErrorSeverity(error);
      const actions = this.getErrorActions(error);
      const isTimerError = error instanceof TimerError;
      const userFriendlyMessage = isTimerError 
        ? TimerErrorHandler.createUserFriendlyMessage(error as TimerError)
        : 'An unexpected error occurred with the timer system.';

      return (
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-800">
              <AlertTriangle className="w-5 h-5" />
              Timer Error
              <Badge 
                variant={severity === 'critical' ? 'destructive' : 'secondary'}
                className="ml-auto"
              >
                {severity}
              </Badge>
            </CardTitle>
          </CardHeader>
          
          <CardContent className="space-y-4">
            {/* User-friendly message */}
            <div className="bg-white border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-800">{userFriendlyMessage}</p>
            </div>

            {/* Error details (collapsible) */}
            <details className="bg-white border border-red-200 rounded-lg">
              <summary className="p-3 cursor-pointer text-sm font-medium text-red-800 hover:bg-red-50">
                <div className="flex items-center gap-2">
                  <Bug className="w-4 h-4" />
                  Technical Details
                </div>
              </summary>
              <div className="p-3 border-t border-red-200 space-y-2">
                <div>
                  <span className="text-xs font-medium text-gray-600">Error:</span>
                  <p className="text-xs text-gray-800 font-mono bg-gray-100 p-2 rounded mt-1">
                    {error.message}
                  </p>
                </div>
                
                {this.state.errorId && (
                  <div>
                    <span className="text-xs font-medium text-gray-600">Error ID:</span>
                    <p className="text-xs text-gray-800 font-mono">
                      {this.state.errorId}
                    </p>
                  </div>
                )}
                
                {isTimerError && (
                  <div>
                    <span className="text-xs font-medium text-gray-600">Error Code:</span>
                    <p className="text-xs text-gray-800 font-mono">
                      {(error as TimerError).code}
                    </p>
                  </div>
                )}
                
                <div>
                  <span className="text-xs font-medium text-gray-600">Retry Count:</span>
                  <p className="text-xs text-gray-800">
                    {this.state.retryCount} / {this.maxRetries}
                  </p>
                </div>
              </div>
            </details>

            {/* Recovery suggestions */}
            {severity !== 'low' && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="text-sm font-medium text-blue-800 mb-2">
                  Recovery Suggestions:
                </div>
                <ul className="text-xs text-blue-700 space-y-1">
                  {severity === 'critical' && (
                    <>
                      <li>• Try reloading the page</li>
                      <li>• Clear your browser cache</li>
                      <li>• Check your internet connection</li>
                    </>
                  )}
                  {severity === 'high' && (
                    <>
                      <li>• Your timer data is safely stored locally</li>
                      <li>• Try refreshing the timer component</li>
                      <li>• Check if the server is accessible</li>
                    </>
                  )}
                  {severity === 'medium' && (
                    <>
                      <li>• This is likely a temporary issue</li>
                      <li>• Try the action again in a moment</li>
                      <li>• Your timer data should be preserved</li>
                    </>
                  )}
                </ul>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-2">
              {actions.map((action, index) => {
                const Icon = action.icon;
                return (
                  <Button
                    key={index}
                    variant={action.variant}
                    size="sm"
                    onClick={action.action}
                    className="flex items-center gap-2"
                  >
                    <Icon className="w-4 h-4" />
                    {action.label}
                  </Button>
                );
              })}
            </div>

            {/* Timer status preservation notice */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-green-600" />
                <span className="text-sm font-medium text-green-800">
                  Timer Data Protected
                </span>
              </div>
              <p className="text-xs text-green-700 mt-1">
                Your active timer and time tracking data are safely stored and will be restored when the error is resolved.
              </p>
            </div>
          </CardContent>
        </Card>
      );
    }

    return this.props.children;
  }
}

/**
 * Hook for handling timer errors in functional components
 */
export function useTimerErrorHandler() {
  const [error, setError] = React.useState<TimerError | null>(null);

  const handleError = React.useCallback((error: unknown) => {
    const timerError = TimerErrorHandler.handleError(error);
    setError(timerError);
    
    // Log error
    console.error('Timer error handled:', timerError);
    
    // Report to monitoring service
    // errorMonitoringService.report(timerError);
  }, []);

  const clearError = React.useCallback(() => {
    setError(null);
  }, []);

  const retryOperation = React.useCallback(async (operation: () => Promise<any>) => {
    try {
      clearError();
      return await operation();
    } catch (error) {
      handleError(error);
      throw error;
    }
  }, [handleError, clearError]);

  return {
    error,
    handleError,
    clearError,
    retryOperation,
    hasError: error !== null,
  };
}

/**
 * Higher-order component for wrapping components with timer error boundary
 */
export function withTimerErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  fallback?: ReactNode
) {
  return function WrappedComponent(props: P) {
    return (
      <TimerErrorBoundary fallback={fallback}>
        <Component {...props} />
      </TimerErrorBoundary>
    );
  };
}