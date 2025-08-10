import request from 'supertest';
import express from 'express';
import { registerRoutes } from '../routes';
import { storage } from '../storage';

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

describe('Timer API Routes', () => {
  let app: express.Express;

  beforeEach(async () => {
    app = express();
    app.use(express.json());
    await registerRoutes(app);
    jest.clearAllMocks();
  });

  describe('POST /api/timers/start', () => {
    it('should start a timer for a valid task', async () => {
      const taskId = 'task-1';
      const mockTask = { id: taskId, title: 'Test Task' };
      const mockSession = {
        id: 'session-1',
        taskId,
        startTime: new Date(),
        durationSeconds: 0,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockStorage.getTask.mockResolvedValue(mockTask as any);
      mockStorage.getActiveTimerSession.mockResolvedValue(undefined);
      mockStorage.createTimerSession.mockResolvedValue(mockSession as any);

      const response = await request(app)
        .post('/api/timers/start')
        .send({ taskId })
        .expect(201);

      expect(response.body.session).toBeDefined();
      expect(response.body.session.taskId).toBe(taskId);
      expect(mockStorage.createTimerSession).toHaveBeenCalled();
    });

    it('should return 400 if taskId is missing', async () => {
      const response = await request(app)
        .post('/api/timers/start')
        .send({})
        .expect(400);

      expect(response.body.message).toBe('Task ID is required');
    });

    it('should return 404 if task does not exist', async () => {
      const taskId = 'nonexistent-task';
      mockStorage.getTask.mockResolvedValue(undefined);

      const response = await request(app)
        .post('/api/timers/start')
        .send({ taskId })
        .expect(404);

      expect(response.body.message).toBe('Task not found');
    });

    it('should return 409 if another timer is already running', async () => {
      const taskId = 'task-1';
      const mockTask = { id: taskId, title: 'Test Task' };
      const activeSession = {
        id: 'active-session',
        taskId: 'other-task',
        isActive: true,
      };

      mockStorage.getTask.mockResolvedValue(mockTask as any);
      mockStorage.getActiveTimerSession.mockResolvedValue(activeSession as any);

      const response = await request(app)
        .post('/api/timers/start')
        .send({ taskId })
        .expect(409);

      expect(response.body.message).toBe('Another timer is already running');
      expect(response.body.requiresConfirmation).toBe(true);
    });
  });

  describe('POST /api/timers/pause', () => {
    it('should pause an active timer', async () => {
      const activeSession = {
        id: 'session-1',
        taskId: 'task-1',
        startTime: new Date(Date.now() - 60000), // 1 minute ago
        durationSeconds: 0,
        isActive: true,
      };

      const updatedSession = {
        ...activeSession,
        durationSeconds: 60,
        isActive: false,
      };

      mockStorage.getActiveTimerSession.mockResolvedValue(activeSession as any);
      mockStorage.updateTimerSession.mockResolvedValue(updatedSession as any);

      const response = await request(app)
        .post('/api/timers/pause')
        .expect(200);

      expect(response.body.session.isActive).toBe(false);
      expect(response.body.totalElapsedSeconds).toBeGreaterThan(0);
    });

    it('should return 404 if no active timer exists', async () => {
      mockStorage.getActiveTimerSession.mockResolvedValue(undefined);

      const response = await request(app)
        .post('/api/timers/pause')
        .expect(404);

      expect(response.body.message).toBe('No active timer found');
    });
  });

  describe('POST /api/timers/resume', () => {
    it('should resume a paused timer', async () => {
      const sessionId = 'session-1';
      const pausedSession = {
        id: sessionId,
        taskId: 'task-1',
        startTime: new Date(),
        durationSeconds: 60,
        isActive: false,
      };

      const resumedSession = {
        ...pausedSession,
        isActive: true,
      };

      mockStorage.getTimerSession.mockResolvedValue(pausedSession as any);
      mockStorage.getActiveTimerSession.mockResolvedValue(undefined);
      mockStorage.updateTimerSession.mockResolvedValue(resumedSession as any);

      const response = await request(app)
        .post('/api/timers/resume')
        .send({ sessionId })
        .expect(200);

      expect(response.body.session.isActive).toBe(true);
    });

    it('should return 400 if sessionId is missing', async () => {
      const response = await request(app)
        .post('/api/timers/resume')
        .send({})
        .expect(400);

      expect(response.body.message).toBe('Session ID is required');
    });

    it('should return 404 if session does not exist', async () => {
      const sessionId = 'nonexistent-session';
      mockStorage.getTimerSession.mockResolvedValue(undefined);

      const response = await request(app)
        .post('/api/timers/resume')
        .send({ sessionId })
        .expect(404);

      expect(response.body.message).toBe('Timer session not found');
    });
  });

  describe('POST /api/timers/stop', () => {
    it('should stop an active timer', async () => {
      const activeSession = {
        id: 'session-1',
        taskId: 'task-1',
        startTime: new Date(Date.now() - 120000), // 2 minutes ago
        durationSeconds: 60,
        isActive: true,
      };

      const stoppedSession = {
        ...activeSession,
        endTime: new Date(),
        durationSeconds: 180, // 60 + 120 seconds
        isActive: false,
      };

      mockStorage.getActiveTimerSession.mockResolvedValue(activeSession as any);
      mockStorage.updateTimerSession.mockResolvedValue(stoppedSession as any);

      const response = await request(app)
        .post('/api/timers/stop')
        .expect(200);

      expect(response.body.session.isActive).toBe(false);
      expect(response.body.session.endTime).toBeDefined();
    });

    it('should return 404 if no active timer exists', async () => {
      mockStorage.getActiveTimerSession.mockResolvedValue(undefined);

      const response = await request(app)
        .post('/api/timers/stop')
        .expect(404);

      expect(response.body.message).toBe('No active timer found');
    });
  });

  describe('GET /api/timers/active', () => {
    it('should return the current active timer', async () => {
      const activeSession = {
        id: 'session-1',
        taskId: 'task-1',
        isActive: true,
      };

      mockStorage.getActiveTimerSession.mockResolvedValue(activeSession as any);

      const response = await request(app)
        .get('/api/timers/active')
        .expect(200);

      expect(response.body.session).toEqual(activeSession);
    });

    it('should return null if no active timer exists', async () => {
      mockStorage.getActiveTimerSession.mockResolvedValue(undefined);

      const response = await request(app)
        .get('/api/timers/active')
        .expect(200);

      expect(response.body.session).toBeUndefined();
    });
  });

  describe('GET /api/timers/daily', () => {
    it('should return daily time summary', async () => {
      const mockSummary = [
        {
          date: '2023-01-01',
          taskId: 'task-1',
          totalSeconds: 3600,
          sessionCount: 2,
        },
        {
          date: '2023-01-01',
          taskId: 'task-2',
          totalSeconds: 1800,
          sessionCount: 1,
        },
      ];

      mockStorage.getDailySummary.mockResolvedValue(mockSummary as any);

      const response = await request(app)
        .get('/api/timers/daily')
        .expect(200);

      expect(response.body.totalSeconds).toBe(5400); // 3600 + 1800
      expect(response.body.remainingSeconds).toBe(23400); // 8 hours - 5400 seconds
      expect(response.body.taskBreakdown).toEqual(mockSummary);
    });

    it('should accept a specific date parameter', async () => {
      const testDate = '2023-01-15';
      mockStorage.getDailySummary.mockResolvedValue([]);

      await request(app)
        .get(`/api/timers/daily?date=${testDate}`)
        .expect(200);

      expect(mockStorage.getDailySummary).toHaveBeenCalledWith(new Date(testDate));
    });
  });

  describe('GET /api/timers/task/:id', () => {
    it('should return timer data for a specific task', async () => {
      const taskId = 'task-1';
      const mockSessions = [
        {
          id: 'session-1',
          taskId,
          durationSeconds: 1800,
          endTime: new Date(),
        },
        {
          id: 'session-2',
          taskId,
          durationSeconds: 1200,
          endTime: new Date(),
        },
      ];
      const mockEstimate = {
        id: 'estimate-1',
        taskId,
        estimatedDurationMinutes: 60,
      };

      mockStorage.getTimerSessionsByTask.mockResolvedValue(mockSessions as any);
      mockStorage.getTaskEstimate.mockResolvedValue(mockEstimate as any);

      const response = await request(app)
        .get(`/api/timers/task/${taskId}`)
        .expect(200);

      expect(response.body.taskId).toBe(taskId);
      expect(response.body.sessions).toEqual(mockSessions);
      expect(response.body.estimate).toEqual(mockEstimate);
      expect(response.body.totalSeconds).toBe(3000); // 1800 + 1200
    });
  });

  describe('Task Estimate Routes', () => {
    describe('GET /api/tasks/:id/estimate', () => {
      it('should return task estimate', async () => {
        const taskId = 'task-1';
        const mockEstimate = {
          id: 'estimate-1',
          taskId,
          estimatedDurationMinutes: 120,
        };

        mockStorage.getTaskEstimate.mockResolvedValue(mockEstimate as any);

        const response = await request(app)
          .get(`/api/tasks/${taskId}/estimate`)
          .expect(200);

        expect(response.body.estimate).toEqual(mockEstimate);
      });
    });

    describe('PUT /api/tasks/:id/estimate', () => {
      it('should create a new task estimate', async () => {
        const taskId = 'task-1';
        const estimatedDurationMinutes = 90;
        const mockTask = { id: taskId, title: 'Test Task' };
        const mockEstimate = {
          id: 'estimate-1',
          taskId,
          estimatedDurationMinutes,
        };

        mockStorage.getTask.mockResolvedValue(mockTask as any);
        mockStorage.updateTaskEstimate.mockResolvedValue(undefined);
        mockStorage.createTaskEstimate.mockResolvedValue(mockEstimate as any);

        const response = await request(app)
          .put(`/api/tasks/${taskId}/estimate`)
          .send({ estimatedDurationMinutes })
          .expect(200);

        expect(response.body.estimate).toEqual(mockEstimate);
        expect(mockStorage.createTaskEstimate).toHaveBeenCalled();
      });

      it('should update existing task estimate', async () => {
        const taskId = 'task-1';
        const estimatedDurationMinutes = 90;
        const mockTask = { id: taskId, title: 'Test Task' };
        const mockEstimate = {
          id: 'estimate-1',
          taskId,
          estimatedDurationMinutes,
        };

        mockStorage.getTask.mockResolvedValue(mockTask as any);
        mockStorage.updateTaskEstimate.mockResolvedValue(mockEstimate as any);

        const response = await request(app)
          .put(`/api/tasks/${taskId}/estimate`)
          .send({ estimatedDurationMinutes })
          .expect(200);

        expect(response.body.estimate).toEqual(mockEstimate);
        expect(mockStorage.updateTaskEstimate).toHaveBeenCalled();
      });

      it('should return 400 for invalid duration', async () => {
        const taskId = 'task-1';

        const response = await request(app)
          .put(`/api/tasks/${taskId}/estimate`)
          .send({ estimatedDurationMinutes: -10 })
          .expect(400);

        expect(response.body.message).toBe('Valid estimated duration is required');
      });

      it('should return 404 if task does not exist', async () => {
        const taskId = 'nonexistent-task';
        mockStorage.getTask.mockResolvedValue(undefined);

        const response = await request(app)
          .put(`/api/tasks/${taskId}/estimate`)
          .send({ estimatedDurationMinutes: 60 })
          .expect(404);

        expect(response.body.message).toBe('Task not found');
      });
    });

    describe('DELETE /api/tasks/:id/estimate', () => {
      it('should delete task estimate', async () => {
        const taskId = 'task-1';
        mockStorage.deleteTaskEstimate.mockResolvedValue(true);

        await request(app)
          .delete(`/api/tasks/${taskId}/estimate`)
          .expect(204);

        expect(mockStorage.deleteTaskEstimate).toHaveBeenCalledWith(taskId);
      });

      it('should return 404 if estimate does not exist', async () => {
        const taskId = 'task-1';
        mockStorage.deleteTaskEstimate.mockResolvedValue(false);

        const response = await request(app)
          .delete(`/api/tasks/${taskId}/estimate`)
          .expect(404);

        expect(response.body.message).toBe('Task estimate not found');
      });
    });
  });
});