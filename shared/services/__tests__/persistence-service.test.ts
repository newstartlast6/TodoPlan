import { PersistenceService, TimerRecoveryManager } from '../persistence-service';
import { TimerEvent, TimerSession } from '../../timer-types';
import { TimerPersistenceError } from '../timer-errors';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: jest.fn((key: string) => store[key] || null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Mock navigator.onLine
Object.defineProperty(navigator, 'onLine', {
  writable: true,
  value: true,
});

describe('PersistenceService', () => {
  let persistenceService: PersistenceService;
  let mockErrorHandler: jest.Mock;

  beforeEach(() => {
    localStorageMock.clear();
    mockErrorHandler = jest.fn();
    persistenceService = new PersistenceService(undefined, mockErrorHandler);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('saveActiveSession', () => {
    it('should save active session to localStorage', async () => {
      const session: TimerSession = {
        id: 'session-1',
        taskId: 'task-1',
        startTime: new Date('2023-01-01T10:00:00Z'),
        durationSeconds: 300,
        isActive: true,
        createdAt: new Date('2023-01-01T10:00:00Z'),
        updatedAt: new Date('2023-01-01T10:05:00Z'),
      };

      await persistenceService.saveActiveSession(session);

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'timer_active_session',
        expect.stringContaining('task-1')
      );
    });

    it('should remove session from localStorage when null', async () => {
      await persistenceService.saveActiveSession(null);

      expect(localStorageMock.removeItem).toHaveBeenCalledWith('timer_active_session');
    });

    it('should handle storage errors', async () => {
      localStorageMock.setItem.mockImplementation(() => {
        throw new DOMException('Storage quota exceeded', 'QuotaExceededError');
      });

      const session: TimerSession = {
        id: 'session-1',
        taskId: 'task-1',
        startTime: new Date(),
        durationSeconds: 300,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await expect(persistenceService.saveActiveSession(session)).rejects.toThrow(TimerPersistenceError);
      expect(mockErrorHandler).toHaveBeenCalled();
    });
  });

  describe('loadActiveSession', () => {
    it('should load active session from localStorage', async () => {
      const sessionData = {
        taskId: 'task-1',
        startTime: new Date('2023-01-01T10:00:00Z').toISOString(),
        accumulatedSeconds: 300,
        isActive: false,
        sessionId: 'session-1',
      };

      localStorageMock.getItem.mockReturnValue(JSON.stringify(sessionData));

      const result = await persistenceService.loadActiveSession();

      expect(result.session).toBeDefined();
      expect(result.session?.taskId).toBe('task-1');
      expect(result.accumulatedSeconds).toBe(300);
    });

    it('should calculate elapsed time for active sessions', async () => {
      const startTime = new Date(Date.now() - 10000); // 10 seconds ago
      const sessionData = {
        taskId: 'task-1',
        startTime: startTime.toISOString(),
        accumulatedSeconds: 300,
        isActive: true,
        sessionId: 'session-1',
      };

      localStorageMock.getItem.mockReturnValue(JSON.stringify(sessionData));

      const result = await persistenceService.loadActiveSession();

      expect(result.accumulatedSeconds).toBeGreaterThan(300);
    });

    it('should return null when no session exists', async () => {
      localStorageMock.getItem.mockReturnValue(null);

      const result = await persistenceService.loadActiveSession();

      expect(result.session).toBeNull();
      expect(result.accumulatedSeconds).toBe(0);
    });

    it('should handle corrupted data gracefully', async () => {
      localStorageMock.getItem.mockReturnValue('invalid-json');

      const result = await persistenceService.loadActiveSession();

      expect(result.session).toBeNull();
      expect(result.accumulatedSeconds).toBe(0);
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('timer_active_session');
    });
  });

  describe('queueEvent', () => {
    it('should queue timer events', async () => {
      const event: TimerEvent = {
        id: 'event-1',
        type: 'start',
        taskId: 'task-1',
        timestamp: new Date().toISOString(),
        synced: false,
      };

      await persistenceService.queueEvent(event);

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'timer_pending_events',
        expect.stringContaining('event-1')
      );
    });

    it('should handle storage errors when queuing events', async () => {
      localStorageMock.setItem.mockImplementation(() => {
        throw new Error('Storage error');
      });

      const event: TimerEvent = {
        id: 'event-1',
        type: 'start',
        taskId: 'task-1',
        timestamp: new Date().toISOString(),
        synced: false,
      };

      await expect(persistenceService.queueEvent(event)).rejects.toThrow(TimerPersistenceError);
    });
  });

  describe('markEventsSynced', () => {
    it('should remove synced events from queue', async () => {
      const events: TimerEvent[] = [
        {
          id: 'event-1',
          type: 'start',
          taskId: 'task-1',
          timestamp: new Date().toISOString(),
          synced: false,
        },
        {
          id: 'event-2',
          type: 'stop',
          taskId: 'task-1',
          timestamp: new Date().toISOString(),
          synced: false,
        },
      ];

      // Queue events first
      for (const event of events) {
        await persistenceService.queueEvent(event);
      }

      // Mark first event as synced
      await persistenceService.markEventsSynced(['event-1']);

      const pendingEvents = persistenceService.getPendingEvents();
      expect(pendingEvents).toHaveLength(1);
      expect(pendingEvents[0].id).toBe('event-2');
    });
  });

  describe('cacheDailySummary', () => {
    it('should cache daily summary data', async () => {
      const summaryData = { totalSeconds: 3600, taskCount: 3 };

      await persistenceService.cacheDailySummary('2023-01-01', summaryData);

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'timer_daily_cache',
        expect.stringContaining('totalSeconds')
      );
    });

    it('should clean up old cache entries', async () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 10);
      
      // Set up old cache data
      const oldCache = {
        [oldDate.toISOString().split('T')[0]]: {
          data: { totalSeconds: 1800 },
          timestamp: oldDate.toISOString(),
        },
      };
      
      localStorageMock.getItem.mockReturnValue(JSON.stringify(oldCache));

      await persistenceService.cacheDailySummary('2023-01-01', { totalSeconds: 3600 });

      // Verify old entries are removed
      const setItemCalls = localStorageMock.setItem.mock.calls;
      const lastCall = setItemCalls[setItemCalls.length - 1];
      const cacheData = JSON.parse(lastCall[1]);
      
      expect(Object.keys(cacheData)).not.toContain(oldDate.toISOString().split('T')[0]);
    });
  });

  describe('getCachedDailySummary', () => {
    it('should return cached data if fresh', () => {
      const cacheData = {
        '2023-01-01': {
          data: { totalSeconds: 3600 },
          timestamp: new Date().toISOString(),
        },
      };

      localStorageMock.getItem.mockReturnValue(JSON.stringify(cacheData));

      const result = persistenceService.getCachedDailySummary('2023-01-01');

      expect(result).toEqual({ totalSeconds: 3600 });
    });

    it('should return null for stale cache', () => {
      const oldTimestamp = new Date(Date.now() - 10 * 60 * 1000); // 10 minutes ago
      const cacheData = {
        '2023-01-01': {
          data: { totalSeconds: 3600 },
          timestamp: oldTimestamp.toISOString(),
        },
      };

      localStorageMock.getItem.mockReturnValue(JSON.stringify(cacheData));

      const result = persistenceService.getCachedDailySummary('2023-01-01');

      expect(result).toBeNull();
    });
  });

  describe('getStorageStats', () => {
    it('should return storage usage statistics', () => {
      localStorageMock.getItem.mockImplementation((key) => {
        if (key === 'timer_active_session') return '{"taskId":"task-1"}';
        if (key === 'timer_pending_events') return '[]';
        return null;
      });

      const stats = persistenceService.getStorageStats();

      expect(stats.used).toBeGreaterThan(0);
      expect(stats.available).toBeGreaterThan(0);
      expect(stats.percentage).toBeGreaterThan(0);
    });
  });

  describe('needsRecovery', () => {
    it('should return true when active session exists', () => {
      const sessionData = {
        taskId: 'task-1',
        isActive: true,
      };

      localStorageMock.getItem.mockReturnValue(JSON.stringify(sessionData));

      expect(persistenceService.needsRecovery()).toBe(true);
    });

    it('should return false when no active session', () => {
      localStorageMock.getItem.mockReturnValue(null);

      expect(persistenceService.needsRecovery()).toBe(false);
    });
  });
});

describe('TimerRecoveryManager', () => {
  let persistenceService: PersistenceService;
  let recoveryManager: TimerRecoveryManager;

  beforeEach(() => {
    localStorageMock.clear();
    persistenceService = new PersistenceService();
    recoveryManager = new TimerRecoveryManager(persistenceService);
  });

  describe('checkRecovery', () => {
    it('should detect when recovery is needed', async () => {
      const sessionData = {
        taskId: 'task-1',
        startTime: new Date(Date.now() - 600000).toISOString(), // 10 minutes ago
        accumulatedSeconds: 300,
        isActive: true,
      };

      localStorageMock.getItem.mockReturnValue(JSON.stringify(sessionData));

      const result = await recoveryManager.checkRecovery();

      expect(result.needsRecovery).toBe(true);
      expect(result.recoveryData?.shouldPromptUser).toBe(true);
    });

    it('should not prompt for short sessions', async () => {
      const sessionData = {
        taskId: 'task-1',
        startTime: new Date(Date.now() - 60000).toISOString(), // 1 minute ago
        accumulatedSeconds: 0,
        isActive: true,
      };

      localStorageMock.getItem.mockReturnValue(JSON.stringify(sessionData));

      const result = await recoveryManager.checkRecovery();

      expect(result.needsRecovery).toBe(true);
      expect(result.recoveryData?.shouldPromptUser).toBe(false);
    });
  });

  describe('performRecovery', () => {
    it('should recover session when confirmed', async () => {
      const sessionData = {
        taskId: 'task-1',
        startTime: new Date().toISOString(),
        accumulatedSeconds: 300,
        isActive: true,
        sessionId: 'session-1',
      };

      localStorageMock.getItem.mockReturnValue(JSON.stringify(sessionData));

      const result = await recoveryManager.performRecovery(true);

      expect(result.session).toBeDefined();
      expect(result.session?.taskId).toBe('task-1');
    });

    it('should clear session when declined', async () => {
      const result = await recoveryManager.performRecovery(false);

      expect(result.session).toBeNull();
      expect(result.accumulatedSeconds).toBe(0);
    });
  });
});