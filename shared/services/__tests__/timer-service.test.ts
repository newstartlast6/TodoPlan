import { TimerService, TimerValidator, TimerCalculator } from '../timer-service';
import { TimerStatus } from '../../timer-types';

// Mock timers for testing
jest.useFakeTimers();

describe('TimerService', () => {
  let timerService: TimerService;
  let mockStateChange: jest.Mock;

  beforeEach(() => {
    mockStateChange = jest.fn();
    timerService = new TimerService(undefined, mockStateChange);
  });

  afterEach(() => {
    timerService.destroy();
    jest.clearAllTimers();
  });

  describe('startTimer', () => {
    it('should start a timer for a task', async () => {
      const result = await timerService.startTimer('task-1');

      expect(result.success).toBe(true);
      expect(result.session).toBeDefined();
      expect(result.session?.taskId).toBe('task-1');
      expect(result.session?.isActive).toBe(true);
      expect(mockStateChange).toHaveBeenCalledWith(result.session);
    });

    it('should not start timer if another is already active', async () => {
      await timerService.startTimer('task-1');
      const result = await timerService.startTimer('task-2');

      expect(result.success).toBe(false);
      expect(result.requiresConfirmation).toBe(true);
      expect(result.currentActiveTask).toBe('task-1');
    });

    it('should emit timer:started event', async () => {
      const mockListener = jest.fn();
      timerService.on('timer:started', mockListener);

      const result = await timerService.startTimer('task-1');

      expect(mockListener).toHaveBeenCalledWith(result.session);
    });
  });

  describe('pauseTimer', () => {
    it('should pause an active timer', async () => {
      await timerService.startTimer('task-1');
      
      // Advance time by 5 seconds
      jest.advanceTimersByTime(5000);
      
      const result = await timerService.pauseTimer();

      expect(result.success).toBe(true);
      expect(result.session?.isActive).toBe(false);
      expect(result.session?.durationSeconds).toBeGreaterThan(0);
    });

    it('should not pause if no active timer', async () => {
      const result = await timerService.pauseTimer();

      expect(result.success).toBe(false);
      expect(result.error).toBe('No active timer to pause');
    });

    it('should emit timer:paused event', async () => {
      const mockListener = jest.fn();
      timerService.on('timer:paused', mockListener);

      await timerService.startTimer('task-1');
      const result = await timerService.pauseTimer();

      expect(mockListener).toHaveBeenCalledWith(result.session);
    });
  });

  describe('resumeTimer', () => {
    it('should resume a paused timer', async () => {
      await timerService.startTimer('task-1');
      await timerService.pauseTimer();
      
      const result = await timerService.resumeTimer();

      expect(result.success).toBe(true);
      expect(result.session?.isActive).toBe(true);
    });

    it('should not resume if no paused timer', async () => {
      const result = await timerService.resumeTimer();

      expect(result.success).toBe(false);
      expect(result.error).toBe('No paused timer to resume');
    });

    it('should not resume an already active timer', async () => {
      await timerService.startTimer('task-1');
      
      const result = await timerService.resumeTimer();

      expect(result.success).toBe(false);
      expect(result.error).toBe('No paused timer to resume');
    });
  });

  describe('stopTimer', () => {
    it('should stop and complete a timer session', async () => {
      await timerService.startTimer('task-1');
      jest.advanceTimersByTime(10000); // 10 seconds
      
      const result = await timerService.stopTimer();

      expect(result.success).toBe(true);
      expect(result.session?.endTime).toBeDefined();
      expect(result.session?.isActive).toBe(false);
      expect(result.session?.durationSeconds).toBeGreaterThan(0);
      expect(timerService.getActiveSession()).toBeNull();
    });

    it('should not stop if no timer exists', async () => {
      const result = await timerService.stopTimer();

      expect(result.success).toBe(false);
      expect(result.error).toBe('No timer to stop');
    });

    it('should emit timer:stopped event', async () => {
      const mockListener = jest.fn();
      timerService.on('timer:stopped', mockListener);

      await timerService.startTimer('task-1');
      const result = await timerService.stopTimer();

      expect(mockListener).toHaveBeenCalledWith(result.session);
    });
  });

  describe('switchTimer', () => {
    it('should switch from one task to another', async () => {
      await timerService.startTimer('task-1');
      jest.advanceTimersByTime(5000);
      
      const result = await timerService.switchTimer('task-2');

      expect(result.success).toBe(true);
      expect(result.session?.taskId).toBe('task-2');
      expect(result.session?.isActive).toBe(true);
    });
  });

  describe('getStatus', () => {
    it('should return IDLE when no timer', () => {
      expect(timerService.getStatus()).toBe(TimerStatus.IDLE);
    });

    it('should return RUNNING when timer is active', async () => {
      await timerService.startTimer('task-1');
      expect(timerService.getStatus()).toBe(TimerStatus.RUNNING);
    });

    it('should return PAUSED when timer is paused', async () => {
      await timerService.startTimer('task-1');
      await timerService.pauseTimer();
      expect(timerService.getStatus()).toBe(TimerStatus.PAUSED);
    });

    it('should return STOPPED when timer is completed', async () => {
      await timerService.startTimer('task-1');
      await timerService.stopTimer();
      expect(timerService.getStatus()).toBe(TimerStatus.STOPPED);
    });
  });

  describe('getCurrentElapsedSeconds', () => {
    it('should return 0 when no timer', () => {
      expect(timerService.getCurrentElapsedSeconds()).toBe(0);
    });

    it('should return elapsed time for active timer', async () => {
      await timerService.startTimer('task-1');
      jest.advanceTimersByTime(5000);
      
      expect(timerService.getCurrentElapsedSeconds()).toBeGreaterThan(0);
    });

    it('should include accumulated time from previous sessions', async () => {
      await timerService.startTimer('task-1');
      jest.advanceTimersByTime(5000);
      await timerService.pauseTimer();
      
      const pausedTime = timerService.getCurrentElapsedSeconds();
      
      await timerService.resumeTimer();
      jest.advanceTimersByTime(3000);
      
      expect(timerService.getCurrentElapsedSeconds()).toBeGreaterThan(pausedTime);
    });
  });

  describe('restoreState', () => {
    it('should restore timer state from saved data', () => {
      const mockSession = {
        id: 'test-session',
        taskId: 'task-1',
        startTime: new Date(),
        durationSeconds: 100,
        isActive: false,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      timerService.restoreState(mockSession, 100);

      expect(timerService.getActiveSession()).toEqual(mockSession);
      expect(timerService.getCurrentElapsedSeconds()).toBe(100);
    });
  });

  describe('event listeners', () => {
    it('should add and remove event listeners', () => {
      const mockListener = jest.fn();
      
      timerService.on('test-event', mockListener);
      timerService.off('test-event', mockListener);
      
      // Manually emit event to test removal
      (timerService as any).emit('test-event', 'data');
      
      expect(mockListener).not.toHaveBeenCalled();
    });
  });
});

describe('TimerValidator', () => {
  describe('validateTaskId', () => {
    it('should validate valid task IDs', () => {
      expect(TimerValidator.validateTaskId('task-1')).toBe(true);
      expect(TimerValidator.validateTaskId('valid-task-id')).toBe(true);
    });

    it('should reject invalid task IDs', () => {
      expect(TimerValidator.validateTaskId('')).toBe(false);
      expect(TimerValidator.validateTaskId(null as any)).toBe(false);
      expect(TimerValidator.validateTaskId(undefined as any)).toBe(false);
    });
  });

  describe('validateSession', () => {
    it('should validate valid timer sessions', () => {
      const validSession = {
        id: 'session-1',
        taskId: 'task-1',
        startTime: new Date(),
        durationSeconds: 100,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      expect(TimerValidator.validateSession(validSession)).toBe(true);
    });

    it('should reject invalid sessions', () => {
      expect(TimerValidator.validateSession(null as any)).toBe(false);
      expect(TimerValidator.validateSession({} as any)).toBe(false);
      expect(TimerValidator.validateSession({
        id: 'session-1',
        taskId: 'task-1',
        startTime: 'invalid-date',
        durationSeconds: 100,
        isActive: true
      } as any)).toBe(false);
    });
  });

  describe('validateDuration', () => {
    it('should validate valid durations', () => {
      expect(TimerValidator.validateDuration(0)).toBe(true);
      expect(TimerValidator.validateDuration(100)).toBe(true);
      expect(TimerValidator.validateDuration(3600)).toBe(true);
    });

    it('should reject invalid durations', () => {
      expect(TimerValidator.validateDuration(-1)).toBe(false);
      expect(TimerValidator.validateDuration('100' as any)).toBe(false);
      expect(TimerValidator.validateDuration(null as any)).toBe(false);
    });
  });
});

describe('TimerCalculator', () => {
  describe('formatDuration', () => {
    it('should format seconds correctly', () => {
      expect(TimerCalculator.formatDuration(30)).toBe('0:30');
      expect(TimerCalculator.formatDuration(90)).toBe('1:30');
      expect(TimerCalculator.formatDuration(3661)).toBe('1:01:01');
    });
  });

  describe('calculateProgress', () => {
    it('should calculate progress percentage', () => {
      expect(TimerCalculator.calculateProgress(30, 60)).toBe(50);
      expect(TimerCalculator.calculateProgress(90, 60)).toBe(100);
      expect(TimerCalculator.calculateProgress(30, 0)).toBe(0);
    });
  });

  describe('isOverEstimate', () => {
    it('should detect when time exceeds estimate', () => {
      expect(TimerCalculator.isOverEstimate(90, 60)).toBe(true);
      expect(TimerCalculator.isOverEstimate(30, 60)).toBe(false);
      expect(TimerCalculator.isOverEstimate(30, 0)).toBe(false);
    });
  });

  describe('calculateRemainingTime', () => {
    it('should calculate remaining time to target', () => {
      expect(TimerCalculator.calculateRemainingTime(1800, 3600)).toBe(1800);
      expect(TimerCalculator.calculateRemainingTime(3600, 3600)).toBe(0);
      expect(TimerCalculator.calculateRemainingTime(4000, 3600)).toBe(0);
    });
  });
});