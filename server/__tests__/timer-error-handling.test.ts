import request from 'supertest';
import express from 'express';
import { registerRoutes } from '../routes';
import { storage } from '../storage';
import { 
  TimerError, 
  TimerValidationError, 
  TimerStateError, 
  TimerSyncError,
  TimerPersistenceError,
  TIMER_ERROR_CODES 
} from '@shared/services/timer-errors';

// Mock the storage
jest.mock('../storage', () => ({
  storage: {
    getTask: jest.fn(),
    getActiveTimerSession: jest.fn(),
    createTimerSession: jest.fn(),
    updateTimerSession: jest.fn(),
    getTimerSession: jest.fn(),
    getDailySummary: jest.fn(),
    getTimerSessionsByTask: jest.fn(),
    getTaskEstimate: jest.fn(),
    updateTaskEstimate: jest.fn(),
    createTaskEstimate: jest.fn(),
    deleteTaskEstimate: jest.fn(),
  },
}));

const mockStorage = storage as jest.Mocked<typeof storage>;

describe('Timer Error Handling', () => {
  let app: express.Express;

  beforeEach(async () => {
    app = express();
    app.use(express.json());
    await registerRoutes(app);
    jest.clearAllMocks();
  });

  describe('Validation Errors', () => {
    it('should handle missing taskId in start timer', async () => {
      const response = await request(app)
        .post('/api/timers/start')
        .send({})
        .expect(400);

      expect(response.body.error).toBe('VALIDATION_ERROR');
      expect(response.body.code).toBeDefined();
      expect(response.body.message).toContain('Task ID is required');
    });

    it('should handle invalid taskId type in start timer', async () => {
      const response = await request(app)
        .post('/api/timers/start')
        .send({ taskId: 123 })
        .expect(400);

      expect(response.body.error).toBe('VALIDATION_ERROR');
      expect(response.body.message).toContain('must be a valid string');
    });

    it('should handle nonexistent task in start timer', async () => {
      mockStorage.getTask.mockResolvedValue(undefined);

      const response = await request(app)
        .post('/api/timers/start')
        .send({ taskId: 'nonexistent-task' })
        .expect(400);

      expect(response.body.error).toBe('VALIDATION_ERROR');
      expect(response.body.message).toBe('Task not found');
      expect(response.body.details.code).toBe(TIMER_ERROR_CODES.INVALID_TASK_ID);
    });

    it('should handle missing sessionId in resume timer', async () => {
      const response = await request(app)
        .post('/api/timers/resume')
        .send({})
        .expect(400);

      expect(response.body.error).toBe('VALIDATION_ERROR');
      expect(response.body.message).toContain('Session ID is required');
    });

    it('should handle invalid sessionId type in resume timer', async () => {
      const response = await request(app)
        .post('/api/timers/resume')
        .send({ sessionId: 123 })
        .expect(400);

      expect(response.body.error).toBe('VALIDATION_ERROR');
      expect(response.body.message).toContain('must be a valid string');
    });
  });

  describe('State Errors', () => {
    it('should handle timer already active error', async () => {
      const mockTask = { id: 'task-1', title: 'Test Task' };
      const activeSession = {
        id: 'active-session',
        taskId: 'other-task',
        isActive: true,
      };

      mockStorage.getTask.mockResolvedValue(mockTask as any);
      mockStorage.getActiveTimerSession.mockResolvedValue(activeSession as any);

      const response = await request(app)
        .post('/api/timers/start')
        .send({ taskId: 'task-1' })
        .expect(409);

      expect(response.body.error).toBe('STATE_ERROR');
      expect(response.body.code).toBeDefined();
      expect(response.body.details.requiresConfirmation).toBe(true);
      expect(response.body.details.activeTaskId).toBe('other-task');
    });

    it('should handle no active timer error in pause', async () => {
      mockStorage.getActiveTimerSession.mockResolvedValue(undefined);

      const response = await request(app)
        .post('/api/timers/pause')
        .expect(409);

      expect(response.body.error).toBe('STATE_ERROR');
      expect(response.body.code).toBe(TIMER_ERROR_CODES.NO_ACTIVE_TIMER);
      expect(response.body.message).toContain('No active timer found');
    });

    it('should handle timer not active error in pause', async () => {
      const inactiveSession = {
        id: 'session-1',
        taskId: 'task-1',
        isActive: false,
        startTime: new Date(),
        durationSeconds: 60,
      };

      mockStorage.getActiveTimerSession.mockResolvedValue(inactiveSession as any);

      const response = await request(app)
        .post('/api/timers/pause')
        .expect(409);

      expect(response.body.error).toBe('STATE_ERROR');
      expect(response.body.code).toBe(TIMER_ERROR_CODES.TIMER_NOT_PAUSED);
    });

    it('should handle no active timer error in stop', async () => {
      mockStorage.getActiveTimerSession.mockResolvedValue(undefined);

      const response = await request(app)
        .post('/api/timers/stop')
        .expect(409);

      expect(response.body.error).toBe('STATE_ERROR');
      expect(response.body.code).toBe(TIMER_ERROR_CODES.NO_ACTIVE_TIMER);
    });

    it('should handle timer already stopped error in resume', async () => {
      const completedSession = {
        id: 'session-1',
        taskId: 'task-1',
        isActive: false,
        endTime: new Date(),
        durationSeconds: 3600,
      };

      mockStorage.getTimerSession.mockResolvedValue(completedSession as any);

      const response = await request(app)
        .post('/api/timers/resume')
        .send({ sessionId: 'session-1' })
        .expect(409);

      expect(response.body.error).toBe('STATE_ERROR');
      expect(response.body.code).toBe(TIMER_ERROR_CODES.TIMER_ALREADY_STOPPED);
    });
  });

  describe('Persistence Errors', () => {
    it('should handle storage failure in timer creation', async () => {
      const mockTask = { id: 'task-1', title: 'Test Task' };
      
      mockStorage.getTask.mockResolvedValue(mockTask as any);
      mockStorage.getActiveTimerSession.mockResolvedValue(undefined);
      mockStorage.createTimerSession.mockRejectedValue(new Error('Database connection failed'));

      const response = await request(app)
        .post('/api/timers/start')
        .send({ taskId: 'task-1' })
        .expect(500);

      expect(response.body.error).toBe('INTERNAL_SERVER_ERROR');
      expect(response.body.retryable).toBe(true);
    });

    it('should handle storage failure in timer update', async () => {
      const activeSession = {
        id: 'session-1',
        taskId: 'task-1',
        startTime: new Date(Date.now() - 60000),
        durationSeconds: 0,
        isActive: true,
      };

      mockStorage.getActiveTimerSession.mockResolvedValue(activeSession as any);
      mockStorage.updateTimerSession.mockResolvedValue(undefined); // Simulate update failure

      const response = await request(app)
        .post('/api/timers/pause')
        .expect(503);

      expect(response.body.error).toBe('PERSISTENCE_ERROR');
      expect(response.body.retryable).toBe(true);
    });
  });

  describe('Sync Errors', () => {
    it('should handle invalid events array in sync', async () => {
      const response = await request(app)
        .post('/api/timers/sync')
        .send({ events: 'not-an-array' })
        .expect(400);

      expect(response.body.error).toBe('VALIDATION_ERROR');
      expect(response.body.message).toContain('Events array is required');
    });

    it('should handle empty events array in sync', async () => {
      const response = await request(app)
        .post('/api/timers/sync')
        .send({ events: [] })
        .expect(200);

      expect(response.body.syncedEventIds).toEqual([]);
      expect(response.body.message).toContain('No events to sync');
    });

    it('should handle invalid event structure in sync', async () => {
      const invalidEvent = { id: 'event-1' }; // Missing type and timestamp

      const response = await request(app)
        .post('/api/timers/sync')
        .send({ events: [invalidEvent] })
        .expect(200);

      expect(response.body.syncedEventIds).toEqual([]);
      expect(response.body.failedEvents).toHaveLength(1);
      expect(response.body.failedEvents[0].eventId).toBe('event-1');
      expect(response.body.failedEvents[0].error).toContain('Invalid event structure');
    });

    it('should detect conflicts in sync events', async () => {
      const activeSession = {
        id: 'active-session',
        taskId: 'task-1',
        isActive: true,
      };

      mockStorage.getActiveTimerSession.mockResolvedValue(activeSession as any);

      const conflictingEvent = {
        id: 'event-1',
        type: 'start',
        taskId: 'task-2',
        timestamp: new Date().toISOString(),
      };

      const response = await request(app)
        .post('/api/timers/sync')
        .send({ events: [conflictingEvent] })
        .expect(200);

      expect(response.body.conflicts).toHaveLength(1);
      expect(response.body.conflicts[0].eventId).toBe('event-1');
      expect(response.body.conflicts[0].reason).toContain('Another timer is active');
    });

    it('should handle unknown event type in sync', async () => {
      const unknownEvent = {
        id: 'event-1',
        type: 'unknown-type',
        taskId: 'task-1',
        timestamp: new Date().toISOString(),
      };

      const response = await request(app)
        .post('/api/timers/sync')
        .send({ events: [unknownEvent] })
        .expect(200);

      expect(response.body.failedEvents).toHaveLength(1);
      expect(response.body.failedEvents[0].error).toContain('Unknown event type');
    });
  });

  describe('Data Validation Errors', () => {
    it('should handle invalid duration calculation in pause', async () => {
      const activeSession = {
        id: 'session-1',
        taskId: 'task-1',
        startTime: new Date(Date.now() + 60000), // Future start time
        durationSeconds: 0,
        isActive: true,
      };

      mockStorage.getActiveTimerSession.mockResolvedValue(activeSession as any);

      const response = await request(app)
        .post('/api/timers/pause')
        .expect(400);

      expect(response.body.error).toBe('VALIDATION_ERROR');
      expect(response.body.message).toContain('start time is in the future');
    });

    it('should handle negative duration calculation', async () => {
      const activeSession = {
        id: 'session-1',
        taskId: 'task-1',
        startTime: new Date(Date.now() - 60000),
        durationSeconds: -100, // Invalid negative duration
        isActive: true,
      };

      mockStorage.getActiveTimerSession.mockResolvedValue(activeSession as any);

      const response = await request(app)
        .post('/api/timers/pause')
        .expect(400);

      expect(response.body.error).toBe('VALIDATION_ERROR');
      expect(response.body.message).toContain('Invalid duration calculation');
    });
  });

  describe('Error Response Format', () => {
    it('should return consistent error format for validation errors', async () => {
      const response = await request(app)
        .post('/api/timers/start')
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('code');
      expect(response.body).toHaveProperty('details');
      expect(typeof response.body.error).toBe('string');
      expect(typeof response.body.message).toBe('string');
      expect(typeof response.body.code).toBe('string');
    });

    it('should return consistent error format for state errors', async () => {
      mockStorage.getActiveTimerSession.mockResolvedValue(undefined);

      const response = await request(app)
        .post('/api/timers/pause')
        .expect(409);

      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('code');
      expect(response.body).toHaveProperty('details');
      expect(response.body.error).toBe('STATE_ERROR');
    });

    it('should include retryable flag for appropriate errors', async () => {
      mockStorage.getActiveTimerSession.mockRejectedValue(new Error('Network error'));

      const response = await request(app)
        .post('/api/timers/pause')
        .expect(500);

      expect(response.body).toHaveProperty('retryable');
      expect(response.body.retryable).toBe(true);
    });
  });

  describe('Logging and Monitoring', () => {
    let consoleSpy: jest.SpyInstance;

    beforeEach(() => {
      consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    });

    afterEach(() => {
      consoleSpy.mockRestore();
    });

    it('should log errors with context information', async () => {
      mockStorage.getActiveTimerSession.mockRejectedValue(new Error('Test error'));

      await request(app)
        .post('/api/timers/pause')
        .expect(500);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Timer operation failed: pause_timer'),
        expect.objectContaining({
          error: expect.any(Error),
          url: '/api/timers/pause',
          method: 'POST',
          timestamp: expect.any(String),
        })
      );
    });

    it('should log successful operations', async () => {
      const logSpy = jest.spyOn(console, 'log').mockImplementation();
      
      const mockTask = { id: 'task-1', title: 'Test Task' };
      const mockSession = {
        id: 'session-1',
        taskId: 'task-1',
        startTime: new Date(),
        durationSeconds: 0,
        isActive: true,
      };

      mockStorage.getTask.mockResolvedValue(mockTask as any);
      mockStorage.getActiveTimerSession.mockResolvedValue(undefined);
      mockStorage.createTimerSession.mockResolvedValue(mockSession as any);

      await request(app)
        .post('/api/timers/start')
        .send({ taskId: 'task-1' })
        .expect(201);

      expect(logSpy).toHaveBeenCalledWith(
        'Timer started successfully',
        expect.objectContaining({
          sessionId: 'session-1',
          taskId: 'task-1',
          timestamp: expect.any(String),
        })
      );

      logSpy.mockRestore();
    });
  });
});