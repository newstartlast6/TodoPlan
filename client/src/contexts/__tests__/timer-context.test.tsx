import React from 'react';
import { render, screen, act, waitFor } from '@testing-library/react';
import { TimerProvider, useTimer } from '../timer-context';
import { TimerApiClient } from '../../services/timer-api-client';

// Mock the timer services
jest.mock('@shared/services/timer-service');
jest.mock('@shared/services/persistence-service');
jest.mock('@shared/services/sync-service');
jest.mock('../../services/timer-api-client');

const MockedTimerApiClient = TimerApiClient as jest.MockedClass<typeof TimerApiClient>;

// Test component that uses the timer context
function TestComponent() {
  const { state, actions } = useTimer();
  
  return (
    <div>
      <div data-testid="loading">{state.isLoading ? 'loading' : 'not-loading'}</div>
      <div data-testid="active-task">{state.activeSession?.taskId || 'none'}</div>
      <div data-testid="daily-total">{state.totalDailySeconds}</div>
      <div data-testid="error">{state.error || 'no-error'}</div>
      
      <button 
        data-testid="start-timer" 
        onClick={() => actions.startTimer('test-task')}
      >
        Start Timer
      </button>
      
      <button 
        data-testid="pause-timer" 
        onClick={() => actions.pauseTimer()}
      >
        Pause Timer
      </button>
      
      <button 
        data-testid="stop-timer" 
        onClick={() => actions.stopTimer()}
      >
        Stop Timer
      </button>
    </div>
  );
}

describe('TimerProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock API client methods
    MockedTimerApiClient.prototype.getActiveTimer = jest.fn().mockResolvedValue(null);
    MockedTimerApiClient.prototype.getDailySummary = jest.fn().mockResolvedValue({
      date: '2023-01-01',
      totalSeconds: 0,
      remainingSeconds: 28800,
      targetSeconds: 28800,
      taskBreakdown: [],
    });
  });

  it('should provide timer context to children', async () => {
    render(
      <TimerProvider>
        <TestComponent />
      </TimerProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('not-loading');
    });

    expect(screen.getByTestId('active-task')).toHaveTextContent('none');
    expect(screen.getByTestId('daily-total')).toHaveTextContent('0');
    expect(screen.getByTestId('error')).toHaveTextContent('no-error');
  });

  it('should handle timer start action', async () => {
    const mockSession = {
      id: 'session-1',
      taskId: 'test-task',
      startTime: new Date(),
      durationSeconds: 0,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Mock timer service to return successful start
    const mockTimerService = {
      startTimer: jest.fn().mockResolvedValue({
        success: true,
        session: mockSession,
      }),
      on: jest.fn(),
      off: jest.fn(),
      destroy: jest.fn(),
    };

    jest.doMock('@shared/services/timer-service', () => ({
      TimerService: jest.fn(() => mockTimerService),
    }));

    render(
      <TimerProvider>
        <TestComponent />
      </TimerProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('not-loading');
    });

    act(() => {
      screen.getByTestId('start-timer').click();
    });

    await waitFor(() => {
      expect(mockTimerService.startTimer).toHaveBeenCalledWith('test-task');
    });
  });

  it('should handle timer confirmation flow', async () => {
    const mockTimerService = {
      startTimer: jest.fn().mockResolvedValue({
        success: false,
        requiresConfirmation: true,
        currentActiveTask: 'other-task',
      }),
      on: jest.fn(),
      off: jest.fn(),
      destroy: jest.fn(),
    };

    jest.doMock('@shared/services/timer-service', () => ({
      TimerService: jest.fn(() => mockTimerService),
    }));

    render(
      <TimerProvider>
        <TestComponent />
      </TimerProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('not-loading');
    });

    act(() => {
      screen.getByTestId('start-timer').click();
    });

    await waitFor(() => {
      expect(mockTimerService.startTimer).toHaveBeenCalledWith('test-task');
    });
  });

  it('should handle errors gracefully', async () => {
    const mockTimerService = {
      startTimer: jest.fn().mockRejectedValue(new Error('Timer service error')),
      on: jest.fn(),
      off: jest.fn(),
      destroy: jest.fn(),
    };

    jest.doMock('@shared/services/timer-service', () => ({
      TimerService: jest.fn(() => mockTimerService),
    }));

    render(
      <TimerProvider>
        <TestComponent />
      </TimerProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('not-loading');
    });

    act(() => {
      screen.getByTestId('start-timer').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('error')).toHaveTextContent('Timer service error');
    });
  });

  it('should load daily summary on initialization', async () => {
    const mockDailySummary = {
      date: '2023-01-01',
      totalSeconds: 3600,
      remainingSeconds: 25200,
      targetSeconds: 28800,
      taskBreakdown: [
        {
          date: '2023-01-01',
          taskId: 'task-1',
          totalSeconds: 3600,
          sessionCount: 2,
        },
      ],
    };

    MockedTimerApiClient.prototype.getDailySummary = jest.fn().mockResolvedValue(mockDailySummary);

    render(
      <TimerProvider>
        <TestComponent />
      </TimerProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('daily-total')).toHaveTextContent('3600');
    });

    expect(MockedTimerApiClient.prototype.getDailySummary).toHaveBeenCalled();
  });

  it('should throw error when useTimer is used outside provider', () => {
    // Suppress console.error for this test
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      render(<TestComponent />);
    }).toThrow('useTimer must be used within a TimerProvider');

    consoleSpy.mockRestore();
  });
});

describe('Timer Context Integration', () => {
  it('should handle complete timer lifecycle', async () => {
    const mockSession = {
      id: 'session-1',
      taskId: 'test-task',
      startTime: new Date(),
      durationSeconds: 0,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const mockTimerService = {
      startTimer: jest.fn().mockResolvedValue({ success: true, session: mockSession }),
      pauseTimer: jest.fn().mockResolvedValue({ 
        success: true, 
        session: { ...mockSession, isActive: false, durationSeconds: 60 }
      }),
      stopTimer: jest.fn().mockResolvedValue({ 
        success: true, 
        session: { ...mockSession, isActive: false, endTime: new Date() }
      }),
      on: jest.fn(),
      off: jest.fn(),
      destroy: jest.fn(),
    };

    jest.doMock('@shared/services/timer-service', () => ({
      TimerService: jest.fn(() => mockTimerService),
    }));

    render(
      <TimerProvider>
        <TestComponent />
      </TimerProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('not-loading');
    });

    // Start timer
    act(() => {
      screen.getByTestId('start-timer').click();
    });

    await waitFor(() => {
      expect(mockTimerService.startTimer).toHaveBeenCalled();
    });

    // Pause timer
    act(() => {
      screen.getByTestId('pause-timer').click();
    });

    await waitFor(() => {
      expect(mockTimerService.pauseTimer).toHaveBeenCalled();
    });

    // Stop timer
    act(() => {
      screen.getByTestId('stop-timer').click();
    });

    await waitFor(() => {
      expect(mockTimerService.stopTimer).toHaveBeenCalled();
    });
  });
});