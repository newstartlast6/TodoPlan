import { BackgroundTimerService } from '../background-timer-service';
import { TimerSession } from '@shared/timer-types';

// Mock Worker
class MockWorker {
  private listeners: { [key: string]: Function[] } = {};
  
  constructor(public url: string) {}

  postMessage(data: any) {
    // Simulate async worker response
    setTimeout(() => {
      if (data.type === 'START_TIMER') {
        this.emit('message', {
          data: {
            type: 'TIMER_STARTED',
            payload: {
              sessionId: data.payload.sessionId,
              taskId: data.payload.taskId,
            },
          },
        });
      }
    }, 10);
  }

  addEventListener(event: string, callback: Function) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);

    // Simulate worker ready
    if (event === 'message') {
      setTimeout(() => {
        callback({
          data: {
            type: 'WORKER_READY',
            payload: { timestamp: Date.now() },
          },
        });
      }, 5);
    }
  }

  removeEventListener(event: string, callback: Function) {
    if (this.listeners[event]) {
      const index = this.listeners[event].indexOf(callback);
      if (index > -1) {
        this.listeners[event].splice(index, 1);
      }
    }
  }

  terminate() {
    this.listeners = {};
  }

  private emit(event: string, data: any) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(callback => callback(data));
    }
  }
}

// Mock global Worker
(global as any).Worker = MockWorker;

// Mock document for visibility API
Object.defineProperty(document, 'hidden', {
  writable: true,
  value: false,
});

Object.defineProperty(document, 'addEventListener', {
  value: jest.fn(),
});

describe('BackgroundTimerService', () => {
  let service: BackgroundTimerService;
  let mockSession: TimerSession;

  beforeEach(() => {
    service = new BackgroundTimerService();
    mockSession = {
      id: 'session-1',
      taskId: 'task-1',
      startTime: new Date(),
      durationSeconds: 300,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  });

  afterEach(() => {
    service.destroy();
  });

  it('should initialize with Web Worker support', () => {
    expect(service.isSupported()).toBe(true);
  });

  it('should start timer and emit events', (done) => {
    service.on('TIMER_STARTED', (data) => {
      expect(data.sessionId).toBe('session-1');
      expect(data.taskId).toBe('task-1');
      done();
    });

    // Wait for worker to be ready
    setTimeout(() => {
      service.startTimer(mockSession);
    }, 20);
  });

  it('should handle worker ready state', (done) => {
    setTimeout(() => {
      expect(service.isReady()).toBe(true);
      done();
    }, 20);
  });

  it('should queue messages when worker is not ready', () => {
    const newService = new BackgroundTimerService();
    
    // Try to start timer immediately (before worker is ready)
    newService.startTimer(mockSession);
    
    // Should not throw error
    expect(() => newService.startTimer(mockSession)).not.toThrow();
    
    newService.destroy();
  });

  it('should handle pause timer', () => {
    expect(() => service.pauseTimer()).not.toThrow();
  });

  it('should handle resume timer', () => {
    expect(() => service.resumeTimer()).not.toThrow();
  });

  it('should handle stop timer', () => {
    expect(() => service.stopTimer()).not.toThrow();
  });

  it('should handle get state', () => {
    expect(() => service.getState()).not.toThrow();
  });

  it('should handle sync state', () => {
    expect(() => service.syncState(mockSession)).not.toThrow();
    expect(() => service.syncState(null)).not.toThrow();
  });

  it('should handle ping', () => {
    expect(() => service.ping()).not.toThrow();
  });

  it('should add and remove event listeners', () => {
    const callback = jest.fn();
    
    service.on('test-event', callback);
    service.off('test-event', callback);
    
    // Manually emit event to test removal
    (service as any).emit('test-event', 'data');
    
    expect(callback).not.toHaveBeenCalled();
  });

  it('should handle visibility changes', () => {
    const callback = jest.fn();
    service.on('visibilityChange', callback);
    
    // Simulate visibility change
    (service as any).handleVisibilityChange(true);
    
    expect(callback).toHaveBeenCalledWith({ isVisible: true });
  });

  it('should cleanup resources on destroy', () => {
    const mockTerminate = jest.fn();
    (service as any).worker = { terminate: mockTerminate };
    
    service.destroy();
    
    expect(mockTerminate).toHaveBeenCalled();
  });
});

describe('BackgroundTimerService Fallback', () => {
  let service: BackgroundTimerService;
  let mockSession: TimerSession;

  beforeEach(() => {
    // Mock Worker to be undefined to test fallback
    (global as any).Worker = undefined;
    
    service = new BackgroundTimerService();
    mockSession = {
      id: 'session-1',
      taskId: 'task-1',
      startTime: new Date(),
      durationSeconds: 300,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  });

  afterEach(() => {
    service.destroy();
    // Restore Worker
    (global as any).Worker = MockWorker;
  });

  it('should initialize without Web Worker support', () => {
    expect(service.isSupported()).toBe(false);
    expect(service.isReady()).toBe(true);
  });

  it('should handle fallback timer start', (done) => {
    service.on('TIMER_STARTED', (data) => {
      expect(data.sessionId).toBe('session-1');
      expect(data.taskId).toBe('task-1');
      done();
    });

    service.startTimer(mockSession);
  });

  it('should handle fallback timer tick', (done) => {
    service.on('TIMER_TICK', (data) => {
      expect(data.sessionId).toBe('session-1');
      expect(data.taskId).toBe('task-1');
      expect(data.totalSeconds).toBeGreaterThan(0);
      done();
    });

    service.startTimer(mockSession);
  });

  it('should handle fallback timer pause', (done) => {
    service.on('TIMER_PAUSED', (data) => {
      expect(data.sessionId).toBe('session-1');
      expect(data.taskId).toBe('task-1');
      done();
    });

    service.startTimer(mockSession);
    
    setTimeout(() => {
      service.pauseTimer();
    }, 100);
  });

  it('should handle fallback timer resume', (done) => {
    service.on('TIMER_RESUMED', (data) => {
      expect(data.sessionId).toBe('session-1');
      expect(data.taskId).toBe('task-1');
      done();
    });

    service.startTimer(mockSession);
    service.pauseTimer();
    
    setTimeout(() => {
      service.resumeTimer();
    }, 50);
  });

  it('should handle fallback timer stop', (done) => {
    service.on('TIMER_STOPPED', (data) => {
      expect(data.sessionId).toBe('session-1');
      expect(data.taskId).toBe('task-1');
      expect(data.totalSeconds).toBeGreaterThan(0);
      done();
    });

    service.startTimer(mockSession);
    
    setTimeout(() => {
      service.stopTimer();
    }, 100);
  });
});