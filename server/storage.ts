import { type User, type InsertUser, type Task, type InsertTask, type UpdateTask } from "@shared/schema";
import { randomUUID } from "crypto";

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
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private tasks: Map<string, Task>;

  constructor() {
    this.users = new Map();
    this.tasks = new Map();
    
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
}

export const storage = new MemStorage();
