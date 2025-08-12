import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, boolean, integer, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const lists = pgTable("lists", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  emoji: text("emoji").notNull().default("📋"),
  color: text("color"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const tasks = pgTable("tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description"),
  notes: text("notes"),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time").notNull(),
  completed: boolean("completed").default(false),
  priority: varchar("priority").notNull().default("medium"), // low, medium, high
  listId: varchar("list_id").references(() => lists.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow(),
});

// Base insert schema from drizzle
const baseInsertTaskSchema = createInsertSchema(tasks).omit({
  id: true,
  createdAt: true,
});

// Extend to accept ISO strings or Date for startTime/endTime by transforming to Date
export const insertTaskSchema = baseInsertTaskSchema.extend({
  startTime: z.preprocess((val) => {
    if (val instanceof Date) return val;
    if (typeof val === 'string' || typeof val === 'number') {
      const d = new Date(val);
      return isNaN(d.getTime()) ? val : d;
    }
    return val;
  }, z.date()),
  endTime: z.preprocess((val) => {
    if (val instanceof Date) return val;
    if (typeof val === 'string' || typeof val === 'number') {
      const d = new Date(val);
      return isNaN(d.getTime()) ? val : d;
    }
    return val;
  }, z.date()),
});

export const updateTaskSchema = insertTaskSchema.partial();

export type InsertTask = z.infer<typeof insertTaskSchema>;
export type UpdateTask = z.infer<typeof updateTaskSchema>;
export type Task = typeof tasks.$inferSelect;

// List schemas
export const insertListSchema = createInsertSchema(lists).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateListSchema = insertListSchema.partial();

export type InsertList = z.infer<typeof insertListSchema>;
export type UpdateList = z.infer<typeof updateListSchema>;
export type List = typeof lists.$inferSelect;

// Goal types (shared between client and server)
export const goalTypeEnum = z.enum(["daily", "weekly", "monthly", "yearly"]);
export type GoalType = z.infer<typeof goalTypeEnum>;

// Goals table: stores a free-form goal string per period type and period anchor date
export const goals = pgTable("goals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  type: varchar("type").notNull(),
  // Anchor date is normalized to the start of the period (Mon for weekly, 1st for monthly, Jan 1 for yearly)
  anchorDate: date("anchor_date", { mode: "date" }).notNull(),
  value: text("value").notNull().default(""),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Insert schema for goals accepts Date or ISO string for anchorDate
export const insertGoalSchema = createInsertSchema(goals)
  .omit({ id: true, createdAt: true, updatedAt: true })
  .extend({
    type: goalTypeEnum,
    anchorDate: z.preprocess((val) => {
      if (val instanceof Date) return val;
      if (typeof val === "string" || typeof val === "number") {
        const d = new Date(val);
        return isNaN(d.getTime()) ? val : d;
      }
      return val;
    }, z.date()),
  });

export const updateGoalSchema = insertGoalSchema.partial().omit({ type: true, anchorDate: true });
export type InsertGoal = z.infer<typeof insertGoalSchema>;
export type UpdateGoal = z.infer<typeof updateGoalSchema>;
export type Goal = typeof goals.$inferSelect;

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Timer sessions table
export const timerSessions = pgTable("timer_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  taskId: varchar("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time"),
  durationSeconds: integer("duration_seconds").default(0),
  isActive: boolean("is_active").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Task time estimates table
export const taskEstimates = pgTable("task_estimates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  taskId: varchar("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }).unique(),
  estimatedDurationMinutes: integer("estimated_duration_minutes").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Timer session schemas
export const insertTimerSessionSchema = createInsertSchema(timerSessions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateTimerSessionSchema = insertTimerSessionSchema.partial();

// Task estimate schemas
export const insertTaskEstimateSchema = createInsertSchema(taskEstimates).omit({
  id: true,
  createdAt: true,
});

export const updateTaskEstimateSchema = insertTaskEstimateSchema.partial();

// Timer-related types
export type InsertTimerSession = z.infer<typeof insertTimerSessionSchema>;
export type UpdateTimerSession = z.infer<typeof updateTimerSessionSchema>;
export type TimerSession = typeof timerSessions.$inferSelect;

export type InsertTaskEstimate = z.infer<typeof insertTaskEstimateSchema>;
export type UpdateTaskEstimate = z.infer<typeof updateTaskEstimateSchema>;
export type TaskEstimate = typeof taskEstimates.$inferSelect;

// Daily time summary interface (for computed data)
export interface DailyTimeSummary {
  date: string;
  taskId: string;
  totalSeconds: number;
  sessionCount: number;
  task?: Task;
}

// Timer state interface (for client-side state management)
export interface TimerState {
  activeSession?: TimerSession;
  dailySummary: DailyTimeSummary[];
  totalDailySeconds: number;
  remainingSeconds: number;
  isLoading: boolean;
}

// Local storage interfaces
export interface TimerLocalStorage {
  activeSession?: {
    taskId: string;
    startTime: string;
    accumulatedSeconds: number;
  };
  pendingEvents: TimerEvent[];
  lastSyncTime: string;
}

export interface TimerEvent {
  id: string;
  type: 'start' | 'pause' | 'resume' | 'stop';
  taskId: string;
  timestamp: string;
  synced: boolean;
}
