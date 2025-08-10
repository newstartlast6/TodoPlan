import { renderHook, act, waitFor } from '@testing-library/react';
import { useTimerSwitch, useQuickTimerActions } from '../use-timer-switch';
import { useTimerState, useTimerActions } from '../use-timer-state';
import { useToast } from '../use-toast';

// Mock dependencies
jest.mock('../use-timer-state');
jest.mock('../use-toast');

const mockUseTimerState = useTimerState as jest.MockedFunction<typeof useTimerState>;
const mockUseTimerActions = useTimerActions as jest.MockedFunction<typeof useTimerActions>;
const mockUseToast = useToast as jest.MockedFunction<typeof useToast>;

describe('useTimerSwitch', () => {
  const mockActions = {
    startTimer: jest.fn(),
    confirmTimerSwitch: jest.fn(),
    cancelTimerSwitch: jest.fn(),
  };

  const mockToast = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseTimerActions.mockReturnValue(mockActions as any);
    mockUseToast.mockReturnValue({ toast: mockToast } as any);
  });

  it('should start timer without confirmation when no active session', async () => {
    mockUseTimerState.mockReturnValue({
      activeSession: undefined,
    } as any);

    mockActions.startTimer.mockResolvedValue({ success: true });

    const { result } = renderHook(() => useTimerSwitch());

    let startResult;
    await act(async () => {
      startResult = await result.current.requestTimerStart('task-1', 'Test Task');
    });

    expect(startResult).toEqual({ success: true });
    expect(mockActions.startTimer).toHaveBeenCalledWith('task-1');
    expect(mockToast).toHaveBeenCalledWith({
      title: "Timer started",
      description: "Timer started for Test Task",
    });
  });

  it('should show confirmation when another timer is active', async () => {
    mockUseTimerState.mockReturnValue({
      activeSession: { taskId: 'task-1', isActive: true },
    } as any);

    mockActions.startTimer.mockResolvedValue({
      success: false,
      requiresConfirmation: true,
      currentActiveTask: 'task-1',
    });

    const { result } = renderHook(() => useTimerSwitch());

    let startResult;
    await act(async () => {
      startResult = await result.current.requestTimerStart('task-2', 'New Task');
    });

    expect(startResult).toEqual({ success: false, requiresConfirmation: true });
    expect(result.current.isConfirmationOpen).toBe(true);
    expect(result.current.confirmationData).toEqual({
      fromTaskId: 'task-1',
      toTaskId: 'task-2',
      toTaskTitle: 'New Task',
    });
  });

  it('should confirm timer switch successfully', async () => {
    mockUseTimerState.mockReturnValue({
      activeSession: { taskId: 'task-1', isActive: true },
    } as any);

    const { result } = renderHook(() => useTimerSwitch());

    // Set up confirmation state
    await act(async () => {
      result.current.switchState.isConfirmationOpen = true;
      result.current.switchState.toTaskId = 'task-2';
      result.current.switchState.toTaskTitle = 'New Task';
    });

    mockActions.confirmTimerSwitch.mockResolvedValue({ success: true });

    await act(async () => {
      await result.current.confirmSwitch();
    });

    expect(mockActions.confirmTimerSwitch).toHaveBeenCalledWith('task-2');
    expect(mockToast).toHaveBeenCalledWith({
      title: "Timer switched",
      description: "Now tracking time for New Task",
    });
    expect(result.current.isConfirmationOpen).toBe(false);
  });

  it('should cancel timer switch', async () => {
    const { result } = renderHook(() => useTimerSwitch());

    await act(async () => {
      result.current.cancelSwitch();
    });

    expect(mockActions.cancelTimerSwitch).toHaveBeenCalled();
    expect(mockToast).toHaveBeenCalledWith({
      title: "Timer switch cancelled",
      description: "Continuing with current timer",
    });
    expect(result.current.isConfirmationOpen).toBe(false);
  });

  it('should handle errors gracefully', async () => {
    mockUseTimerState.mockReturnValue({
      activeSession: undefined,
    } as any);

    mockActions.startTimer.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useTimerSwitch());

    let startResult;
    await act(async () => {
      startResult = await result.current.requestTimerStart('task-1');
    });

    expect(startResult).toEqual({ success: false });
    expect(mockToast).toHaveBeenCalledWith({
      title: "Error",
      description: "An unexpected error occurred",
      variant: "destructive",
    });
  });

  it('should check if task can start without confirmation', () => {
    mockUseTimerState.mockReturnValue({
      activeSession: { taskId: 'task-1', isActive: true },
    } as any);

    const { result } = renderHook(() => useTimerSwitch());

    expect(result.current.canStartWithoutConfirmation('task-1')).toBe(true);
    expect(result.current.canStartWithoutConfirmation('task-2')).toBe(false);
  });

  it('should get active task info', () => {
    const mockSession = {
      taskId: 'task-1',
      isActive: true,
      durationSeconds: 300,
    };

    mockUseTimerState.mockReturnValue({
      activeSession: mockSession,
    } as any);

    const { result } = renderHook(() => useTimerSwitch());

    expect(result.current.getActiveTaskInfo()).toEqual({
      taskId: 'task-1',
      isRunning: true,
      elapsedSeconds: 300,
    });
  });
});

describe('useQuickTimerActions', () => {
  const mockActions = {
    pauseTimer: jest.fn(),
    resumeTimer: jest.fn(),
    stopTimer: jest.fn(),
  };

  const mockToast = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseTimerActions.mockReturnValue(mockActions as any);
    mockUseToast.mockReturnValue({ toast: mockToast } as any);
  });

  it('should handle quick pause', async () => {
    mockActions.pauseTimer.mockResolvedValue({ success: true });

    const { result } = renderHook(() => useQuickTimerActions());

    let pauseResult;
    await act(async () => {
      pauseResult = await result.current.quickPause();
    });

    expect(pauseResult).toBe(true);
    expect(mockActions.pauseTimer).toHaveBeenCalled();
    expect(mockToast).toHaveBeenCalledWith({
      title: "Timer paused",
      description: "Time tracking paused",
    });
  });

  it('should handle quick resume', async () => {
    mockActions.resumeTimer.mockResolvedValue({ success: true });

    const { result } = renderHook(() => useQuickTimerActions());

    let resumeResult;
    await act(async () => {
      resumeResult = await result.current.quickResume();
    });

    expect(resumeResult).toBe(true);
    expect(mockActions.resumeTimer).toHaveBeenCalled();
    expect(mockToast).toHaveBeenCalledWith({
      title: "Timer resumed",
      description: "Time tracking resumed",
    });
  });

  it('should handle quick stop', async () => {
    mockActions.stopTimer.mockResolvedValue({ success: true });

    const { result } = renderHook(() => useQuickTimerActions());

    let stopResult;
    await act(async () => {
      stopResult = await result.current.quickStop();
    });

    expect(stopResult).toBe(true);
    expect(mockActions.stopTimer).toHaveBeenCalled();
    expect(mockToast).toHaveBeenCalledWith({
      title: "Timer stopped",
      description: "Time has been saved",
    });
  });

  it('should handle quick toggle for same task', async () => {
    mockUseTimerState.mockReturnValue({
      activeSession: { taskId: 'task-1', isActive: true },
    } as any);

    mockActions.pauseTimer.mockResolvedValue({ success: true });

    const { result } = renderHook(() => useQuickTimerActions());

    let toggleResult;
    await act(async () => {
      toggleResult = await result.current.quickToggle('task-1', 'Test Task');
    });

    expect(toggleResult).toBe(true);
    expect(mockActions.pauseTimer).toHaveBeenCalled();
  });

  it('should handle quick toggle for paused same task', async () => {
    mockUseTimerState.mockReturnValue({
      activeSession: { taskId: 'task-1', isActive: false },
    } as any);

    mockActions.resumeTimer.mockResolvedValue({ success: true });

    const { result } = renderHook(() => useQuickTimerActions());

    let toggleResult;
    await act(async () => {
      toggleResult = await result.current.quickToggle('task-1', 'Test Task');
    });

    expect(toggleResult).toBe(true);
    expect(mockActions.resumeTimer).toHaveBeenCalled();
  });
});