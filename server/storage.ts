import { 
  type User, type InsertUser, type Task, type InsertTask, type UpdateTask, 
  type TimerSession, type InsertTimerSession, type UpdateTimerSession,
  type TaskEstimate, type InsertTaskEstimate, type UpdateTaskEstimate,
  type DailyTimeSummary,
  tasks, users, timerSessions, taskEstimates 
} from "@shared/schema";
import { randomUUID } from "crypto";
import { db } from "./db";
import { eq, and, gte, lte } from "drizzle-orm";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Task operations
  getTasks(startDate?: Date, endDate?: Date): Promise<Task[]>;
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
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private tasks: Map<string, Task>;
  private timerSessions: Map<string, TimerSession>;
  private taskEstimates: Map<string, TaskEstimate>;

  constructor() {
    this.users = new Map();
    this.tasks = new Map();
    this.timerSessions = new Map();
    this.taskEstimates = new Map();
    
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

  async getTasks(startDate?: Date, endDate?: Date): Promise<Task[]> {
    let tasks = Array.from(this.tasks.values());
    
    if (startDate && endDate) {
      tasks = tasks.filter(task => 
        task.startTime >= startDate && task.startTime <= endDate
      );
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
        durationSeconds: session.durationSeconds + elapsedSeconds,
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
      summary.totalSeconds += session.durationSeconds;
      summary.sessionCount += 1;
    });

    return Array.from(summaryMap.values()).sort((a, b) => a.date.localeCompare(b.date));
  }
}

export const storage = new MemStorage();

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
