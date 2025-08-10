import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TimerDisplay } from '../timer-display';
import { useTimerState, useTimerActions } from '@/hooks/use-timer-state';
import { TimerStatus } from '@shared/timer-types';

// Mock the hooks
jest.mock('@/hooks/use-timer-state');

const mockUseTimerState = useTimerState as jest.MockedFunction<typeof useTimerState>;
const mockUseTimerActions = useTimerActions as jest.MockedFunction<typeof useTimerActions>;

describe('TimerDisplay', () => {
  const mockActions = {
    pauseTimer: jest.fn(),
    resumeTimer: jest.fn(),
    stopTimer: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseTimerActions.mockReturnValue(mockActions as any);
  });

  it('should not render when no active session', () => {
    mockUseTimerState.mockReturnValue({
      activeSession: undefined,
      isTimerRunning: false,
      timerStatus: TimerStatus.IDLE,
      formattedElapsedTime: '0:00',
      isLoading: false,
      error: undefined,
    } as any);

    const { container } = render(<TimerDisplay />);
    expect(container.firstChild).toBeNull();
  });

  it('should render running timer correctly', () => {
    const mockSession = {
      id: 'session-1',
      taskId: 'task-1',
      durationSeconds: 300, // 5 minutes
      isActive: true,
    };

    mockUseTimerState.mockReturnValue({
      activeSession: mockSession,
      isTimerRunning: true,
      timerStatus: TimerStatus.RUNNING,
      formattedElapsedTime: '5:00',
      isLoading: false,
      error: undefined,
    } as any);

    render(<TimerDisplay />);

    expect(screen.getByText('Running')).toBeInTheDocument();
    expect(screen.getByText('5:00')).toBeInTheDocument();
    expect(screen.getByText('Pause')).toBeInTheDocument();
    expect(screen.getByText('Stop')).toBeInTheDocument();
  });

  it('should render paused timer correctly', () => {
    const mockSession = {
      id: 'session-1',
      taskId: 'task-1',
      durationSeconds: 300,
      isActive: false,
    };

    mockUseTimerState.mockReturnValue({
      activeSession: mockSession,
      isTimerRunning: false,
      timerStatus: TimerStatus.PAUSED,
      formattedElapsedTime: '5:00',
      isLoading: false,
      error: undefined,
    } as any);

    render(<TimerDisplay />);

    expect(screen.getByText('Paused')).toBeInTheDocument();
    expect(screen.getByText('5:00')).toBeInTheDocument();
    expect(screen.getByText('Resume')).toBeInTheDocument();
  });

  it('should show progress when estimate is provided', () => {
    const mockSession = {
      id: 'session-1',
      taskId: 'task-1',
      durationSeconds: 1800, // 30 minutes
      isActive: true,
    };

    mockUseTimerState.mockReturnValue({
      activeSession: mockSession,
      isTimerRunning: true,
      timerStatus: TimerStatus.RUNNING,
      formattedElapsedTime: '30:00',
      isLoading: false,
      error: undefined,
    } as any);

    render(<TimerDisplay estimatedMinutes={60} />);

    expect(screen.getByText('of 1h 0m estimated')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('should show over estimate warning', () => {
    const mockSession = {
      id: 'session-1',
      taskId: 'task-1',
      durationSeconds: 3600, // 60 minutes
      isActive: true,
    };

    mockUseTimerState.mockReturnValue({
      activeSession: mockSession,
      isTimerRunning: true,
      timerStatus: TimerStatus.RUNNING,
      formattedElapsedTime: '60:00',
      isLoading: false,
      error: undefined,
    } as any);

    render(<TimerDisplay estimatedMinutes={30} />);

    expect(screen.getByText('(over estimate)')).toBeInTheDocument();
  });

  it('should handle pause action', async () => {
    const mockSession = {
      id: 'session-1',
      taskId: 'task-1',
      durationSeconds: 300,
      isActive: true,
    };

    mockUseTimerState.mockReturnValue({
      activeSession: mockSession,
      isTimerRunning: true,
      timerStatus: TimerStatus.RUNNING,
      formattedElapsedTime: '5:00',
      isLoading: false,
      error: undefined,
    } as any);

    mockActions.pauseTimer.mockResolvedValue({ success: true });

    render(<TimerDisplay />);

    fireEvent.click(screen.getByText('Pause'));

    await waitFor(() => {
      expect(mockActions.pauseTimer).toHaveBeenCalled();
    });
  });

  it('should handle resume action', async () => {
    const mockSession = {
      id: 'session-1',
      taskId: 'task-1',
      durationSeconds: 300,
      isActive: false,
    };

    mockUseTimerState.mockReturnValue({
      activeSession: mockSession,
      isTimerRunning: false,
      timerStatus: TimerStatus.PAUSED,
      formattedElapsedTime: '5:00',
      isLoading: false,
      error: undefined,
    } as any);

    mockActions.resumeTimer.mockResolvedValue({ success: true });

    render(<TimerDisplay />);

    fireEvent.click(screen.getByText('Resume'));

    await waitFor(() => {
      expect(mockActions.resumeTimer).toHaveBeenCalled();
    });
  });

  it('should handle stop action', async () => {
    const mockSession = {
      id: 'session-1',
      taskId: 'task-1',
      durationSeconds: 300,
      isActive: true,
    };

    mockUseTimerState.mockReturnValue({
      activeSession: mockSession,
      isTimerRunning: true,
      timerStatus: TimerStatus.RUNNING,
      formattedElapsedTime: '5:00',
      isLoading: false,
      error: undefined,
    } as any);

    mockActions.stopTimer.mockResolvedValue({ success: true });

    render(<TimerDisplay />);

    fireEvent.click(screen.getByText('Stop'));

    await waitFor(() => {
      expect(mockActions.stopTimer).toHaveBeenCalled();
    });
  });

  it('should render compact variant', () => {
    const mockSession = {
      id: 'session-1',
      taskId: 'task-1',
      durationSeconds: 300,
      isActive: true,
    };

    mockUseTimerState.mockReturnValue({
      activeSession: mockSession,
      isTimerRunning: true,
      timerStatus: TimerStatus.RUNNING,
      formattedElapsedTime: '5:00',
      isLoading: false,
      error: undefined,
    } as any);

    render(<TimerDisplay compact />);

    expect(screen.getByText('5:00')).toBeInTheDocument();
    // Should have icon buttons instead of text buttons
    expect(screen.queryByText('Pause')).not.toBeInTheDocument();
    expect(screen.queryByText('Stop')).not.toBeInTheDocument();
  });

  it('should show error message', () => {
    const mockSession = {
      id: 'session-1',
      taskId: 'task-1',
      durationSeconds: 300,
      isActive: true,
    };

    mockUseTimerState.mockReturnValue({
      activeSession: mockSession,
      isTimerRunning: true,
      timerStatus: TimerStatus.RUNNING,
      formattedElapsedTime: '5:00',
      isLoading: false,
      error: 'Timer sync failed',
    } as any);

    render(<TimerDisplay />);

    expect(screen.getByText('Timer sync failed')).toBeInTheDocument();
  });

  it('should disable buttons when loading', () => {
    const mockSession = {
      id: 'session-1',
      taskId: 'task-1',
      durationSeconds: 300,
      isActive: true,
    };

    mockUseTimerState.mockReturnValue({
      activeSession: mockSession,
      isTimerRunning: true,
      timerStatus: TimerStatus.RUNNING,
      formattedElapsedTime: '5:00',
      isLoading: true,
      error: undefined,
    } as any);

    render(<TimerDisplay />);

    expect(screen.getByText('Pause')).toBeDisabled();
    expect(screen.getByText('Stop')).toBeDisabled();
  });
});