import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { 
  insertTaskSchema, updateTaskSchema,
  insertTimerSessionSchema, updateTimerSessionSchema,
  insertTaskEstimateSchema, updateTaskEstimateSchema,
  goalTypeEnum
} from "@shared/schema";
import { z } from "zod";
import { 
  TimerError, 
  TimerValidationError, 
  TimerStateError, 
  TimerSyncError,
  TimerPersistenceError,
  TIMER_ERROR_CODES,
  TimerErrorHandler 
} from "@shared/services/timer-errors";

// Enhanced error handling middleware
function handleTimerError(error: unknown, req: any, res: any, operation: string) {
  console.error(`Timer operation failed: ${operation}`, {
    error,
    url: req.url,
    method: req.method,
    body: req.body,
    timestamp: new Date().toISOString(),
  });

  if (error instanceof TimerValidationError) {
    return res.status(400).json({
      error: 'VALIDATION_ERROR',
      message: error.message,
      code: error.code,
      details: error.details,
    });
  }

  if (error instanceof TimerStateError) {
    return res.status(409).json({
      error: 'STATE_ERROR',
      message: error.message,
      code: error.code,
      details: error.details,
    });
  }

  if (error instanceof TimerSyncError) {
    return res.status(409).json({
      error: 'SYNC_ERROR',
      message: error.message,
      code: error.code,
      details: error.details,
      retryable: true,
    });
  }

  if (error instanceof TimerPersistenceError) {
    return res.status(503).json({
      error: 'PERSISTENCE_ERROR',
      message: error.message,
      code: error.code,
      details: error.details,
      retryable: true,
    });
  }

  if (error instanceof z.ZodError) {
    return res.status(400).json({
      error: 'VALIDATION_ERROR',
      message: 'Invalid request data',
      code: 'INVALID_REQUEST_DATA',
      details: error.errors,
    });
  }

  // Generic server error
  return res.status(500).json({
    error: 'INTERNAL_SERVER_ERROR',
    message: 'An unexpected error occurred',
    code: 'UNKNOWN_ERROR',
    retryable: true,
  });
}

// Request validation middleware
function validateTimerRequest(schema: z.ZodSchema) {
  return (req: any, res: any, next: any) => {
    try {
      req.validatedBody = schema.parse(req.body);
      next();
    } catch (error) {
      handleTimerError(error, req, res, 'request_validation');
    }
  };
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Goals endpoints
  app.get("/api/goals", async (req, res) => {
    try {
      const typeRaw = req.query.type;
      const dateRaw = req.query.anchorDate;
      if (typeof typeRaw !== 'string' || typeof dateRaw !== 'string') {
        return res.status(400).json({ message: "type and anchorDate are required" });
      }
      const type = goalTypeEnum.parse(typeRaw);
      const anchorDate = new Date(dateRaw);
      const goal = await storage.getGoal(type, anchorDate);
      res.json(goal ?? null);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid goal request", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to fetch goal" });
    }
  });

  app.put("/api/goals", async (req, res) => {
    try {
      const { type: typeRaw, anchorDate: dateRaw, value } = req.body || {};
      const type = goalTypeEnum.parse(typeRaw);
      if (typeof dateRaw !== 'string' && !(dateRaw instanceof Date)) {
        return res.status(400).json({ message: "anchorDate must be a date or ISO string" });
      }
      const anchorDate = new Date(dateRaw);
      if (typeof value !== 'string') {
        return res.status(400).json({ message: "value must be a string" });
      }
      const updated = await storage.setGoal(type, anchorDate, value);
      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid goal data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to save goal" });
    }
  });
  // Get tasks with optional date filtering
  app.get("/api/tasks", async (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      
      let start: Date | undefined;
      let end: Date | undefined;
      
      if (startDate) {
        start = new Date(startDate as string);
      }
      if (endDate) {
        end = new Date(endDate as string);
      }
      
      const tasks = await storage.getTasks(start, end);
      res.json(tasks);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch tasks" });
    }
  });

  // Get single task
  app.get("/api/tasks/:id", async (req, res) => {
    try {
      const task = await storage.getTask(req.params.id);
      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }
      res.json(task);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch task" });
    }
  });

  // Create new task
  app.post("/api/tasks", async (req, res) => {
    try {
      const validatedData = insertTaskSchema.parse(req.body);
      const task = await storage.createTask(validatedData);
      res.status(201).json(task);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid task data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create task" });
    }
  });

  // Update task
  app.put("/api/tasks/:id", async (req, res) => {
    try {
      const validatedData = updateTaskSchema.parse(req.body);
      const task = await storage.updateTask(req.params.id, validatedData);
      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }
      res.json(task);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid task data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update task" });
    }
  });

  // Delete task
  app.delete("/api/tasks/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteTask(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Task not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete task" });
    }
  });

  // Timer API Routes

  // Start timer for a task
  app.post("/api/timers/start", async (req, res) => {
    try {
      const { taskId } = req.body;
      
      if (!taskId || typeof taskId !== 'string') {
        throw new TimerValidationError(
          "Task ID is required and must be a valid string",
          { taskId }
        );
      }

      // Check if task exists
      const task = await storage.getTask(taskId);
      if (!task) {
        throw new TimerValidationError(
          "Task not found",
          { taskId, code: TIMER_ERROR_CODES.INVALID_TASK_ID }
        );
      }

      // Check for existing active timer
      const activeSession = await storage.getActiveTimerSession();
      if (activeSession) {
        throw new TimerStateError(
          "Another timer is already running",
          { 
            activeTaskId: activeSession.taskId,
            requestedTaskId: taskId,
            requiresConfirmation: true,
            code: TIMER_ERROR_CODES.TIMER_ALREADY_ACTIVE
          }
        );
      }

      // Create new timer session
      const sessionData = insertTimerSessionSchema.parse({
        taskId,
        startTime: new Date(),
        durationSeconds: 0,
        isActive: true,
      });

      const session = await storage.createTimerSession(sessionData);
      
      // Log successful timer start
      console.log('Timer started successfully', {
        sessionId: session.id,
        taskId,
        timestamp: new Date().toISOString(),
      });

      res.status(201).json({ 
        session,
        message: "Timer started successfully"
      });
    } catch (error) {
      handleTimerError(error, req, res, 'start_timer');
    }
  });

  // Pause current timer
  app.post("/api/timers/pause", async (req, res) => {
    try {
      const activeSession = await storage.getActiveTimerSession();
      if (!activeSession) {
        throw new TimerStateError(
          "No active timer found to pause",
          { code: TIMER_ERROR_CODES.NO_ACTIVE_TIMER }
        );
      }

      if (!activeSession.isActive) {
        throw new TimerStateError(
          "Timer is not currently active",
          { 
            sessionId: activeSession.id,
            code: TIMER_ERROR_CODES.TIMER_NOT_PAUSED
          }
        );
      }

      // Calculate elapsed time with validation
      const now = new Date();
      const startTime = new Date(activeSession.startTime);
      
      if (startTime > now) {
        throw new TimerValidationError(
          "Invalid timer state: start time is in the future",
          { startTime: startTime.toISOString(), currentTime: now.toISOString() }
        );
      }

      const elapsedSeconds = Math.floor((now.getTime() - startTime.getTime()) / 1000);
      const totalSeconds = (activeSession.durationSeconds || 0) + elapsedSeconds;

      if (totalSeconds < 0) {
        throw new TimerValidationError(
          "Invalid duration calculation",
          { elapsedSeconds, previousDuration: activeSession.durationSeconds }
        );
      }

      // Update session to paused state
      const updatedSession = await storage.updateTimerSession(activeSession.id, {
        durationSeconds: totalSeconds,
        isActive: false,
      });

      if (!updatedSession) {
        throw new TimerPersistenceError(
          "Failed to update timer session",
          { sessionId: activeSession.id }
        );
      }

      console.log('Timer paused successfully', {
        sessionId: activeSession.id,
        totalSeconds,
        timestamp: now.toISOString(),
      });

      res.json({ 
        session: updatedSession,
        totalElapsedSeconds: totalSeconds,
        message: "Timer paused successfully"
      });
    } catch (error) {
      handleTimerError(error, req, res, 'pause_timer');
    }
  });

  // Resume paused timer
  app.post("/api/timers/resume", async (req, res) => {
    try {
      const { sessionId } = req.body;
      
      if (!sessionId || typeof sessionId !== 'string') {
        throw new TimerValidationError(
          "Session ID is required and must be a valid string",
          { sessionId }
        );
      }

      const session = await storage.getTimerSession(sessionId);
      if (!session) {
        throw new TimerValidationError(
          "Timer session not found",
          { sessionId, code: TIMER_ERROR_CODES.INVALID_SESSION }
        );
      }

      if (session.isActive) {
        throw new TimerStateError(
          "Timer is already active",
          { 
            sessionId,
            code: TIMER_ERROR_CODES.TIMER_ALREADY_ACTIVE
          }
        );
      }

      if (session.endTime) {
        throw new TimerStateError(
          "Cannot resume a completed timer session",
          { 
            sessionId,
            endTime: session.endTime.toISOString(),
            code: TIMER_ERROR_CODES.TIMER_ALREADY_STOPPED
          }
        );
      }

      // Check for other active timers
      const activeSession = await storage.getActiveTimerSession();
      if (activeSession && activeSession.id !== sessionId) {
        throw new TimerStateError(
          "Another timer is already running",
          { 
            activeSessionId: activeSession.id,
            activeTaskId: activeSession.taskId,
            requestedSessionId: sessionId,
            requiresConfirmation: true,
            code: TIMER_ERROR_CODES.TIMER_ALREADY_ACTIVE
          }
        );
      }

      // Resume the timer
      const updatedSession = await storage.updateTimerSession(sessionId, {
        isActive: true,
        startTime: new Date(), // Reset start time for new segment
      });

      if (!updatedSession) {
        throw new TimerPersistenceError(
          "Failed to resume timer session",
          { sessionId }
        );
      }

      console.log('Timer resumed successfully', {
        sessionId,
        taskId: session.taskId,
        timestamp: new Date().toISOString(),
      });

      res.json({ 
        session: updatedSession,
        message: "Timer resumed successfully"
      });
    } catch (error) {
      handleTimerError(error, req, res, 'resume_timer');
    }
  });

  // Stop and complete timer
  app.post("/api/timers/stop", async (req, res) => {
    try {
      const activeSession = await storage.getActiveTimerSession();
      if (!activeSession) {
        throw new TimerStateError(
          "No active timer found to stop",
          { code: TIMER_ERROR_CODES.NO_ACTIVE_TIMER }
        );
      }

      if (!activeSession.isActive) {
        throw new TimerStateError(
          "Timer is not currently active",
          { 
            sessionId: activeSession.id,
            code: TIMER_ERROR_CODES.TIMER_ALREADY_STOPPED
          }
        );
      }

      if (activeSession.endTime) {
        throw new TimerStateError(
          "Timer session is already completed",
          { 
            sessionId: activeSession.id,
            endTime: activeSession.endTime.toISOString(),
            code: TIMER_ERROR_CODES.TIMER_ALREADY_STOPPED
          }
        );
      }

      // Calculate final elapsed time with validation
      const now = new Date();
      const startTime = new Date(activeSession.startTime);
      
      if (startTime > now) {
        throw new TimerValidationError(
          "Invalid timer state: start time is in the future",
          { startTime: startTime.toISOString(), currentTime: now.toISOString() }
        );
      }

      const elapsedSeconds = Math.floor((now.getTime() - startTime.getTime()) / 1000);
      const totalSeconds = (activeSession.durationSeconds || 0) + elapsedSeconds;

      if (totalSeconds < 0) {
        throw new TimerValidationError(
          "Invalid duration calculation",
          { elapsedSeconds, previousDuration: activeSession.durationSeconds }
        );
      }

      // Complete the session
      const completedSession = await storage.updateTimerSession(activeSession.id, {
        endTime: now,
        durationSeconds: totalSeconds,
        isActive: false,
      });

      if (!completedSession) {
        throw new TimerPersistenceError(
          "Failed to complete timer session",
          { sessionId: activeSession.id }
        );
      }

      console.log('Timer stopped successfully', {
        sessionId: activeSession.id,
        taskId: activeSession.taskId,
        totalSeconds,
        timestamp: now.toISOString(),
      });

      res.json({ 
        session: completedSession,
        message: "Timer stopped successfully"
      });
    } catch (error) {
      handleTimerError(error, req, res, 'stop_timer');
    }
  });

  // Get current active timer
  app.get("/api/timers/active", async (req, res) => {
    try {
      const activeSession = await storage.getActiveTimerSession();
      res.json({ session: activeSession });
    } catch (error) {
      res.status(500).json({ message: "Failed to get active timer" });
    }
  });

  // Get daily time summary
  app.get("/api/timers/daily", async (req, res) => {
    try {
      const { date } = req.query;
      const targetDate = date ? new Date(date as string) : new Date();
      
      const dailySummary = await storage.getDailySummary(targetDate);
      const totalSeconds = dailySummary.reduce((sum, item) => sum + item.totalSeconds, 0);
      const targetSeconds = 8 * 60 * 60; // 8 hours
      const remainingSeconds = Math.max(0, targetSeconds - totalSeconds);

      res.json({
        date: targetDate.toISOString().split('T')[0],
        totalSeconds,
        remainingSeconds,
        targetSeconds,
        taskBreakdown: dailySummary,
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to get daily summary" });
    }
  });

  // Get time data for specific task
  app.get("/api/timers/task/:id", async (req, res) => {
    try {
      const taskId = req.params.id;
      const sessions = await storage.getTimerSessionsByTask(taskId);
      const estimate = await storage.getTaskEstimate(taskId);
      
      const totalSeconds = sessions
        .filter(session => session.endTime)
        .reduce((sum, session) => sum + (session.durationSeconds || 0), 0);

      res.json({
        taskId,
        sessions,
        estimate,
        totalSeconds,
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to get task timer data" });
    }
  });

  // Sync timer state (for recovery)
  app.post("/api/timers/sync", async (req, res) => {
    try {
      const { events, clientTimestamp } = req.body;
      
      if (!Array.isArray(events)) {
        throw new TimerValidationError(
          "Events array is required for sync operation",
          { eventsType: typeof events }
        );
      }

      if (events.length === 0) {
        return res.json({ 
          syncedEventIds: [],
          conflicts: [],
          message: "No events to sync"
        });
      }

      // Validate sync request timing
      const serverTime = new Date();
      const clientTime = clientTimestamp ? new Date(clientTimestamp) : null;
      
      if (clientTime && Math.abs(serverTime.getTime() - clientTime.getTime()) > 300000) { // 5 minutes
        console.warn('Large time difference detected in sync request', {
          serverTime: serverTime.toISOString(),
          clientTime: clientTime.toISOString(),
          difference: Math.abs(serverTime.getTime() - clientTime.getTime()),
        });
      }

      // Process sync events with conflict detection
      const syncedEventIds: string[] = [];
      const failedEvents: Array<{ eventId: string; error: string }> = [];
      const conflicts: Array<{ eventId: string; reason: string; serverState: any }> = [];
      
      for (const event of events) {
        try {
          // Validate event structure
          if (!event.id || !event.type || !event.timestamp) {
            throw new TimerValidationError(
              "Invalid event structure",
              { event }
            );
          }

          // Check for conflicts with server state
          const activeSession = await storage.getActiveTimerSession();
          
          // Process each event based on type
          switch (event.type) {
            case 'start':
              if (activeSession && activeSession.taskId !== event.taskId) {
                conflicts.push({
                  eventId: event.id,
                  reason: 'Another timer is active on server',
                  serverState: {
                    activeTaskId: activeSession.taskId,
                    sessionId: activeSession.id,
                  },
                });
                continue;
              }
              break;
              
            case 'pause':
            case 'stop':
              if (!activeSession || activeSession.taskId !== event.taskId) {
                conflicts.push({
                  eventId: event.id,
                  reason: 'No matching active timer on server',
                  serverState: {
                    activeSession: activeSession ? {
                      taskId: activeSession.taskId,
                      sessionId: activeSession.id,
                    } : null,
                  },
                });
                continue;
              }
              break;
              
            case 'resume':
              if (activeSession) {
                conflicts.push({
                  eventId: event.id,
                  reason: 'Another timer is already active',
                  serverState: {
                    activeTaskId: activeSession.taskId,
                    sessionId: activeSession.id,
                  },
                });
                continue;
              }
              break;
              
            default:
              throw new TimerValidationError(
                `Unknown event type: ${event.type}`,
                { event }
              );
          }
          
          syncedEventIds.push(event.id);
        } catch (eventError) {
          const timerError = TimerErrorHandler.handleError(eventError);
          failedEvents.push({
            eventId: event.id || 'unknown',
            error: timerError.message,
          });
          
          console.error('Failed to process sync event:', {
            event,
            error: timerError,
            timestamp: new Date().toISOString(),
          });
        }
      }

      const response = {
        syncedEventIds,
        failedEvents,
        conflicts,
        serverTimestamp: serverTime.toISOString(),
        message: `Processed ${events.length} events: ${syncedEventIds.length} synced, ${failedEvents.length} failed, ${conflicts.length} conflicts`,
      };

      // Log sync operation
      console.log('Timer sync completed', {
        totalEvents: events.length,
        syncedCount: syncedEventIds.length,
        failedCount: failedEvents.length,
        conflictCount: conflicts.length,
        timestamp: serverTime.toISOString(),
      });

      res.json(response);
    } catch (error) {
      handleTimerError(error, req, res, 'sync_timer_events');
    }
  });

  // Task Estimate Routes

  // Get task estimate
  app.get("/api/tasks/:id/estimate", async (req, res) => {
    try {
      const estimate = await storage.getTaskEstimate(req.params.id);
      res.json({ estimate });
    } catch (error) {
      res.status(500).json({ message: "Failed to get task estimate" });
    }
  });

  // Create or update task estimate
  app.put("/api/tasks/:id/estimate", async (req, res) => {
    try {
      const { estimatedDurationMinutes } = req.body;
      
      if (typeof estimatedDurationMinutes !== 'number' || estimatedDurationMinutes <= 0) {
        return res.status(400).json({ message: "Valid estimated duration is required" });
      }

      const taskId = req.params.id;
      
      // Check if task exists
      const task = await storage.getTask(taskId);
      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }

      // Try to update existing estimate first
      let estimate = await storage.updateTaskEstimate(taskId, { estimatedDurationMinutes });
      
      // If no existing estimate, create new one
      if (!estimate) {
        const estimateData = insertTaskEstimateSchema.parse({
          taskId,
          estimatedDurationMinutes,
        });
        estimate = await storage.createTaskEstimate(estimateData);
      }

      res.json({ estimate });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid estimate data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to save task estimate" });
    }
  });

  // Delete task estimate
  app.delete("/api/tasks/:id/estimate", async (req, res) => {
    try {
      const deleted = await storage.deleteTaskEstimate(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Task estimate not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete task estimate" });
    }
  });

  // Error reporting endpoint
  app.post("/api/errors/report", async (req, res) => {
    try {
      const {
        errorId,
        timestamp,
        severity,
        errorCode,
        errorMessage,
        context,
        retryCount,
      } = req.body;

      // Log error to server console with structured format
      console.error('Client Error Report', {
        errorId,
        timestamp,
        severity,
        errorCode,
        errorMessage,
        context: {
          component: context?.component,
          action: context?.action,
          url: context?.url,
          userAgent: context?.userAgent,
        },
        retryCount,
        serverTimestamp: new Date().toISOString(),
      });

      // In a production environment, you would:
      // 1. Store the error in a database
      // 2. Send alerts for critical errors
      // 3. Aggregate error metrics
      // 4. Forward to external monitoring services

      res.status(201).json({
        message: 'Error report received',
        errorId,
        serverTimestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Failed to process error report:', error);
      res.status(500).json({
        error: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to process error report',
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
