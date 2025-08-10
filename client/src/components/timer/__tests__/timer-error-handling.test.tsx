import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TimerErrorBoundary, useTimerErrorHandler } from '../timer-error-boundary';
import { TimerError, TIMER_ERROR_CODES } from '@shared/services/timer-errors';
import { errorMonitoringService } from '@/services/error-monitoring-service';

// Mock the error monitoring service
jest.mock('@/services/error-monitoring-service', () => ({
  errorMonitoringService: {
    reportError: jest.fn(),
    resolveError: jest.fn(),
    getMetrics: jest.fn(() => ({
      totalErrors: 0,
      errorsByType: {},
      errorsBySeverity: {},
      resolvedErrors: 0,
      averageResolutionTime: 0,
      recentErrors: [],
    })),
    addListener: jest.fn(() => jest.fn()),
  },
}));

const mockErrorMonitoringService = errorMonitoringService as jest.Mocked<typeof errorMonitoringService>;

// Test component that throws errors
const ErrorThrowingComponent: React.FC<{ shouldThrow?: boolean; errorType?: string }> = ({ 
  shouldThrow = false, 
  errorType = 'generic' 
}) => {
  if (shouldThrow) {
    switch (errorType) {
      case 'timer':
        throw new TimerError('Timer operation failed', TIMER_ERROR_CODES.TIMER_STATE_ERROR);
      case 'validation':
        throw new TimerError('Invalid task ID', TIMER_ERROR_CODES.INVALID_TASK_ID);
      case 'network':
        throw new TimerError('Network connection failed', TIMER_ERROR_CODES.NETWORK_ERROR);
      case 'critical':
        throw new Error('ChunkLoadError: Loading chunk failed');
      default:
        throw new Error('Generic error');
    }
  }
  return <div>Component working normally</div>;
};

// Test component using the error handler hook
const ErrorHandlerTestComponent: React.FC = () => {
  const { error, handleError, clearError, retryOperation, hasError } = useTimerErrorHandler();
  
  const triggerError = () => {
    handleError(new TimerError('Test error', TIMER_ERROR_CODES.TIMER_STATE_ERROR));
  };
  
  const triggerRetry = async () => {
    try {
      await retryOperation(async () => {
        throw new TimerError('Retry test error', TIMER_ERROR_CODES.NETWORK_ERROR);
      });
    } catch (e) {
      // Expected to fail
    }
  };

  return (
    <div>
      <button onClick={triggerError}>Trigger Error</button>
      <button onClick={triggerRetry}>Test Retry</button>
      <button onClick={clearError}>Clear Error</button>
      {hasError && <div data-testid="error-display">{error?.message}</div>}
    </div>
  );
};

describe('Timer Error Boundary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Suppress console.error for cleaner test output
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Error Catching', () => {
    it('should catch and display timer errors', () => {
      render(
        <TimerErrorBoundary>
          <ErrorThrowingComponent shouldThrow={true} errorType="timer" />
        </TimerErrorBoundary>
      );

      expect(screen.getByText('Timer Error')).toBeInTheDocument();
      expect(screen.getByText(/Timer operation failed/)).toBeInTheDocument();
      expect(screen.getByText('medium')).toBeInTheDocument(); // severity badge
    });

    it('should catch and display validation errors', () => {
      render(
        <TimerErrorBoundary>
          <ErrorThrowingComponent shouldThrow={true} errorType="validation" />
        </TimerErrorBoundary>
      );

      expect(screen.getByText('Timer Error')).toBeInTheDocument();
      expect(screen.getByText(/Please select a valid task/)).toBeInTheDocument();
      expect(screen.getByText('low')).toBeInTheDocument(); // severity badge
    });

    it('should catch and display network errors', () => {
      render(
        <TimerErrorBoundary>
          <ErrorThrowingComponent shouldThrow={true} errorType="network" />
        </TimerErrorBoundary>
      );

      expect(screen.getByText('Timer Error')).toBeInTheDocument();
      expect(screen.getByText(/Connection lost/)).toBeInTheDocument();
      expect(screen.getByText('medium')).toBeInTheDocument(); // severity badge
    });

    it('should catch and display critical errors', () => {
      render(
        <TimerErrorBoundary>
          <ErrorThrowingComponent shouldThrow={true} errorType="critical" />
        </TimerErrorBoundary>
      );

      expect(screen.getByText('Timer Error')).toBeInTheDocument();
      expect(screen.getByText('critical')).toBeInTheDocument(); // severity badge
      expect(screen.getByText('Reload Page')).toBeInTheDocument();
    });

    it('should render children normally when no error occurs', () => {
      render(
        <TimerErrorBoundary>
          <ErrorThrowingComponent shouldThrow={false} />
        </TimerErrorBoundary>
      );

      expect(screen.getByText('Component working normally')).toBeInTheDocument();
      expect(screen.queryByText('Timer Error')).not.toBeInTheDocument();
    });
  });

  describe('Error Actions', () => {
    it('should provide retry functionality', async () => {
      const { rerender } = render(
        <TimerErrorBoundary>
          <ErrorThrowingComponent shouldThrow={true} errorType="timer" />
        </TimerErrorBoundary>
      );

      expect(screen.getByText('Timer Error')).toBeInTheDocument();
      
      const retryButton = screen.getByText('Retry');
      expect(retryButton).toBeInTheDocument();
      
      fireEvent.click(retryButton);
      
      // After retry, should attempt to render children again
      rerender(
        <TimerErrorBoundary>
          <ErrorThrowingComponent shouldThrow={false} />
        </TimerErrorBoundary>
      );

      await waitFor(() => {
        expect(screen.getByText('Component working normally')).toBeInTheDocument();
      });
    });

    it('should provide reset functionality', () => {
      render(
        <TimerErrorBoundary>
          <ErrorThrowingComponent shouldThrow={true} errorType="timer" />
        </TimerErrorBoundary>
      );

      expect(screen.getByText('Timer Error')).toBeInTheDocument();
      
      const resetButton = screen.getByText('Reset');
      fireEvent.click(resetButton);
      
      // Reset should clear the error state
      expect(screen.queryByText('Timer Error')).not.toBeInTheDocument();
    });

    it('should disable retry after max attempts', () => {
      const TestComponent = () => {
        const [attemptCount, setAttemptCount] = React.useState(0);
        
        if (attemptCount < 4) { // Will throw 4 times to exceed max retries
          React.useEffect(() => {
            setAttemptCount(prev => prev + 1);
          });
          throw new TimerError('Persistent error', TIMER_ERROR_CODES.TIMER_STATE_ERROR);
        }
        
        return <div>Finally working</div>;
      };

      render(
        <TimerErrorBoundary>
          <TestComponent />
        </TimerErrorBoundary>
      );

      // After max retries, retry button should not be available
      expect(screen.queryByText('Retry')).not.toBeInTheDocument();
      expect(screen.getByText('Reset')).toBeInTheDocument();
    });

    it('should provide reload page option for critical errors', () => {
      // Mock window.location.reload
      const mockReload = jest.fn();
      Object.defineProperty(window, 'location', {
        value: { reload: mockReload },
        writable: true,
      });

      render(
        <TimerErrorBoundary>
          <ErrorThrowingComponent shouldThrow={true} errorType="critical" />
        </TimerErrorBoundary>
      );

      const reloadButton = screen.getByText('Reload Page');
      fireEvent.click(reloadButton);
      
      expect(mockReload).toHaveBeenCalled();
    });
  });

  describe('Error Information Display', () => {
    it('should display technical details in collapsible section', () => {
      render(
        <TimerErrorBoundary>
          <ErrorThrowingComponent shouldThrow={true} errorType="timer" />
        </TimerErrorBoundary>
      );

      const detailsToggle = screen.getByText('Technical Details');
      expect(detailsToggle).toBeInTheDocument();
      
      fireEvent.click(detailsToggle);
      
      expect(screen.getByText(/Timer operation failed/)).toBeInTheDocument();
      expect(screen.getByText(/Error ID:/)).toBeInTheDocument();
      expect(screen.getByText(/Error Code:/)).toBeInTheDocument();
    });

    it('should display recovery suggestions based on severity', () => {
      render(
        <TimerErrorBoundary>
          <ErrorThrowingComponent shouldThrow={true} errorType="network" />
        </TimerErrorBoundary>
      );

      expect(screen.getByText('Recovery Suggestions:')).toBeInTheDocument();
      expect(screen.getByText(/This is likely a temporary issue/)).toBeInTheDocument();
    });

    it('should display timer data protection notice', () => {
      render(
        <TimerErrorBoundary>
          <ErrorThrowingComponent shouldThrow={true} errorType="timer" />
        </TimerErrorBoundary>
      );

      expect(screen.getByText('Timer Data Protected')).toBeInTheDocument();
      expect(screen.getByText(/Your active timer and time tracking data are safely stored/)).toBeInTheDocument();
    });
  });

  describe('Custom Error Handler', () => {
    it('should call custom error handler when provided', () => {
      const mockErrorHandler = jest.fn();
      
      render(
        <TimerErrorBoundary onError={mockErrorHandler}>
          <ErrorThrowingComponent shouldThrow={true} errorType="timer" />
        </TimerErrorBoundary>
      );

      expect(mockErrorHandler).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          componentStack: expect.any(String),
        })
      );
    });

    it('should render custom fallback when provided', () => {
      const customFallback = <div data-testid="custom-fallback">Custom Error UI</div>;
      
      render(
        <TimerErrorBoundary fallback={customFallback}>
          <ErrorThrowingComponent shouldThrow={true} errorType="timer" />
        </TimerErrorBoundary>
      );

      expect(screen.getByTestId('custom-fallback')).toBeInTheDocument();
      expect(screen.getByText('Custom Error UI')).toBeInTheDocument();
    });
  });

  describe('Error Monitoring Integration', () => {
    it('should report errors to monitoring service', () => {
      render(
        <TimerErrorBoundary>
          <ErrorThrowingComponent shouldThrow={true} errorType="timer" />
        </TimerErrorBoundary>
      );

      // Error reporting happens in componentDidCatch, so we need to check console.warn
      // since the actual monitoring service is mocked
      expect(console.warn).toHaveBeenCalledWith(
        'Error report generated:',
        expect.objectContaining({
          errorId: expect.any(String),
          message: 'Timer operation failed',
          timestamp: expect.any(String),
          userAgent: expect.any(String),
          url: expect.any(String),
        })
      );
    });
  });
});

describe('useTimerErrorHandler Hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should handle errors correctly', () => {
    render(<ErrorHandlerTestComponent />);
    
    const triggerButton = screen.getByText('Trigger Error');
    fireEvent.click(triggerButton);
    
    expect(screen.getByTestId('error-display')).toBeInTheDocument();
    expect(screen.getByText('Test error')).toBeInTheDocument();
  });

  it('should clear errors correctly', () => {
    render(<ErrorHandlerTestComponent />);
    
    const triggerButton = screen.getByText('Trigger Error');
    const clearButton = screen.getByText('Clear Error');
    
    fireEvent.click(triggerButton);
    expect(screen.getByTestId('error-display')).toBeInTheDocument();
    
    fireEvent.click(clearButton);
    expect(screen.queryByTestId('error-display')).not.toBeInTheDocument();
  });

  it('should handle retry operations', async () => {
    render(<ErrorHandlerTestComponent />);
    
    const retryButton = screen.getByText('Test Retry');
    fireEvent.click(retryButton);
    
    await waitFor(() => {
      expect(screen.getByTestId('error-display')).toBeInTheDocument();
      expect(screen.getByText('Retry test error')).toBeInTheDocument();
    });
  });
});