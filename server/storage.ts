import { 
  type User, type InsertUser, type Task, type InsertTask, type UpdateTask, 
  type TimerSession, type InsertTimerSession, type UpdateTimerSession,
  type TaskEstimate, type InsertTaskEstimate, type UpdateTaskEstimate,
  type DailyTimeSummary,
  type Goal, type InsertGoal, type UpdateGoal,
  type List, type InsertList, type UpdateList,
  type Review, type InsertReview, type UpdateReview,
  type Note, type InsertNote, type UpdateNote,
  type ListNote, type InsertListNote, type UpdateListNote,
  tasks, users, timerSessions, taskEstimates, goals, lists, reviews, notes, listNotes 
} from "@shared/schema";
import { randomUUID } from "crypto";
import { getDb, isPostgresMode } from "./db";
import { eq, and, gte, lte, desc, lt, inArray, isNotNull, or, isNull, sql } from "drizzle-orm";
import { TimerPersistenceError } from "@shared/services/timer-errors";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // List operations (scoped)
  getLists(userId: string): Promise<List[]>;
  getList(userId: string, id: string): Promise<List | undefined>;
  createList(userId: string, list: InsertList): Promise<List>;
  updateList(userId: string, id: string, list: UpdateList): Promise<List | undefined>;
  deleteList(userId: string, id: string): Promise<boolean>;
  getTasksByList(userId: string, listId: string): Promise<Task[]>;
  
  // Task operations (scoped)
  getTasks(userId: string, startDate?: Date, endDate?: Date, includeUnscheduled?: boolean): Promise<Task[]>;
  getTask(userId: string, id: string): Promise<Task | undefined>;
  createTask(userId: string, task: InsertTask): Promise<Task>;
  updateTask(userId: string, id: string, task: UpdateTask): Promise<Task | undefined>;
  deleteTask(userId: string, id: string): Promise<boolean>;

  // Timer session operations (scoped)
  getActiveTimerSession(userId: string): Promise<TimerSession | undefined>;
  getTimerSession(userId: string, id: string): Promise<TimerSession | undefined>;
  getTimerSessionsByTask(userId: string, taskId: string): Promise<TimerSession[]>;
  createTimerSession(userId: string, session: InsertTimerSession): Promise<TimerSession>;
  updateTimerSession(userId: string, id: string, session: UpdateTimerSession): Promise<TimerSession | undefined>;
  deleteTimerSession(userId: string, id: string): Promise<boolean>;
  stopActiveTimerSessions(userId: string): Promise<void>;
  // Task logged time aggregation
  incrementTaskLoggedTime(userId: string, taskId: string, deltaSeconds: number): Promise<void>;

  // Task estimate operations (scoped)
  getTaskEstimate(userId: string, taskId: string): Promise<TaskEstimate | undefined>;
  createTaskEstimate(userId: string, estimate: InsertTaskEstimate): Promise<TaskEstimate>;
  updateTaskEstimate(userId: string, taskId: string, estimate: UpdateTaskEstimate): Promise<TaskEstimate | undefined>;
  deleteTaskEstimate(userId: string, taskId: string): Promise<boolean>;

  // Daily summary operations (scoped)
  getDailySummary(userId: string, date: Date): Promise<DailyTimeSummary[]>;
  getDailySummaryByDateRange(userId: string, startDate: Date, endDate: Date): Promise<DailyTimeSummary[]>;

  // Goals (scoped)
  getGoal(userId: string, type: string, anchorDate: Date): Promise<Goal | undefined>;
  setGoal(userId: string, type: string, anchorDate: Date, value: string): Promise<Goal>;

  // Reviews (scoped)
  getReview(userId: string, type: string, anchorDate: Date): Promise<Review | undefined>;
  setReview(
    userId: string,
    type: string,
    anchorDate: Date,
    values: Omit<InsertReview, "type" | "anchorDate"> | UpdateReview
  ): Promise<Review>;

  // Notes (scoped)
  getNote(userId: string, type: string, anchorDate: Date): Promise<Note | undefined>;
  setNote(
    userId: string,
    type: string,
    anchorDate: Date,
    values: Omit<InsertNote, "type" | "anchorDate"> | UpdateNote
  ): Promise<Note>;

  // List notes (scoped)
  getListNotes(userId: string, listId: string): Promise<ListNote[]>;
  getListNote(userId: string, id: string): Promise<ListNote | undefined>;
  createListNote(userId: string, listNote: InsertListNote): Promise<ListNote>;
  updateListNote(userId: string, id: string, listNote: UpdateListNote): Promise<ListNote | undefined>;
  deleteListNote(userId: string, id: string): Promise<boolean>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private lists: Map<string, List>;
  private tasks: Map<string, Task>;
  private timerSessions: Map<string, TimerSession>;
  private taskEstimates: Map<string, TaskEstimate>;
  private goals: Map<string, Goal>;
  private reviewsMap: Map<string, Review>;
  private notesMap: Map<string, Note>;
  private listNotesMap: Map<string, ListNote>;

  constructor() {
    this.users = new Map();
    this.lists = new Map();
    this.tasks = new Map();
    this.timerSessions = new Map();
    this.taskEstimates = new Map();
    this.goals = new Map();
    this.reviewsMap = new Map();
    this.notesMap = new Map();
    this.listNotesMap = new Map();
    // Initialize with some sample tasks for demonstration
    this.initializeSampleData();
  }

  private initializeSampleData() {
    const devUserId = process.env.DEV_USER_ID || 'dev-user-00000000-0000-0000-0000-000000000000';
    console.log('Initializing sample data for user:', devUserId);
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
        timeLoggedSeconds: 0,
        dayOrder: null,
        userId: devUserId,
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
        timeLoggedSeconds: 0,
        dayOrder: null,
        userId: devUserId,
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
        timeLoggedSeconds: 0,
        dayOrder: null,
        userId: devUserId,
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
        timeLoggedSeconds: 0,
        dayOrder: null,
        userId: devUserId,
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
        timeLoggedSeconds: 0,
        dayOrder: null,
        userId: devUserId,
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
        timeLoggedSeconds: 0,
        dayOrder: null,
        userId: devUserId,
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
        timeLoggedSeconds: 0,
        dayOrder: null,
        userId: devUserId,
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
        timeLoggedSeconds: 0,
        dayOrder: null,
        userId: devUserId,
      },
    ];
    // Ensure default timeLoggedSeconds
    sampleTasks.forEach(task => this.tasks.set(task.id, { ...task, timeLoggedSeconds: (task as any).timeLoggedSeconds ?? 0, dayOrder: (task as any).dayOrder ?? null } as Task));
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
  async getLists(userId: string): Promise<List[]> {
    return Array.from(this.lists.values()).filter(l => l.userId === userId).sort((a, b) => {
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return aTime - bTime;
    });
  }

  async getList(userId: string, id: string): Promise<List | undefined> {
    const l = this.lists.get(id);
    return l && l.userId === userId ? l : undefined;
  }

  async createList(userId: string, insertList: InsertList): Promise<List> {
    const id = randomUUID();
    const list: List = {
      ...insertList,
      id,
      emoji: insertList.emoji ?? '📋',
      color: insertList.color ?? null,
      type: insertList.type ?? 'todo',
      userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.lists.set(id, list);
    return list;
  }

  async updateList(userId: string, id: string, updateList: UpdateList): Promise<List | undefined> {
    const existingList = await this.getList(userId, id);
    if (!existingList) return undefined;
    
    const updatedList: List = { 
      ...existingList, 
      ...updateList,
      updatedAt: new Date()
    };
    this.lists.set(id, updatedList);
    return updatedList;
  }

  async deleteList(userId: string, id: string): Promise<boolean> {
    // Set list_id to null for all tasks in this list
    Array.from(this.tasks.values())
      .filter(task => task.listId === id && task.userId === userId)
      .forEach(task => {
        const updatedTask = { ...task, listId: null };
        this.tasks.set(task.id, updatedTask);
      });
    
    const l = this.lists.get(id);
    if (!l || l.userId !== userId) return false;
    return this.lists.delete(id);
  }

  async getTasksByList(userId: string, listId: string): Promise<Task[]> {
    return Array.from(this.tasks.values())
      .filter(task => task.listId === listId && task.userId === userId)
      .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
  }

  async getTasks(userId: string, startDate?: Date, endDate?: Date, includeUnscheduled?: boolean): Promise<Task[]> {
    let tasks = Array.from(this.tasks.values()).filter(t => t.userId === userId);
    
    if (startDate && endDate) {
      tasks = tasks.filter(task => {
        const inStartRange = task.startTime >= startDate && task.startTime <= endDate;
        const scheduled = task.scheduledDate ? (task.scheduledDate >= startDate && task.scheduledDate <= endDate) : false;
        return inStartRange || scheduled;
      });
      if (includeUnscheduled) {
        // Also include explicitly unscheduled tasks
        const unscheduled = Array.from(this.tasks.values()).filter(t => !t.scheduledDate && t.userId === userId);
        const byId = new Map(tasks.map(t => [t.id, t] as const));
        for (const t of unscheduled) {
          if (!byId.has(t.id)) {
            byId.set(t.id, t);
          }
        }
        tasks = Array.from(byId.values());
      }
    }
    
    // Sort primarily by scheduledDate date-only + dayOrder when available, then fallback to startTime
    return tasks.sort((a, b) => {
      const aHasSched = Boolean(a.scheduledDate);
      const bHasSched = Boolean(b.scheduledDate);
      if (aHasSched && bHasSched) {
        const aKey = new Date(a.scheduledDate!.getFullYear(), a.scheduledDate!.getMonth(), a.scheduledDate!.getDate()).getTime();
        const bKey = new Date(b.scheduledDate!.getFullYear(), b.scheduledDate!.getMonth(), b.scheduledDate!.getDate()).getTime();
        if (aKey !== bKey) return aKey - bKey;
        const aOrder = (a as any).dayOrder;
        const bOrder = (b as any).dayOrder;
        const aHasOrder = typeof aOrder === 'number';
        const bHasOrder = typeof bOrder === 'number';
        if (aHasOrder && bHasOrder) return aOrder - bOrder;
        if (aHasOrder) return -1;
        if (bHasOrder) return 1;
      } else if (aHasSched !== bHasSched) {
        // Keep unscheduled after scheduled when within a date range
        return aHasSched ? -1 : 1;
      }
      return a.startTime.getTime() - b.startTime.getTime();
    });
  }

  async getTask(userId: string, id: string): Promise<Task | undefined> {
    const t = this.tasks.get(id);
    return t && t.userId === userId ? t : undefined;
  }

  async createTask(userId: string, insertTask: InsertTask): Promise<Task> {
    const id = randomUUID();
    const task: Task = {
      ...insertTask,
      id,
      userId,
      createdAt: new Date(),
      description: insertTask.description || null,
      notes: insertTask.notes || null,
      completed: insertTask.completed || false,
      priority: insertTask.priority || "medium",
      listId: insertTask.listId ?? null,
      scheduledDate: (insertTask as any).scheduledDate ?? null,
      timeLoggedSeconds: (insertTask as any).timeLoggedSeconds ?? 0,
      dayOrder: (insertTask as any).dayOrder ?? null,
    };
    this.tasks.set(id, task);
    return task;
  }

  async updateTask(userId: string, id: string, updateTask: UpdateTask): Promise<Task | undefined> {
    const existingTask = await this.getTask(userId, id);
    if (!existingTask) return undefined;
    
    const updatedTask: Task = { ...existingTask, ...updateTask };
    this.tasks.set(id, updatedTask);
    return updatedTask;
  }

  async deleteTask(userId: string, id: string): Promise<boolean> {
    const t = this.tasks.get(id);
    if (!t || t.userId !== userId) return false;
    return this.tasks.delete(id);
  }

  // Timer session operations
  async getActiveTimerSession(userId: string): Promise<TimerSession | undefined> {
    return Array.from(this.timerSessions.values()).find(session => session.isActive && (session as any).userId === userId);
  }

  async getTimerSession(userId: string, id: string): Promise<TimerSession | undefined> {
    const s = this.timerSessions.get(id);
    return s && (s as any).userId === userId ? s : undefined;
  }

  async getTimerSessionsByTask(userId: string, taskId: string): Promise<TimerSession[]> {
    return Array.from(this.timerSessions.values())
      .filter(session => session.taskId === taskId && (session as any).userId === userId)
      .sort((a, b) => b.startTime.getTime() - a.startTime.getTime());
  }

  async createTimerSession(userId: string, insertSession: InsertTimerSession): Promise<TimerSession> {
    const id = randomUUID();
    const session: TimerSession = {
      ...insertSession,
      id,
      endTime: insertSession.endTime ?? null,
      durationSeconds: insertSession.durationSeconds ?? 0,
      isActive: insertSession.isActive ?? false,
      userId: userId as any,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.timerSessions.set(id, session);
    return session;
  }

  async updateTimerSession(userId: string, id: string, updateSession: UpdateTimerSession): Promise<TimerSession | undefined> {
    const existingSession = await this.getTimerSession(userId, id);
    if (!existingSession) return undefined;
    
    const updatedSession: TimerSession = { 
      ...existingSession, 
      ...updateSession,
      updatedAt: new Date()
    };
    this.timerSessions.set(id, updatedSession);
    return updatedSession;
  }

  async deleteTimerSession(userId: string, id: string): Promise<boolean> {
    const s = this.timerSessions.get(id);
    if (!s || (s as any).userId !== userId) return false;
    return this.timerSessions.delete(id);
  }

  async stopActiveTimerSessions(userId: string): Promise<void> {
    const activeSessions = Array.from(this.timerSessions.values()).filter(session => session.isActive && (session as any).userId === userId);
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
      // Also increment the associated task's logged time
      const task = this.tasks.get(session.taskId);
      if (task) {
        this.tasks.set(session.taskId, { ...task, timeLoggedSeconds: (task.timeLoggedSeconds ?? 0) + Math.max(0, elapsedSeconds) });
      }
    });
  }

  async incrementTaskLoggedTime(userId: string, taskId: string, deltaSeconds: number): Promise<void> {
    const task = await this.getTask(userId, taskId);
    if (!task) return;
    const add = Math.max(0, Math.floor(deltaSeconds || 0));
    this.tasks.set(taskId, { ...task, timeLoggedSeconds: (task.timeLoggedSeconds ?? 0) + add });
  }

  // Task estimate operations
  async getTaskEstimate(userId: string, taskId: string): Promise<TaskEstimate | undefined> {
    return Array.from(this.taskEstimates.values()).find(estimate => estimate.taskId === taskId && (estimate as any).userId === userId);
  }

  async createTaskEstimate(userId: string, insertEstimate: InsertTaskEstimate): Promise<TaskEstimate> {
    const id = randomUUID();
    const estimate: TaskEstimate = {
      ...insertEstimate,
      id,
      userId: userId as any,
      createdAt: new Date(),
    };
    this.taskEstimates.set(id, estimate);
    return estimate;
  }

  async updateTaskEstimate(userId: string, taskId: string, updateEstimate: UpdateTaskEstimate): Promise<TaskEstimate | undefined> {
    const existingEstimate = Array.from(this.taskEstimates.values()).find(est => est.taskId === taskId && (est as any).userId === userId);
    if (!existingEstimate) return undefined;
    
    const updatedEstimate: TaskEstimate = { ...existingEstimate, ...updateEstimate };
    this.taskEstimates.set(existingEstimate.id, updatedEstimate);
    return updatedEstimate;
  }

  async deleteTaskEstimate(userId: string, taskId: string): Promise<boolean> {
    const estimate = Array.from(this.taskEstimates.entries()).find(([_, est]) => est.taskId === taskId && (est as any).userId === userId);
    if (!estimate) return false;
    
    return this.taskEstimates.delete(estimate[0]);
  }

  // Daily summary operations
  async getDailySummary(userId: string, date: Date): Promise<DailyTimeSummary[]> {
    const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);
    
    return this.getDailySummaryByDateRange(userId, startOfDay, endOfDay);
  }

  async getDailySummaryByDateRange(userId: string, startDate: Date, endDate: Date): Promise<DailyTimeSummary[]> {
    const sessions = Array.from(this.timerSessions.values())
      .filter(session => 
        session.endTime && (session as any).userId === userId &&
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

  async getGoal(userId: string, type: string, anchorDate: Date): Promise<Goal | undefined> {
    const key = this.goalKey(type, anchorDate);
    const g = this.goals.get(key);
    return g && (g as any).userId === userId ? g : undefined;
  }

  async setGoal(userId: string, type: string, anchorDate: Date, value: string): Promise<Goal> {
    const key = this.goalKey(type, anchorDate);
    const existing = this.goals.get(key);
    const base: Goal = existing ?? {
      id: randomUUID(),
      type,
      anchorDate: new Date(anchorDate.getFullYear(), anchorDate.getMonth(), anchorDate.getDate()),
      value: "",
      userId: userId as any,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as Goal;
    const updated: Goal = { ...base, value, updatedAt: new Date() };
    this.goals.set(key, updated);
    return updated;
  }

  private reviewKey(type: string, anchorDate: Date): string {
    const d = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), anchorDate.getDate());
    return `${type}:${d.toISOString().slice(0, 10)}`;
  }

  async getReview(userId: string, type: string, anchorDate: Date): Promise<Review | undefined> {
    const key = this.reviewKey(type, anchorDate);
    const r = this.reviewsMap.get(key);
    return r && (r as any).userId === userId ? r : undefined;
  }

  async setReview(
    userId: string,
    type: string,
    anchorDate: Date,
    values: Omit<InsertReview, "type" | "anchorDate"> | UpdateReview
  ): Promise<Review> {
    const key = this.reviewKey(type, anchorDate);
    const existing = this.reviewsMap.get(key);
    const base: Review = existing ?? ({
      id: randomUUID(),
      type,
      anchorDate: new Date(anchorDate.getFullYear(), anchorDate.getMonth(), anchorDate.getDate()),
      productivityRating: 0,
      achievedGoal: null,
      achievedGoalReason: null,
      satisfied: null,
      satisfiedReason: null,
      improvements: null,
      biggestWin: null,
      topChallenge: null,
      topDistraction: null,
      nextFocusPlan: null,
      energyLevel: 0,
      mood: null,
      goalAchievementStatus: null as any,
      userId: userId as any,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as unknown as Review);
    const updated: Review = {
      ...base,
      ...values,
      updatedAt: new Date(),
    } as Review;
    this.reviewsMap.set(key, updated);
    return updated;
  }

  private noteKey(type: string, anchorDate: Date): string {
    const d = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), anchorDate.getDate());
    return `${type}:${d.toISOString().slice(0, 10)}`;
  }

  async getNote(userId: string, type: string, anchorDate: Date): Promise<Note | undefined> {
    const key = this.noteKey(type, anchorDate);
    const n = this.notesMap.get(key);
    if (!n || (n as any).userId !== userId) return undefined;
    return { ...n, anchorDate } as Note;
  }

  async setNote(
    userId: string,
    type: string,
    anchorDate: Date,
    values: Omit<InsertNote, "type" | "anchorDate"> | UpdateNote
  ): Promise<Note> {
    const key = this.noteKey(type, anchorDate);
    const existing = this.notesMap.get(key);
    const base: Note = existing ?? ({
      id: randomUUID(),
      type,
      anchorDate,
      content: null,
       userId: userId as any,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as unknown as Note);
    const updated: Note = { ...base, ...values, updatedAt: new Date() } as Note;
    this.notesMap.set(key, updated);
    return updated;
  }

  // List notes operations
  async getListNotes(userId: string, listId: string): Promise<ListNote[]> {
    return Array.from(this.listNotesMap.values())
      .filter(note => note.userId === userId && note.listId === listId)
      .sort((a, b) => {
        const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return aTime - bTime;
      });
  }

  async getListNote(userId: string, id: string): Promise<ListNote | undefined> {
    const note = this.listNotesMap.get(id);
    return note && note.userId === userId ? note : undefined;
  }

  async createListNote(userId: string, insertListNote: InsertListNote): Promise<ListNote> {
    const id = randomUUID();
    const note: ListNote = {
      ...insertListNote,
      id,
      userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.listNotesMap.set(id, note);
    return note;
  }

  async updateListNote(userId: string, id: string, updateListNote: UpdateListNote): Promise<ListNote | undefined> {
    const existingNote = await this.getListNote(userId, id);
    if (!existingNote) return undefined;
    
    const updatedNote: ListNote = { 
      ...existingNote, 
      ...updateListNote,
      updatedAt: new Date()
    };
    this.listNotesMap.set(id, updatedNote);
    return updatedNote;
  }

  async deleteListNote(userId: string, id: string): Promise<boolean> {
    const note = this.listNotesMap.get(id);
    if (!note || note.userId !== userId) return false;
    return this.listNotesMap.delete(id);
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
  async getLists(userId: string): Promise<List[]> {
    console.log('Fetching lists', userId);
    return this.withPersistence("get_lists", {}, async () => {
      console.log('Fetching lists', userId);
      return await this.db.select().from(lists).where(eq(lists.userId as any, userId as any)).orderBy(lists.createdAt);
    });
  }

  async getList(userId: string, id: string): Promise<List | undefined> {
    return this.withPersistence("get_list", { id }, async () => {
      const result = await this.db
        .select()
        .from(lists)
        .where(and(eq(lists.id, id), eq(lists.userId as any, userId as any)))
        .limit(1);
      return result[0];
    });
  }

  async createList(userId: string, insertList: InsertList): Promise<List> {
    return this.withPersistence("create_list", { name: insertList.name }, async () => {
      const result = await this.db.insert(lists).values({ ...insertList, userId } as any).returning();
      return result[0];
    });
  }

  async updateList(userId: string, id: string, updateList: UpdateList): Promise<List | undefined> {
    return this.withPersistence("update_list", { id }, async () => {
      const result = await this.db
        .update(lists)
        .set({ ...updateList, updatedAt: new Date() })
        .where(and(eq(lists.id, id), eq(lists.userId as any, userId as any)))
        .returning();
      return result[0];
    });
  }

  async deleteList(userId: string, id: string): Promise<boolean> {
    return this.withPersistence("delete_list", { id }, async () => {
      const db = this.db;
      return await db.transaction(async (tx) => {
        // Set list_id to null for all tasks in this list
        await tx
          .update(tasks)
          .set({ listId: null })
          .where(and(eq(tasks.listId, id), eq(tasks.userId as any, userId as any)));
        
        // Delete the list
        const result = await tx
          .delete(lists)
          .where(and(eq(lists.id, id), eq(lists.userId as any, userId as any)))
          .returning({ id: lists.id });
        
        return result.length > 0;
      });
    });
  }

  async getTasksByList(userId: string, listId: string): Promise<Task[]> {
    return this.withPersistence("get_tasks_by_list", { listId }, async () => {
      return await this.db
        .select()
        .from(tasks)
        .where(and(eq(tasks.listId, listId), eq(tasks.userId as any, userId as any)))
        .orderBy(tasks.startTime);
    });
  }

  async getTasks(userId: string, startDate?: Date, endDate?: Date, includeUnscheduled?: boolean): Promise<Task[]> {
    return this.withPersistence("get_tasks", {
      startDate: startDate?.toISOString(),
      endDate: endDate?.toISOString(),
      includeUnscheduled: !!includeUnscheduled,
    }, async () => {
      if (startDate && endDate) {
        const baseWhere = or(
          and(eq(tasks.userId as any, userId as any), gte(tasks.startTime, startDate), lte(tasks.startTime, endDate)),
          and(eq(tasks.userId as any, userId as any), gte(tasks.scheduledDate as any, startDate as any), lte(tasks.scheduledDate as any, endDate as any))
        );
        const whereClause = includeUnscheduled
          ? or(baseWhere, and(eq(tasks.userId as any, userId as any), isNull(tasks.scheduledDate as any)))
          : baseWhere;
        return await this.db
          .select()
          .from(tasks)
          .where(whereClause)
          .orderBy(tasks.startTime);
      }
      // No date filter
      return await this.db.select().from(tasks).where(eq(tasks.userId as any, userId as any)).orderBy(tasks.startTime);
    });
  }

  async getTask(userId: string, id: string): Promise<Task | undefined> {
    return this.withPersistence("get_task", { id }, async () => {
      const result = await this.db
        .select()
        .from(tasks)
        .where(and(eq(tasks.id, id), eq(tasks.userId as any, userId as any)))
        .limit(1);
      return result[0];
    });
  }

  async createTask(userId: string, insertTask: InsertTask): Promise<Task> {
    return this.withPersistence("create_task", { title: insertTask.title }, async () => {
      const result = await this.db.insert(tasks).values({ ...insertTask, userId } as any).returning();
      return result[0];
    });
  }

  async updateTask(userId: string, id: string, updateTask: UpdateTask): Promise<Task | undefined> {
    return this.withPersistence("update_task", { id }, async () => {
      const result = await this.db
        .update(tasks)
        .set(updateTask)
        .where(and(eq(tasks.id, id), eq(tasks.userId as any, userId as any)))
        .returning();
      return result[0];
    });
  }

  async deleteTask(userId: string, id: string): Promise<boolean> {
    return this.withPersistence("delete_task", { id }, async () => {
      const result = await this.db
        .delete(tasks)
        .where(and(eq(tasks.id, id), eq(tasks.userId as any, userId as any)))
        .returning({ id: tasks.id });
      return result.length > 0;
    });
  }

  async getActiveTimerSession(userId: string): Promise<TimerSession | undefined> {
    return this.withPersistence("get_active_timer_session", {}, async () => {
      const result = await this.db
        .select()
        .from(timerSessions)
        .where(and(eq(timerSessions.isActive, true), eq(timerSessions.userId as any, userId as any)))
        .orderBy(desc(timerSessions.startTime))
        .limit(1);
      return result[0];
    });
  }

  async getTimerSession(userId: string, id: string): Promise<TimerSession | undefined> {
    return this.withPersistence("get_timer_session", { id }, async () => {
      const result = await this.db
        .select()
        .from(timerSessions)
        .where(and(eq(timerSessions.id, id), eq(timerSessions.userId as any, userId as any)))
        .limit(1);
      return result[0];
    });
  }

  async getTimerSessionsByTask(userId: string, taskId: string): Promise<TimerSession[]> {
    return this.withPersistence("get_timer_sessions_by_task", { taskId }, async () => {
      return await this.db
        .select()
        .from(timerSessions)
        .where(and(eq(timerSessions.taskId, taskId), eq(timerSessions.userId as any, userId as any)))
        .orderBy(desc(timerSessions.startTime));
    });
  }

  async createTimerSession(userId: string, insertSession: InsertTimerSession): Promise<TimerSession> {
    return this.withPersistence("create_timer_session", { taskId: insertSession.taskId }, async () => {
      const now = new Date();
      const withDefaults = {
        ...insertSession,
        endTime: insertSession.endTime ?? null,
        durationSeconds: insertSession.durationSeconds ?? 0,
        isActive: insertSession.isActive ?? false,
        userId: userId as any,
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

  async updateTimerSession(userId: string, id: string, updateSession: UpdateTimerSession): Promise<TimerSession | undefined> {
    return this.withPersistence("update_timer_session", { id }, async () => {
      const now = new Date();
      const result = await this.db
        .update(timerSessions)
        .set({ ...updateSession, updatedAt: now })
        .where(and(eq(timerSessions.id, id), eq(timerSessions.userId as any, userId as any)))
        .returning();
      return result[0];
    });
  }

  async deleteTimerSession(userId: string, id: string): Promise<boolean> {
    return this.withPersistence("delete_timer_session", { id }, async () => {
      const result = await this.db
        .delete(timerSessions)
        .where(and(eq(timerSessions.id, id), eq(timerSessions.userId as any, userId as any)))
        .returning({ id: timerSessions.id });
      return result.length > 0;
    });
  }

  async stopActiveTimerSessions(userId: string): Promise<void> {
    return this.withPersistence("stop_active_timer_sessions", {}, async () => {
      const db = this.db;
      await db.transaction(async (tx) => {
        const active = await tx
          .select()
          .from(timerSessions)
          .where(and(eq(timerSessions.isActive, true), eq(timerSessions.userId as any, userId as any)));
        if (active.length === 0) return;
        const now = new Date();
        for (const session of active) {
          const start = new Date(session.startTime);
          const elapsed = Math.max(0, Math.floor((now.getTime() - start.getTime()) / 1000));
          const total = (session.durationSeconds ?? 0) + elapsed;
          await tx
            .update(timerSessions)
            .set({ endTime: now, durationSeconds: total, isActive: false, updatedAt: now })
            .where(and(eq(timerSessions.id, session.id), eq(timerSessions.userId as any, userId as any)));
          // Increment the task's logged time
          await tx
            .update(tasks)
            .set({ timeLoggedSeconds: sql`${tasks.timeLoggedSeconds} + ${elapsed}` } as any)
            .where(and(eq(tasks.id, session.taskId), eq(tasks.userId as any, userId as any)));
        }
      });
    });
  }

  async incrementTaskLoggedTime(userId: string, taskId: string, deltaSeconds: number): Promise<void> {
    return this.withPersistence("increment_task_logged_time", { taskId, deltaSeconds }, async () => {
      const add = Math.max(0, Math.floor(deltaSeconds || 0));
      await this.db
        .update(tasks)
        .set({ timeLoggedSeconds: sql`${tasks.timeLoggedSeconds} + ${add}` } as any)
        .where(and(eq(tasks.id, taskId), eq(tasks.userId as any, userId as any)));
    });
  }

  async getTaskEstimate(userId: string, taskId: string): Promise<TaskEstimate | undefined> {
    return this.withPersistence("get_task_estimate", { taskId }, async () => {
      const result = await this.db
        .select()
        .from(taskEstimates)
        .where(and(eq(taskEstimates.taskId, taskId), eq(taskEstimates.userId as any, userId as any)))
        .limit(1);
      return result[0];
    });
  }

  async createTaskEstimate(userId: string, insertEstimate: InsertTaskEstimate): Promise<TaskEstimate> {
    return this.withPersistence("create_task_estimate", { taskId: insertEstimate.taskId }, async () => {
      const result = await this.db.insert(taskEstimates).values({ ...insertEstimate, userId } as any).returning();
      return result[0];
    });
  }

  async updateTaskEstimate(userId: string, taskId: string, updateEstimate: UpdateTaskEstimate): Promise<TaskEstimate | undefined> {
    return this.withPersistence("update_task_estimate", { taskId }, async () => {
      const result = await this.db
        .update(taskEstimates)
        .set(updateEstimate)
        .where(and(eq(taskEstimates.taskId, taskId), eq(taskEstimates.userId as any, userId as any)))
        .returning();
      return result[0];
    });
  }

  async deleteTaskEstimate(userId: string, taskId: string): Promise<boolean> {
    return this.withPersistence("delete_task_estimate", { taskId }, async () => {
      const result = await this.db
        .delete(taskEstimates)
        .where(and(eq(taskEstimates.taskId, taskId), eq(taskEstimates.userId as any, userId as any)))
        .returning({ id: taskEstimates.id });
      return result.length > 0;
    });
  }

  async getDailySummary(userId: string, date: Date): Promise<DailyTimeSummary[]> {
    return this.withPersistence("get_daily_summary", { date: date.toISOString() }, async () => {
      const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);
      return await this.getDailySummaryByDateRange(userId, startOfDay, endOfDay);
    });
  }

  async getDailySummaryByDateRange(userId: string, startDate: Date, endDate: Date): Promise<DailyTimeSummary[]> {
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
              eq(timerSessions.userId as any, userId as any),
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
            .where(and(inArray(tasks.id, Array.from(taskIds)), eq(tasks.userId as any, userId as any)));
          const idToTask = new Map(taskList.map((t) => [t.id, t] as const));
          Array.from(summaryMap.values()).forEach((item) => {
            item.task = idToTask.get(item.taskId);
          });
        }

        return Array.from(summaryMap.values()).sort((a, b) => a.date.localeCompare(b.date));
      }
    );
  }

  async getGoal(userId: string, type: string, anchorDate: Date): Promise<Goal | undefined> {
    return this.withPersistence("get_goal", { type, anchorDate: anchorDate.toISOString() }, async () => {
      const dateOnly = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), anchorDate.getDate());
      const result = await this.db
        .select()
        .from(goals)
        .where(and(eq(goals.type as any, type), eq(goals.anchorDate as any, dateOnly as any), eq(goals.userId as any, userId as any)))
        .limit(1);
      return result[0];
    });
  }

  async setGoal(userId: string, type: string, anchorDate: Date, value: string): Promise<Goal> {
    return this.withPersistence("set_goal", { type, anchorDate: anchorDate.toISOString() }, async () => {
      const dateOnly = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), anchorDate.getDate());
      const existing = await this.db
        .select()
        .from(goals)
        .where(and(eq(goals.type as any, type), eq(goals.anchorDate as any, dateOnly as any), eq(goals.userId as any, userId as any)))
        .limit(1);
      if (existing[0]) {
        const updated = await this.db
          .update(goals)
          .set({ value, updatedAt: new Date() } as any)
          .where(and(eq(goals.type as any, type), eq(goals.anchorDate as any, dateOnly as any), eq(goals.userId as any, userId as any)))
          .returning();
        return updated[0];
      }
      const inserted = await this.db
        .insert(goals)
        .values({ type, anchorDate: dateOnly, value, userId } as any)
        .returning();
      return inserted[0];
    });
  }

  async getReview(userId: string, type: string, anchorDate: Date): Promise<Review | undefined> {
    return this.withPersistence("get_review", { type, anchorDate: anchorDate.toISOString() }, async () => {
      const dateOnly = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), anchorDate.getDate());
      const result = await this.db
        .select()
        .from(reviews)
        .where(and(eq(reviews.type as any, type), eq(reviews.anchorDate as any, dateOnly as any), eq(reviews.userId as any, userId as any)))
        .limit(1);
      return result[0] as unknown as Review | undefined;
    });
  }

  async setReview(
    userId: string,
    type: string,
    anchorDate: Date,
    values: Omit<InsertReview, "type" | "anchorDate"> | UpdateReview
  ): Promise<Review> {
    return this.withPersistence("set_review", { type, anchorDate: anchorDate.toISOString() }, async () => {
      const dateOnly = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), anchorDate.getDate());
      const existing = await this.db
        .select()
        .from(reviews)
        .where(and(eq(reviews.type as any, type), eq(reviews.anchorDate as any, dateOnly as any), eq(reviews.userId as any, userId as any)))
        .limit(1);
      if (existing[0]) {
        const updated = await this.db
          .update(reviews)
          .set({ ...values, updatedAt: new Date() } as any)
          .where(and(eq(reviews.type as any, type), eq(reviews.anchorDate as any, dateOnly as any), eq(reviews.userId as any, userId as any)))
          .returning();
        return updated[0] as unknown as Review;
      }
      const inserted = await this.db
        .insert(reviews)
        .values({ type, anchorDate: dateOnly, ...values, userId } as any)
        .returning();
      return inserted[0] as unknown as Review;
    });
  }

  async getNote(userId: string, type: string, anchorDate: Date): Promise<Note | undefined> {
    return this.withPersistence("get_note", { type, anchorDate: anchorDate.toISOString() }, async () => {
      const result = await this.db
        .select()
        .from(notes)
        .where(and(eq(notes.type as any, type), eq(notes.anchorDate as any, anchorDate as any), eq(notes.userId as any, userId as any)))
        .limit(1);
      return result[0] as unknown as Note | undefined;
    });
  }

  async setNote(
    userId: string,
    type: string,
    anchorDate: Date,
    values: Omit<InsertNote, "type" | "anchorDate"> | UpdateNote
  ): Promise<Note> {
    return this.withPersistence("set_note", { type, anchorDate: anchorDate.toISOString() }, async () => {
      const existing = await this.db
        .select()
        .from(notes)
        .where(and(eq(notes.type as any, type), eq(notes.anchorDate as any, anchorDate as any), eq(notes.userId as any, userId as any)))
        .limit(1);
      if (existing[0]) {
        const updated = await this.db
          .update(notes)
          .set({ ...values, updatedAt: new Date() } as any)
          .where(and(eq(notes.type as any, type), eq(notes.anchorDate as any, anchorDate as any), eq(notes.userId as any, userId as any)))
          .returning();
        return updated[0] as unknown as Note;
      }
      const inserted = await this.db
        .insert(notes)
        .values({ type, anchorDate, ...values, userId } as any)
        .returning();
      return inserted[0] as unknown as Note;
    });
  }

  // List notes operations
  async getListNotes(userId: string, listId: string): Promise<ListNote[]> {
    return this.withPersistence("get_list_notes", { listId }, async () => {
      return await this.db
        .select()
        .from(listNotes)
        .where(and(eq(listNotes.listId, listId), eq(listNotes.userId, userId)))
        .orderBy(listNotes.createdAt);
    });
  }

  async getListNote(userId: string, id: string): Promise<ListNote | undefined> {
    return this.withPersistence("get_list_note", { id }, async () => {
      const result = await this.db
        .select()
        .from(listNotes)
        .where(and(eq(listNotes.id, id), eq(listNotes.userId, userId)))
        .limit(1);
      return result[0];
    });
  }

  async createListNote(userId: string, insertListNote: InsertListNote): Promise<ListNote> {
    return this.withPersistence("create_list_note", { title: insertListNote.title }, async () => {
      const result = await this.db.insert(listNotes).values({ ...insertListNote, userId }).returning();
      return result[0];
    });
  }

  async updateListNote(userId: string, id: string, updateListNote: UpdateListNote): Promise<ListNote | undefined> {
    return this.withPersistence("update_list_note", { id }, async () => {
      const result = await this.db
        .update(listNotes)
        .set({ ...updateListNote, updatedAt: new Date() })
        .where(and(eq(listNotes.id, id), eq(listNotes.userId, userId)))
        .returning();
      return result[0];
    });
  }

  async deleteListNote(userId: string, id: string): Promise<boolean> {
    return this.withPersistence("delete_list_note", { id }, async () => {
      const result = await this.db
        .delete(listNotes)
        .where(and(eq(listNotes.id, id), eq(listNotes.userId, userId)))
        .returning({ id: listNotes.id });
      return result.length > 0;
    });
  }
}

export function createStorage(): IStorage {
  const usePostgres = true;
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
