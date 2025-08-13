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
  scheduledDate: timestamp("scheduled_date"),
  // Persisted aggregate of all-time seconds logged across all sessions for this task
  timeLoggedSeconds: integer("time_logged_seconds").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

// Base insert schema from drizzle
const baseInsertTaskSchema = createInsertSchema(tasks).omit({
  id: true,
  createdAt: true,
});

// Extend to accept ISO strings or Date for startTime/endTime/scheduledDate by transforming to Date
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
  scheduledDate: z.preprocess((val) => {
    if (val === null || val === undefined) return val;
    if (val instanceof Date) return val;
    if (typeof val === 'string' || typeof val === 'number') {
      const d = new Date(val);
      return isNaN(d.getTime()) ? val : d;
    }
    return val;
  }, z.date().nullable()).optional(),
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

// Reviews: reflections captured per period and anchor date
export const reviewTypeEnum = z.enum(["daily", "weekly"]);
export type ReviewType = z.infer<typeof reviewTypeEnum>;
export const reviewGoalStatusEnum = z.enum(["yes", "partially", "no"]);
export type ReviewGoalStatus = z.infer<typeof reviewGoalStatusEnum>;

export const reviews = pgTable("reviews", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  type: text("type").notNull(),
  anchorDate: date("anchor_date", { mode: "date" }).notNull(),
  productivityRating: integer("productivity_rating").default(0),
  goalAchievementStatus: text("goal_achievement_status"),
  achievedGoal: boolean("achieved_goal"),
  achievedGoalReason: text("achieved_goal_reason"),
  satisfied: boolean("satisfied"),
  satisfiedReason: text("satisfied_reason"),
  improvements: text("improvements"),
  biggestWin: text("biggest_win"),
  topChallenge: text("top_challenge"),
  topDistraction: text("top_distraction"),
  nextFocusPlan: text("next_focus_plan"),
  energyLevel: integer("energy_level").default(0),
  mood: text("mood"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertReviewSchema = createInsertSchema(reviews)
  .omit({ id: true, createdAt: true, updatedAt: true })
  .extend({
    type: reviewTypeEnum,
    anchorDate: z.preprocess((val) => {
      if (val instanceof Date) return val;
      if (typeof val === "string" || typeof val === "number") {
        const d = new Date(val);
        return isNaN(d.getTime()) ? val : d;
      }
      return val;
    }, z.date()),
    productivityRating: z.number().min(0).max(10).optional(),
    goalAchievementStatus: reviewGoalStatusEnum.nullable().optional(),
    achievedGoal: z.boolean().nullable().optional(),
    achievedGoalReason: z.string().optional().nullable(),
    satisfied: z.boolean().nullable().optional(),
    satisfiedReason: z.string().optional().nullable(),
    improvements: z.string().optional().nullable(),
    biggestWin: z.string().optional().nullable(),
    topChallenge: z.string().optional().nullable(),
    topDistraction: z.string().optional().nullable(),
    nextFocusPlan: z.string().optional().nullable(),
    energyLevel: z.number().min(0).max(10).optional(),
    mood: z.string().optional().nullable(),
  });

export const updateReviewSchema = insertReviewSchema.partial().omit({ type: true, anchorDate: true });

export type InsertReview = z.infer<typeof insertReviewSchema>;
export type UpdateReview = z.infer<typeof updateReviewSchema>;
export type Review = typeof reviews.$inferSelect;

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
