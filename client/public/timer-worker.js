/**
 * Web Worker for background timer processing
 * Handles timer ticking and state management when the main thread is busy or tab is inactive
 */

let timerState = {
  isActive: false,
  taskId: null,
  startTime: null,
  accumulatedSeconds: 0,
  sessionId: null,
};

let tickInterval = null;
const TICK_INTERVAL = 1000; // 1 second
let lastPerfNow = null;

/**
 * Start the background timer
 */
function startTimer(data) {
  timerState = {
    isActive: true,
    taskId: data.taskId,
    startTime: Date.now(),
    accumulatedSeconds: data.accumulatedSeconds || 0,
    sessionId: data.sessionId,
  };

  // Clear any existing interval
  if (tickInterval) {
    clearInterval(tickInterval);
  }

  // Start ticking using performance.now() for smoother cadence
  lastPerfNow = (typeof performance !== 'undefined' && performance.now) ? performance.now() : null;
  tickInterval = setInterval(() => {
    if (!timerState.isActive) return;
    const currentTime = Date.now();
    // We still emit a 1Hz tick; store will do +1s accumulation to avoid drift
    const elapsedSeconds = Math.floor((currentTime - timerState.startTime) / 1000);
    const totalSeconds = timerState.accumulatedSeconds + elapsedSeconds;
    self.postMessage({
      type: 'TIMER_TICK',
      payload: {
        sessionId: timerState.sessionId,
        taskId: timerState.taskId,
        totalSeconds,
        elapsedSeconds,
        timestamp: currentTime,
      },
    });
  }, TICK_INTERVAL);

  self.postMessage({
    type: 'TIMER_STARTED',
    payload: {
      sessionId: timerState.sessionId,
      taskId: timerState.taskId,
    },
  });
}

/**
 * Pause the background timer
 */
function pauseTimer() {
  if (timerState.isActive) {
    const currentTime = Date.now();
    const elapsedSeconds = Math.floor((currentTime - timerState.startTime) / 1000);
    timerState.accumulatedSeconds += elapsedSeconds;
    timerState.isActive = false;

    if (tickInterval) {
      clearInterval(tickInterval);
      tickInterval = null;
    }

    self.postMessage({
      type: 'TIMER_PAUSED',
      payload: {
        sessionId: timerState.sessionId,
        taskId: timerState.taskId,
        totalSeconds: timerState.accumulatedSeconds,
        timestamp: currentTime,
      },
    });
  }
}

/**
 * Resume the background timer
 */
function resumeTimer() {
  if (!timerState.isActive && timerState.taskId) {
    timerState.isActive = true;
    timerState.startTime = Date.now();

    // Restart ticking
    if (tickInterval) {
      clearInterval(tickInterval);
    }
    lastPerfNow = (typeof performance !== 'undefined' && performance.now) ? performance.now() : null;
    tickInterval = setInterval(() => {
      if (!timerState.isActive) return;
      const currentTime = Date.now();
      const elapsedSeconds = Math.floor((currentTime - timerState.startTime) / 1000);
      const totalSeconds = timerState.accumulatedSeconds + elapsedSeconds;
      self.postMessage({
        type: 'TIMER_TICK',
        payload: {
          sessionId: timerState.sessionId,
          taskId: timerState.taskId,
          totalSeconds,
          elapsedSeconds,
          timestamp: currentTime,
        },
      });
    }, TICK_INTERVAL);

    self.postMessage({
      type: 'TIMER_RESUMED',
      payload: {
        sessionId: timerState.sessionId,
        taskId: timerState.taskId,
      },
    });
  }
}

/**
 * Stop the background timer
 */
function stopTimer() {
  const currentTime = Date.now();
  let totalSeconds = timerState.accumulatedSeconds;

  if (timerState.isActive) {
    const elapsedSeconds = Math.floor((currentTime - timerState.startTime) / 1000);
    totalSeconds += elapsedSeconds;
  }

  if (tickInterval) {
    clearInterval(tickInterval);
    tickInterval = null;
  }

  const finalState = {
    sessionId: timerState.sessionId,
    taskId: timerState.taskId,
    totalSeconds,
    timestamp: currentTime,
  };

  // Reset timer state
  timerState = {
    isActive: false,
    taskId: null,
    startTime: null,
    accumulatedSeconds: 0,
    sessionId: null,
  };

  self.postMessage({
    type: 'TIMER_STOPPED',
    payload: finalState,
  });
}

/**
 * Get current timer state
 */
function getTimerState() {
  let totalSeconds = timerState.accumulatedSeconds;

  if (timerState.isActive && timerState.startTime) {
    const elapsedSeconds = Math.floor((Date.now() - timerState.startTime) / 1000);
    totalSeconds += elapsedSeconds;
  }

  self.postMessage({
    type: 'TIMER_STATE',
    payload: {
      isActive: timerState.isActive,
      taskId: timerState.taskId,
      sessionId: timerState.sessionId,
      totalSeconds,
      timestamp: Date.now(),
    },
  });
}

/**
 * Handle visibility change (tab becomes active/inactive)
 */
function handleVisibilityChange(isVisible) {
  self.postMessage({
    type: 'VISIBILITY_CHANGED',
    payload: {
      isVisible,
      timestamp: Date.now(),
      timerState: {
        isActive: timerState.isActive,
        taskId: timerState.taskId,
        sessionId: timerState.sessionId,
      },
    },
  });

  // If tab becomes visible and timer is active, send current state
  if (isVisible && timerState.isActive) {
    getTimerState();
  }
}

/**
 * Sync timer state with provided data
 */
function syncTimerState(data) {
  const wasActive = timerState.isActive;
  
  timerState = {
    isActive: data.isActive,
    taskId: data.taskId,
    startTime: data.isActive ? Date.now() : null,
    accumulatedSeconds: data.accumulatedSeconds || 0,
    sessionId: data.sessionId,
  };

  // Handle interval based on new state
  if (timerState.isActive && !wasActive) {
    startTimer(timerState);
  } else if (!timerState.isActive && wasActive) {
    if (tickInterval) {
      clearInterval(tickInterval);
      tickInterval = null;
    }
  }

  self.postMessage({
    type: 'TIMER_SYNCED',
    payload: {
      sessionId: timerState.sessionId,
      taskId: timerState.taskId,
      isActive: timerState.isActive,
    },
  });
}

// Message handler
self.addEventListener('message', (event) => {
  const { type, payload } = event.data;

  try {
    switch (type) {
      case 'START_TIMER':
        startTimer(payload);
        break;

      case 'PAUSE_TIMER':
        pauseTimer();
        break;

      case 'RESUME_TIMER':
        resumeTimer();
        break;

      case 'STOP_TIMER':
        stopTimer();
        break;

      case 'GET_STATE':
        getTimerState();
        break;

      case 'VISIBILITY_CHANGE':
        handleVisibilityChange(payload.isVisible);
        break;

      case 'SYNC_STATE':
        syncTimerState(payload);
        break;

      case 'PING':
        self.postMessage({
          type: 'PONG',
          payload: {
            timestamp: Date.now(),
            timerActive: timerState.isActive,
          },
        });
        break;

      default:
        console.warn('Unknown message type:', type);
    }
  } catch (error) {
    self.postMessage({
      type: 'ERROR',
      payload: {
        message: error.message,
        type: type,
        timestamp: Date.now(),
      },
    });
  }
});

// Handle worker errors
self.addEventListener('error', (error) => {
  self.postMessage({
    type: 'WORKER_ERROR',
    payload: {
      message: error.message,
      filename: error.filename,
      lineno: error.lineno,
      timestamp: Date.now(),
    },
  });
});

// Send ready signal
self.postMessage({
  type: 'WORKER_READY',
  payload: {
    timestamp: Date.now(),
  },
});