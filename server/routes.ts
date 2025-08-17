import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { 
  insertTaskSchema, updateTaskSchema,
  insertTaskEstimateSchema, updateTaskEstimateSchema,
  insertListSchema, updateListSchema,
  goalTypeEnum,
  reviewTypeEnum,
  insertReviewSchema, updateReviewSchema,
  noteTypeEnum,
  updateNoteSchema,
  insertListNoteSchema, updateListNoteSchema
} from "@shared/schema";
import { z } from "zod";
import { requireAuth } from "./auth";
// Legacy session error helpers removed in sessionless rewrite

// Legacy timer error helpers removed

export async function registerRoutes(app: Express): Promise<Server> {
  // Health check
  app.head('/api/health', (_req, res) => res.status(200).end());
  app.get('/api/health', (_req, res) => res.status(200).json({ status: 'ok' }));

  // Session info endpoint
  app.get('/api/me', requireAuth(), async (req, res) => {
    const userId = (req as any).userId as string | undefined;
    res.json({ userId });
  });

  // Protect all subsequent /api routes (excluding already-defined public ones like /api/health, /api/me)
  app.use('/api', requireAuth());

  // Lists endpoints
  
  // Get all lists with task counts
  app.get("/api/lists", async (req, res) => {
    try {
      const lists = await storage.getLists(req.userId!);
      res.json(lists);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch lists" });
    }
  });

  // Get single list
  app.get("/api/lists/:id", async (req, res) => {
    try {
      const list = await storage.getList(req.userId!, req.params.id);
      if (!list) {
        return res.status(404).json({ message: "List not found" });
      }
      res.json(list);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch list" });
    }
  });

  // Create new list
  app.post("/api/lists", async (req, res) => {
    try {
      const validatedData = insertListSchema.parse(req.body);
      const list = await storage.createList(req.userId!, validatedData);
      res.status(201).json(list);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid list data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create list" });
    }
  });

  // Update list
  app.put("/api/lists/:id", async (req, res) => {
    try {
      const validatedData = updateListSchema.parse(req.body);
      const list = await storage.updateList(req.userId!, req.params.id, validatedData);
      if (!list) {
        return res.status(404).json({ message: "List not found" });
      }
      res.json(list);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid list data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update list" });
    }
  });

  // Delete list
  app.delete("/api/lists/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteList(req.userId!, req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "List not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete list" });
    }
  });

  // Get tasks for specific list
  app.get("/api/lists/:id/tasks", async (req, res) => {
    try {
      const tasks = await storage.getTasksByList(req.userId!, req.params.id);
      res.json(tasks);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch tasks for list" });
    }
  });

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
      const goal = await storage.getGoal(req.userId!, type, anchorDate);
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
      const updated = await storage.setGoal(req.userId!, type, anchorDate, value);
      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid goal data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to save goal" });
    }
  });

  // Reviews endpoints
  app.get("/api/reviews", async (req, res) => {
    try {
      const typeRaw = req.query.type;
      const dateRaw = req.query.anchorDate;
      if (typeof typeRaw !== 'string' || typeof dateRaw !== 'string') {
        return res.status(400).json({ message: "type and anchorDate are required" });
      }
      const type = reviewTypeEnum.parse(typeRaw);
      const anchorDate = new Date(dateRaw);
      const review = await storage.getReview(req.userId!, type, anchorDate);
      res.json(review ?? null);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid review request", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to fetch review" });
    }
  });

  app.put("/api/reviews", async (req, res) => {
    try {
      const { type: typeRaw, anchorDate: dateRaw, ...values } = req.body || {};
      const type = reviewTypeEnum.parse(typeRaw);
      if (typeof dateRaw !== 'string' && !(dateRaw instanceof Date)) {
        return res.status(400).json({ message: "anchorDate must be a date or ISO string" });
      }
      const anchorDate = new Date(dateRaw);
      const validated = updateReviewSchema.parse(values);
      const updated = await storage.setReview(req.userId!, type, anchorDate, validated);
      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid review data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to save review" });
    }
  });

  // Notes endpoints
  app.get("/api/notes", async (req, res) => {
    try {
      const typeRaw = req.query.type;
      const dateRaw = req.query.anchorDate;
      if (typeof typeRaw !== 'string' || typeof dateRaw !== 'string') {
        return res.status(400).json({ message: "type and anchorDate are required" });
      }
      const type = noteTypeEnum.parse(typeRaw);
      const anchorDate = new Date(dateRaw);
      const note = await storage.getNote(req.userId!, type, anchorDate);
      res.json(note ?? null);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid note request", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to fetch note" });
    }
  });

  app.put("/api/notes", async (req, res) => {
    try {
      const { type: typeRaw, anchorDate: dateRaw, ...values } = req.body || {};
      const type = noteTypeEnum.parse(typeRaw);
      if (typeof dateRaw !== 'string' && !(dateRaw instanceof Date)) {
        return res.status(400).json({ message: "anchorDate must be a date or ISO string" });
      }
      const anchorDate = new Date(dateRaw);
      const validated = updateNoteSchema.parse(values);
      const updated = await storage.setNote(req.userId!, type, anchorDate, validated);
      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid note data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to save note" });
    }
  });
  // Get tasks with optional date filtering
  app.get("/api/tasks", async (req, res) => {
    try {
      const { startDate, endDate, includeUnscheduled } = req.query;
      
      let start: Date | undefined;
      let end: Date | undefined;
      
      if (startDate) {
        start = new Date(startDate as string);
      }
      if (endDate) {
        end = new Date(endDate as string);
      }
      
      const tasks = await storage.getTasks(req.userId!, start, end, includeUnscheduled === 'true');
      res.json(tasks);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch tasks" });
    }
  });

  // Get single task
  app.get("/api/tasks/:id", async (req, res) => {
    try {
      const task = await storage.getTask(req.userId!, req.params.id);
      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }
      res.json(task);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch task" });
    }
  });

  // Set absolute time logged for a task (sessionless)
  app.put("/api/tasks/:id/time-logged", async (req, res) => {
    try {
      const taskId = req.params.id;
      const { timeLoggedSeconds } = req.body || {};

      if (typeof timeLoggedSeconds !== 'number' || !isFinite(timeLoggedSeconds)) {
        return res.status(400).json({ message: "timeLoggedSeconds must be a non-negative number" });
      }

      const seconds = Math.max(0, Math.floor(timeLoggedSeconds));
      const existing = await storage.getTask(req.userId!, taskId);
      if (!existing) {
        return res.status(404).json({ message: "Task not found" });
      }

      const updated = await storage.updateTask(req.userId!, taskId, { timeLoggedSeconds: seconds } as any);
      if (!updated) {
        return res.status(500).json({ message: "Failed to update task time" });
      }
      res.json(updated);
    } catch (error) {
      res.status(500).json({ message: "Failed to set time logged" });
    }
  });

  // Create new task
  app.post("/api/tasks", async (req, res) => {
    try {
      const validatedData = insertTaskSchema.parse(req.body);
      const task = await storage.createTask(req.userId!, validatedData);
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
      const task = await storage.updateTask(req.userId!, req.params.id, validatedData);
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
      const deleted = await storage.deleteTask(req.userId!, req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Task not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete task" });
    }
  });

  // Legacy timer session routes removed

  // Get overall logged time for a task (persisted)
  app.get("/api/tasks/:id/time-logged", async (req, res) => {
    try {
      const task = await storage.getTask(req.userId!, req.params.id);
      if (!task) {
        return res.status(404).json({ message: 'Task not found' });
      }
      res.json({ taskId: task.id, timeLoggedSeconds: (task as any).timeLoggedSeconds ?? 0 });
    } catch (error) {
      res.status(500).json({ message: 'Failed to get task logged time' });
    }
  });

  // Removed increment route in favor of absolute PUT time-logged

  // Get daily time summary
  app.get("/api/timers/daily", async (req, res) => {
    try {
      const { date } = req.query;
      const targetDate = date ? new Date(date as string) : new Date();
      
      const dailySummary = await storage.getDailySummary(req.userId!, targetDate);
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

  // Removed legacy timer task sessions endpoint

  // Removed legacy timer sync endpoint

  // Task Estimate Routes

  // Get task estimate
  app.get("/api/tasks/:id/estimate", async (req, res) => {
    try {
      const estimate = await storage.getTaskEstimate(req.userId!, req.params.id);
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
      const task = await storage.getTask(req.userId!, taskId);
      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }

      // Try to update existing estimate first
      let estimate = await storage.updateTaskEstimate(req.userId!, taskId, { estimatedDurationMinutes });
      
      // If no existing estimate, create new one
      if (!estimate) {
        const estimateData = insertTaskEstimateSchema.parse({
          taskId,
          estimatedDurationMinutes,
        });
        estimate = await storage.createTaskEstimate(req.userId!, estimateData);
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
      const deleted = await storage.deleteTaskEstimate(req.userId!, req.params.id);
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

  // List Notes endpoints
  
  // Get list notes for a specific list
  app.get("/api/list-notes", async (req, res) => {
    try {
      const listId = req.query.listId as string;
      if (!listId) {
        return res.status(400).json({ message: "listId is required" });
      }
      const listNotes = await storage.getListNotes(req.userId!, listId);
      res.json(listNotes);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch list notes" });
    }
  });

  // Get single list note
  app.get("/api/list-notes/:id", async (req, res) => {
    try {
      const listNote = await storage.getListNote(req.userId!, req.params.id);
      if (!listNote) {
        return res.status(404).json({ message: "List note not found" });
      }
      res.json(listNote);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch list note" });
    }
  });

  // Create new list note
  app.post("/api/list-notes", async (req, res) => {
    try {
      const validatedData = insertListNoteSchema.parse(req.body);
      const listNote = await storage.createListNote(req.userId!, validatedData);
      res.status(201).json(listNote);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid list note data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create list note" });
    }
  });

  // Update list note
  app.patch("/api/list-notes/:id", async (req, res) => {
    try {
      const validatedData = updateListNoteSchema.parse(req.body);
      const listNote = await storage.updateListNote(req.userId!, req.params.id, validatedData);
      if (!listNote) {
        return res.status(404).json({ message: "List note not found" });
      }
      res.json(listNote);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid list note data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update list note" });
    }
  });

  // Delete list note
  app.delete("/api/list-notes/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteListNote(req.userId!, req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "List note not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete list note" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
