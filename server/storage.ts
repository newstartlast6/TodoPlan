import { 
  type User, type InsertUser, type Task, type InsertTask, type UpdateTask, 
  type TimerSession, type InsertTimerSession, type UpdateTimerSession,
  type TaskEstimate, type InsertTaskEstimate, type UpdateTaskEstimate,
  type DailyTimeSummary,
  type Goal, type InsertGoal, type UpdateGoal,
  type List, type InsertList, type UpdateList,
  tasks, users, timerSessions, taskEstimates, goals, lists 
} from "@shared/schema";
import { randomUUID } from "crypto";
import { getDb, isPostgresMode } from "./db";
import { eq, and, gte, lte, desc, lt, inArray, isNotNull, or, isNull } from "drizzle-orm";
import { TimerPersistenceError } from "@shared/services/timer-errors";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // List operations
  getLists(): Promise<List[]>;
  getList(id: string): Promise<List | undefined>;
  createList(list: InsertList): Promise<List>;
  updateList(id: string, list: UpdateList): Promise<List | undefined>;
  deleteList(id: string): Promise<boolean>;
  getTasksByList(listId: string): Promise<Task[]>;
  
  // Task operations
  getTasks(startDate?: Date, endDate?: Date, includeUnscheduled?: boolean): Promise<Task[]>;
  getTask(id: string): Promise<Task | undefined>;
  createTask(task: InsertTask): Promise<Task>;
  updateTask(id: string, task: UpdateTask): Promise<Task | undefined>;
  deleteTask(id: string): Promise<boolean>;

  // Timer session operations
  getActiveTimerSession(): Promise<TimerSession | undefined>;
  getTimerSession(id: string): Promise<TimerSession | undefined>;
  getTimerSessionsByTask(taskId: string): Promise<TimerSession[]>;
  createTimerSession(session: InsertTimerSession): Promise<TimerSession>;
  updateTimerSession(id: string, session: UpdateTimerSession): Promise<TimerSession | undefined>;
  deleteTimerSession(id: string): Promise<boolean>;
  stopActiveTimerSessions(): Promise<void>;

  // Task estimate operations
  getTaskEstimate(taskId: string): Promise<TaskEstimate | undefined>;
  createTaskEstimate(estimate: InsertTaskEstimate): Promise<TaskEstimate>;
  updateTaskEstimate(taskId: string, estimate: UpdateTaskEstimate): Promise<TaskEstimate | undefined>;
  deleteTaskEstimate(taskId: string): Promise<boolean>;

  // Daily summary operations
  getDailySummary(date: Date): Promise<DailyTimeSummary[]>;
  getDailySummaryByDateRange(startDate: Date, endDate: Date): Promise<DailyTimeSummary[]>;

  // Goals
  getGoal(type: string, anchorDate: Date): Promise<Goal | undefined>;
  setGoal(type: string, anchorDate: Date, value: string): Promise<Goal>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private lists: Map<string, List>;
  private tasks: Map<string, Task>;
  private timerSessions: Map<string, TimerSession>;
  private taskEstimates: Map<string, TaskEstimate>;
  private goals: Map<string, Goal>;

  constructor() {
    this.users = new Map();
    this.lists = new Map();
    this.tasks = new Map();
    this.timerSessions = new Map();
    this.taskEstimates = new Map();
    this.goals = new Map();
    // Initialize with some sample tasks for demonstration
    this.initializeSampleData();
  }

  private initializeSampleData() {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    const sampleTasks: Task[] = [
      // Monday - completed
      {
        id: randomUUID(),
        title: "Team standup meeting",
        description: "Daily team sync",
        notes: null,
        startTime: new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000 + 9 * 60 * 60 * 1000), // Monday 9 AM
        endTime: new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000 + 9.5 * 60 * 60 * 1000), // Monday 9:30 AM
        completed: true,
        priority: "medium",
        createdAt: new Date(),
        listId: null,
        scheduledDate: null,
      },
      {
        id: randomUUID(),
        title: "Review project proposal",
        description: "Check the new project requirements",
        notes: null,
        startTime: new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000 + 14 * 60 * 60 * 1000), // Monday 2 PM
        endTime: new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000 + 15 * 60 * 60 * 1000), // Monday 3 PM
        completed: true,
        priority: "high",
        createdAt: new Date(),
        listId: null,
        scheduledDate: null,
      },
      // Tuesday - completed
      {
        id: randomUUID(),
        title: "Client presentation",
        description: "Present the project to client",
        notes: null,
        startTime: new Date(today.getTime() - 1 * 24 * 60 * 60 * 1000 + 10 * 60 * 60 * 1000), // Tuesday 10 AM
        endTime: new Date(today.getTime() - 1 * 24 * 60 * 60 * 1000 + 11 * 60 * 60 * 1000), // Tuesday 11 AM
        completed: true,
        priority: "high",
        createdAt: new Date(),
        listId: null,
        scheduledDate: null,
      },
      // Today - mixed
      {
        id: randomUUID(),
        title: "Morning workout",
        description: "Gym session",
        notes: null,
        startTime: new Date(today.getTime() + 7 * 60 * 60 * 1000), // Today 7 AM
        endTime: new Date(today.getTime() + 8 * 60 * 60 * 1000), // Today 8 AM
        completed: true,
        priority: "low",
        createdAt: new Date(),
        listId: null,
        scheduledDate: null,
      },
      {
        id: randomUUID(),
        title: "Design review meeting",
        description: "Review UI/UX designs",
        notes: null,
        startTime: new Date(today.getTime() + 10 * 60 * 60 * 1000), // Today 10 AM
        endTime: new Date(today.getTime() + 11 * 60 * 60 * 1000), // Today 11 AM
        completed: true,
        priority: "medium",
        createdAt: new Date(),
        listId: null,
        scheduledDate: null,
      },
      {
        id: randomUUID(),
        title: "Working on calendar app mockup",
        description: "Create the calendar interface",
        notes: "Need to focus on responsive design and user experience",
        startTime: new Date(today.getTime() + 13 * 60 * 60 * 1000), // Today 1 PM
        endTime: new Date(today.getTime() + 16 * 60 * 60 * 1000), // Today 4 PM
        completed: false,
        priority: "high",
        createdAt: new Date(),
        listId: null,
        scheduledDate: null,
      },
      {
        id: randomUUID(),
        title: "Team retrospective",
        description: "Weekly team retrospective",
        notes: null,
        startTime: new Date(today.getTime() + 16 * 60 * 60 * 1000), // Today 4 PM
        endTime: new Date(today.getTime() + 17 * 60 * 60 * 1000), // Today 5 PM
        completed: false,
        priority: "medium",
        createdAt: new Date(),
        listId: null,
        scheduledDate: null,
      },
      // Tomorrow
      {
        id: randomUUID(),
        title: "Product planning session",
        description: "Plan next sprint features",
        notes: null,
        startTime: new Date(today.getTime() + 1 * 24 * 60 * 60 * 1000 + 9.5 * 60 * 60 * 1000), // Tomorrow 9:30 AM
        endTime: new Date(today.getTime() + 1 * 24 * 60 * 60 * 1000 + 11 * 60 * 60 * 1000), // Tomorrow 11 AM
        completed: false,
        priority: "high",
        createdAt: new Date(),
        listId: null,
        scheduledDate: null,
      },
    ];
    
    sampleTasks.forEach(task => this.tasks.set(task.id, task));
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  // List operations
  async getLists(): Promise<List[]> {
    return Array.from(this.lists.values()).sort((a, b) => {
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return aTime - bTime;
    });
  }

  async getList(id: string): Promise<List | undefined> {
    return this.lists.get(id);
  }

  async createList(insertList: InsertList): Promise<List> {
    const id = randomUUID();
    const list: List = {
      ...insertList,
      id,
      emoji: insertList.emoji ?? '📋',
      color: insertList.color ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.lists.set(id, list);
    return list;
  }

  async updateList(id: string, updateList: UpdateList): Promise<List | undefined> {
    const existingList = this.lists.get(id);
    if (!existingList) return undefined;
    
    const updatedList: List = { 
      ...existingList, 
      ...updateList,
      updatedAt: new Date()
    };
    this.lists.set(id, updatedList);
    return updatedList;
  }

  async deleteList(id: string): Promise<boolean> {
    // Set list_id to null for all tasks in this list
    Array.from(this.tasks.values())
      .filter(task => task.listId === id)
      .forEach(task => {
        const updatedTask = { ...task, listId: null };
        this.tasks.set(task.id, updatedTask);
      });
    
    return this.lists.delete(id);
  }

  async getTasksByList(listId: string): Promise<Task[]> {
    return Array.from(this.tasks.values())
      .filter(task => task.listId === listId)
      .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
  }

  async getTasks(startDate?: Date, endDate?: Date, includeUnscheduled?: boolean): Promise<Task[]> {
    let tasks = Array.from(this.tasks.values());
    
    if (startDate && endDate) {
      tasks = tasks.filter(task => {
        const inStartRange = task.startTime >= startDate && task.startTime <= endDate;
        const scheduled = task.scheduledDate ? (task.scheduledDate >= startDate && task.scheduledDate <= endDate) : false;
        return inStartRange || scheduled;
      });
      if (includeUnscheduled) {
        // Also include explicitly unscheduled tasks
        const unscheduled = Array.from(this.tasks.values()).filter(t => !t.scheduledDate);
        const byId = new Map(tasks.map(t => [t.id, t] as const));
        for (const t of unscheduled) {
          if (!byId.has(t.id)) {
            byId.set(t.id, t);
          }
        }
        tasks = Array.from(byId.values());
      }
    }
    
    return tasks.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
  }

  async getTask(id: string): Promise<Task | undefined> {
    return this.tasks.get(id);
  }

  async createTask(insertTask: InsertTask): Promise<Task> {
    const id = randomUUID();
    const task: Task = {
      ...insertTask,
      id,
      createdAt: new Date(),
      description: insertTask.description || null,
      notes: insertTask.notes || null,
      completed: insertTask.completed || false,
      priority: insertTask.priority || "medium",
      listId: insertTask.listId ?? null,
      scheduledDate: (insertTask as any).scheduledDate ?? null,
    };
    this.tasks.set(id, task);
    return task;
  }

  async updateTask(id: string, updateTask: UpdateTask): Promise<Task | undefined> {
    const existingTask = this.tasks.get(id);
    if (!existingTask) return undefined;
    
    const updatedTask: Task = { ...existingTask, ...updateTask };
    this.tasks.set(id, updatedTask);
    return updatedTask;
  }

  async deleteTask(id: string): Promise<boolean> {
    return this.tasks.delete(id);
  }

  // Timer session operations
  async getActiveTimerSession(): Promise<TimerSession | undefined> {
    return Array.from(this.timerSessions.values()).find(session => session.isActive);
  }

  async getTimerSession(id: string): Promise<TimerSession | undefined> {
    return this.timerSessions.get(id);
  }

  async getTimerSessionsByTask(taskId: string): Promise<TimerSession[]> {
    return Array.from(this.timerSessions.values())
      .filter(session => session.taskId === taskId)
      .sort((a, b) => b.startTime.getTime() - a.startTime.getTime());
  }

  async createTimerSession(insertSession: InsertTimerSession): Promise<TimerSession> {
    const id = randomUUID();
    const session: TimerSession = {
      ...insertSession,
      id,
      endTime: insertSession.endTime ?? null,
      durationSeconds: insertSession.durationSeconds ?? 0,
      isActive: insertSession.isActive ?? false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.timerSessions.set(id, session);
    return session;
  }

  async updateTimerSession(id: string, updateSession: UpdateTimerSession): Promise<TimerSession | undefined> {
    const existingSession = this.timerSessions.get(id);
    if (!existingSession) return undefined;
    
    const updatedSession: TimerSession = { 
      ...existingSession, 
      ...updateSession,
      updatedAt: new Date()
    };
    this.timerSessions.set(id, updatedSession);
    return updatedSession;
  }

  async deleteTimerSession(id: string): Promise<boolean> {
    return this.timerSessions.delete(id);
  }

  async stopActiveTimerSessions(): Promise<void> {
    const activeSessions = Array.from(this.timerSessions.values()).filter(session => session.isActive);
    const now = new Date();
    
    activeSessions.forEach(session => {
      const elapsedSeconds = Math.floor((now.getTime() - session.startTime.getTime()) / 1000);
      const updatedSession: TimerSession = {
        ...session,
        endTime: now,
        durationSeconds: (session.durationSeconds ?? 0) + elapsedSeconds,
        isActive: false,
        updatedAt: now,
      };
      this.timerSessions.set(session.id, updatedSession);
    });
  }

  // Task estimate operations
  async getTaskEstimate(taskId: string): Promise<TaskEstimate | undefined> {
    return Array.from(this.taskEstimates.values()).find(estimate => estimate.taskId === taskId);
  }

  async createTaskEstimate(insertEstimate: InsertTaskEstimate): Promise<TaskEstimate> {
    const id = randomUUID();
    const estimate: TaskEstimate = {
      ...insertEstimate,
      id,
      createdAt: new Date(),
    };
    this.taskEstimates.set(id, estimate);
    return estimate;
  }

  async updateTaskEstimate(taskId: string, updateEstimate: UpdateTaskEstimate): Promise<TaskEstimate | undefined> {
    const existingEstimate = Array.from(this.taskEstimates.values()).find(est => est.taskId === taskId);
    if (!existingEstimate) return undefined;
    
    const updatedEstimate: TaskEstimate = { ...existingEstimate, ...updateEstimate };
    this.taskEstimates.set(existingEstimate.id, updatedEstimate);
    return updatedEstimate;
  }

  async deleteTaskEstimate(taskId: string): Promise<boolean> {
    const estimate = Array.from(this.taskEstimates.entries()).find(([_, est]) => est.taskId === taskId);
    if (!estimate) return false;
    
    return this.taskEstimates.delete(estimate[0]);
  }

  // Daily summary operations
  async getDailySummary(date: Date): Promise<DailyTimeSummary[]> {
    const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);
    
    return this.getDailySummaryByDateRange(startOfDay, endOfDay);
  }

  async getDailySummaryByDateRange(startDate: Date, endDate: Date): Promise<DailyTimeSummary[]> {
    const sessions = Array.from(this.timerSessions.values())
      .filter(session => 
        session.endTime && 
        session.startTime >= startDate && 
        session.startTime < endDate
      );

    const summaryMap = new Map<string, DailyTimeSummary>();

    sessions.forEach(session => {
      const dateKey = session.startTime.toISOString().split('T')[0];
      const taskKey = `${dateKey}-${session.taskId}`;
      
      if (!summaryMap.has(taskKey)) {
        summaryMap.set(taskKey, {
          date: dateKey,
          taskId: session.taskId,
          totalSeconds: 0,
          sessionCount: 0,
          task: this.tasks.get(session.taskId),
        });
      }
      
      const summary = summaryMap.get(taskKey)!;
      summary.totalSeconds += session.durationSeconds ?? 0;
      summary.sessionCount += 1;
    });

    return Array.from(summaryMap.values()).sort((a, b) => a.date.localeCompare(b.date));
  }

  private goalKey(type: string, anchorDate: Date): string {
    const d = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), anchorDate.getDate());
    return `${type}:${d.toISOString().slice(0, 10)}`;
  }

  async getGoal(type: string, anchorDate: Date): Promise<Goal | undefined> {
    const key = this.goalKey(type, anchorDate);
    return this.goals.get(key);
  }

  async setGoal(type: string, anchorDate: Date, value: string): Promise<Goal> {
    const key = this.goalKey(type, anchorDate);
    const existing = this.goals.get(key);
    const base: Goal = existing ?? {
      id: randomUUID(),
      type,
      anchorDate: new Date(anchorDate.getFullYear(), anchorDate.getMonth(), anchorDate.getDate()),
      value: "",
      createdAt: new Date(),
      updatedAt: new Date(),
    } as Goal;
    const updated: Goal = { ...base, value, updatedAt: new Date() };
    this.goals.set(key, updated);
    return updated;
  }
}

// Database-backed storage using Drizzle + Postgres (Supabase)
class DbStorage implements IStorage {
  private get db() {
    return getDb();
  }

  private async withPersistence<T>(
    operation: string,
    details: Record<string, unknown>,
    fn: () => Promise<T>
  ): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("DB operation failed", {
        operation,
        details,
        error: errorMessage,
        timestamp: new Date().toISOString(),
      });
      throw new TimerPersistenceError(`Database operation failed: ${operation}`, {
        ...details,
        error: errorMessage,
      });
    }
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.withPersistence("get_user", { id }, async () => {
      const result = await this.db
        .select()
        .from(users)
        .where(eq(users.id, id))
        .limit(1);
      return result[0];
    });
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return this.withPersistence("get_user_by_username", { username }, async () => {
      const result = await this.db
        .select()
        .from(users)
        .where(eq(users.username, username))
        .limit(1);
      return result[0];
    });
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    return this.withPersistence("create_user", { username: insertUser.username }, async () => {
      const result = await this.db.insert(users).values(insertUser).returning();
      return result[0];
    });
  }

  // List operations
  async getLists(): Promise<List[]> {
    return this.withPersistence("get_lists", {}, async () => {
      return await this.db.select().from(lists).orderBy(lists.createdAt);
    });
  }

  async getList(id: string): Promise<List | undefined> {
    return this.withPersistence("get_list", { id }, async () => {
      const result = await this.db
        .select()
        .from(lists)
        .where(eq(lists.id, id))
        .limit(1);
      return result[0];
    });
  }

  async createList(insertList: InsertList): Promise<List> {
    return this.withPersistence("create_list", { name: insertList.name }, async () => {
      const result = await this.db.insert(lists).values(insertList).returning();
      return result[0];
    });
  }

  async updateList(id: string, updateList: UpdateList): Promise<List | undefined> {
    return this.withPersistence("update_list", { id }, async () => {
      const result = await this.db
        .update(lists)
        .set({ ...updateList, updatedAt: new Date() })
        .where(eq(lists.id, id))
        .returning();
      return result[0];
    });
  }

  async deleteList(id: string): Promise<boolean> {
    return this.withPersistence("delete_list", { id }, async () => {
      const db = this.db;
      return await db.transaction(async (tx) => {
        // Set list_id to null for all tasks in this list
        await tx
          .update(tasks)
          .set({ listId: null })
          .where(eq(tasks.listId, id));
        
        // Delete the list
        const result = await tx
          .delete(lists)
          .where(eq(lists.id, id))
          .returning({ id: lists.id });
        
        return result.length > 0;
      });
    });
  }

  async getTasksByList(listId: string): Promise<Task[]> {
    return this.withPersistence("get_tasks_by_list", { listId }, async () => {
      return await this.db
        .select()
        .from(tasks)
        .where(eq(tasks.listId, listId))
        .orderBy(tasks.startTime);
    });
  }

  async getTasks(startDate?: Date, endDate?: Date, includeUnscheduled?: boolean): Promise<Task[]> {
    return this.withPersistence("get_tasks", {
      startDate: startDate?.toISOString(),
      endDate: endDate?.toISOString(),
      includeUnscheduled: !!includeUnscheduled,
    }, async () => {
      if (startDate && endDate) {
        const baseWhere = or(
          and(gte(tasks.startTime, startDate), lte(tasks.startTime, endDate)),
          and(gte(tasks.scheduledDate as any, startDate as any), lte(tasks.scheduledDate as any, endDate as any))
        );
        const whereClause = includeUnscheduled
          ? or(baseWhere, isNull(tasks.scheduledDate as any))
          : baseWhere;
        return await this.db
          .select()
          .from(tasks)
          .where(whereClause)
          .orderBy(tasks.startTime);
      }
      // No date filter
      return await this.db.select().from(tasks).orderBy(tasks.startTime);
    });
  }

  async getTask(id: string): Promise<Task | undefined> {
    return this.withPersistence("get_task", { id }, async () => {
      const result = await this.db
        .select()
        .from(tasks)
        .where(eq(tasks.id, id))
        .limit(1);
      return result[0];
    });
  }

  async createTask(insertTask: InsertTask): Promise<Task> {
    return this.withPersistence("create_task", { title: insertTask.title }, async () => {
      const result = await this.db.insert(tasks).values(insertTask).returning();
      return result[0];
    });
  }

  async updateTask(id: string, updateTask: UpdateTask): Promise<Task | undefined> {
    return this.withPersistence("update_task", { id }, async () => {
      const result = await this.db
        .update(tasks)
        .set(updateTask)
        .where(eq(tasks.id, id))
        .returning();
      return result[0];
    });
  }

  async deleteTask(id: string): Promise<boolean> {
    return this.withPersistence("delete_task", { id }, async () => {
      const result = await this.db
        .delete(tasks)
        .where(eq(tasks.id, id))
        .returning({ id: tasks.id });
      return result.length > 0;
    });
  }

  async getActiveTimerSession(): Promise<TimerSession | undefined> {
    return this.withPersistence("get_active_timer_session", {}, async () => {
      const result = await this.db
        .select()
        .from(timerSessions)
        .where(eq(timerSessions.isActive, true))
        .orderBy(desc(timerSessions.startTime))
        .limit(1);
      return result[0];
    });
  }

  async getTimerSession(id: string): Promise<TimerSession | undefined> {
    return this.withPersistence("get_timer_session", { id }, async () => {
      const result = await this.db
        .select()
        .from(timerSessions)
        .where(eq(timerSessions.id, id))
        .limit(1);
      return result[0];
    });
  }

  async getTimerSessionsByTask(taskId: string): Promise<TimerSession[]> {
    return this.withPersistence("get_timer_sessions_by_task", { taskId }, async () => {
      return await this.db
        .select()
        .from(timerSessions)
        .where(eq(timerSessions.taskId, taskId))
        .orderBy(desc(timerSessions.startTime));
    });
  }

  async createTimerSession(insertSession: InsertTimerSession): Promise<TimerSession> {
    return this.withPersistence("create_timer_session", { taskId: insertSession.taskId }, async () => {
      const now = new Date();
      const withDefaults = {
        ...insertSession,
        endTime: insertSession.endTime ?? null,
        durationSeconds: insertSession.durationSeconds ?? 0,
        isActive: insertSession.isActive ?? false,
        createdAt: now,
        updatedAt: now,
      };
      const result = await this.db
        .insert(timerSessions)
        .values(withDefaults)
        .returning();
      return result[0];
    });
  }

  async updateTimerSession(id: string, updateSession: UpdateTimerSession): Promise<TimerSession | undefined> {
    return this.withPersistence("update_timer_session", { id }, async () => {
      const now = new Date();
      const result = await this.db
        .update(timerSessions)
        .set({ ...updateSession, updatedAt: now })
        .where(eq(timerSessions.id, id))
        .returning();
      return result[0];
    });
  }

  async deleteTimerSession(id: string): Promise<boolean> {
    return this.withPersistence("delete_timer_session", { id }, async () => {
      const result = await this.db
        .delete(timerSessions)
        .where(eq(timerSessions.id, id))
        .returning({ id: timerSessions.id });
      return result.length > 0;
    });
  }

  async stopActiveTimerSessions(): Promise<void> {
    return this.withPersistence("stop_active_timer_sessions", {}, async () => {
      const db = this.db;
      await db.transaction(async (tx) => {
        const active = await tx
          .select()
          .from(timerSessions)
          .where(eq(timerSessions.isActive, true));
        if (active.length === 0) return;
        const now = new Date();
        for (const session of active) {
          const start = new Date(session.startTime);
          const elapsed = Math.max(0, Math.floor((now.getTime() - start.getTime()) / 1000));
          const total = (session.durationSeconds ?? 0) + elapsed;
          await tx
            .update(timerSessions)
            .set({ endTime: now, durationSeconds: total, isActive: false, updatedAt: now })
            .where(eq(timerSessions.id, session.id));
        }
      });
    });
  }

  async getTaskEstimate(taskId: string): Promise<TaskEstimate | undefined> {
    return this.withPersistence("get_task_estimate", { taskId }, async () => {
      const result = await this.db
        .select()
        .from(taskEstimates)
        .where(eq(taskEstimates.taskId, taskId))
        .limit(1);
      return result[0];
    });
  }

  async createTaskEstimate(insertEstimate: InsertTaskEstimate): Promise<TaskEstimate> {
    return this.withPersistence("create_task_estimate", { taskId: insertEstimate.taskId }, async () => {
      const result = await this.db.insert(taskEstimates).values(insertEstimate).returning();
      return result[0];
    });
  }

  async updateTaskEstimate(taskId: string, updateEstimate: UpdateTaskEstimate): Promise<TaskEstimate | undefined> {
    return this.withPersistence("update_task_estimate", { taskId }, async () => {
      const result = await this.db
        .update(taskEstimates)
        .set(updateEstimate)
        .where(eq(taskEstimates.taskId, taskId))
        .returning();
      return result[0];
    });
  }

  async deleteTaskEstimate(taskId: string): Promise<boolean> {
    return this.withPersistence("delete_task_estimate", { taskId }, async () => {
      const result = await this.db
        .delete(taskEstimates)
        .where(eq(taskEstimates.taskId, taskId))
        .returning({ id: taskEstimates.id });
      return result.length > 0;
    });
  }

  async getDailySummary(date: Date): Promise<DailyTimeSummary[]> {
    return this.withPersistence("get_daily_summary", { date: date.toISOString() }, async () => {
      const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);
      return await this.getDailySummaryByDateRange(startOfDay, endOfDay);
    });
  }

  async getDailySummaryByDateRange(startDate: Date, endDate: Date): Promise<DailyTimeSummary[]> {
    return this.withPersistence(
      "get_daily_summary_by_range",
      { startDate: startDate.toISOString(), endDate: endDate.toISOString() },
      async () => {
        const rows = await this.db
          .select()
          .from(timerSessions)
          .where(
            and(
              isNotNull(timerSessions.endTime),
              gte(timerSessions.startTime, startDate),
              lt(timerSessions.startTime, endDate)
            )
          );

        const summaryMap = new Map<string, DailyTimeSummary>();
        const taskIds = new Set<string>();

        for (const s of rows) {
          const dateKey = new Date(s.startTime).toISOString().split("T")[0];
          const key = `${dateKey}-${s.taskId}`;
          if (!summaryMap.has(key)) {
            summaryMap.set(key, {
              date: dateKey,
              taskId: s.taskId,
              totalSeconds: 0,
              sessionCount: 0,
            });
          }
          const curr = summaryMap.get(key)!;
          curr.totalSeconds += s.durationSeconds || 0;
          curr.sessionCount += 1;
          taskIds.add(s.taskId);
        }

        if (taskIds.size > 0) {
          const taskList = await this.db
            .select()
            .from(tasks)
            .where(inArray(tasks.id, Array.from(taskIds)));
          const idToTask = new Map(taskList.map((t) => [t.id, t] as const));
          Array.from(summaryMap.values()).forEach((item) => {
            item.task = idToTask.get(item.taskId);
          });
        }

        return Array.from(summaryMap.values()).sort((a, b) => a.date.localeCompare(b.date));
      }
    );
  }

  async getGoal(type: string, anchorDate: Date): Promise<Goal | undefined> {
    return this.withPersistence("get_goal", { type, anchorDate: anchorDate.toISOString() }, async () => {
      const dateOnly = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), anchorDate.getDate());
      const result = await this.db
        .select()
        .from(goals)
        .where(and(eq(goals.type as any, type), eq(goals.anchorDate as any, dateOnly as any)))
        .limit(1);
      return result[0];
    });
  }

  async setGoal(type: string, anchorDate: Date, value: string): Promise<Goal> {
    return this.withPersistence("set_goal", { type, anchorDate: anchorDate.toISOString() }, async () => {
      const dateOnly = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), anchorDate.getDate());
      const existing = await this.db
        .select()
        .from(goals)
        .where(and(eq(goals.type as any, type), eq(goals.anchorDate as any, dateOnly as any)))
        .limit(1);
      if (existing[0]) {
        const updated = await this.db
          .update(goals)
          .set({ value, updatedAt: new Date() } as any)
          .where(and(eq(goals.type as any, type), eq(goals.anchorDate as any, dateOnly as any)))
          .returning();
        return updated[0];
      }
      const inserted = await this.db
        .insert(goals)
        .values({ type, anchorDate: dateOnly, value } as any)
        .returning();
      return inserted[0];
    });
  }
}

export function createStorage(): IStorage {
  const usePostgres = isPostgresMode();
  // Helpful runtime log to know which storage backend is active
  console.log(`[storage] Using ${usePostgres ? 'Postgres' : 'In-Memory'} storage backend`);
  if (usePostgres) {
    return new DbStorage();
  }
  return new MemStorage();
}

export const storage: IStorage = createStorage();

// export class DbStorage implements IStorage {
//   async getUser(id: string): Promise<User | undefined> {
//     const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
//     return result[0];
//   }

//   async getUserByUsername(username: string): Promise<User | undefined> {
//     const result = await db.select().from(users).where(eq(users.username, username)).limit(1);
//     return result[0];
//   }

//   async createUser(insertUser: InsertUser): Promise<User> {
//     const result = await db.insert(users).values(insertUser).returning();
//     return result[0];
//   }

//   async getTasks(startDate?: Date, endDate?: Date): Promise<Task[]> {
//     let query = db.select().from(tasks);
    
//     if (startDate && endDate) {
//       query = query.where(
//         and(
//           gte(tasks.startTime, startDate),
//           lte(tasks.startTime, endDate)
//         )
//       );
//     }
    
//     const result = await query.orderBy(tasks.startTime);
//     return result;
//   }

//   async getTask(id: string): Promise<Task | undefined> {
//     const result = await db.select().from(tasks).where(eq(tasks.id, id)).limit(1);
//     return result[0];
//   }

//   async createTask(insertTask: InsertTask): Promise<Task> {
//     const result = await db.insert(tasks).values(insertTask).returning();
//     return result[0];
//   }

//   async updateTask(id: string, updateTask: UpdateTask): Promise<Task | undefined> {
//     const result = await db.update(tasks).set(updateTask).where(eq(tasks.id, id)).returning();
//     return result[0];
//   }

//   async deleteTask(id: string): Promise<boolean> {
//     const result = await db.delete(tasks).where(eq(tasks.id, id));
//     return result.rowCount > 0;
//   }
// }

// // Use database storage if DATABASE_URL is available, otherwise fall back to memory storage
// export const storage = process.env.DATABASE_URL ? new DbStorage() : new MemStorage();
