// Timer-specific TypeScript interfaces and types
// This file contains types that are used across client and server for timer functionality

import { Task } from './schema';

// Core timer interfaces
export interface TimerSession {
  id: string;
  taskId: string;
  startTime: Date;
  endTime?: Date;
  durationSeconds: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface TaskEstimate {
  id: string;
  taskId: string;
  estimatedDurationMinutes: number;
  createdAt: Date;
}

export interface DailyTimeSummary {
  date: string;
  taskId: string;
  totalSeconds: number;
  sessionCount: number;
  task?: Task;
}

// Client-side state management
export interface TimerState {
  activeSession?: TimerSession;
  dailySummary: DailyTimeSummary[];
  totalDailySeconds: number;
  remainingSeconds: number; // Remaining to reach 8-hour target
  isLoading: boolean;
  error?: string;
}

// Local storage persistence
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

// API request/response types
export interface StartTimerRequest {
  taskId: string;
}

export interface StartTimerResponse {
  session: TimerSession;
  switchedFrom?: string; // Previous active task ID if switched
}

export interface PauseTimerResponse {
  session: TimerSession;
  totalElapsedSeconds: number;
}

export interface DailyTimeSummaryResponse {
  date: string;
  totalSeconds: number;
  remainingSeconds: number;
  targetSeconds: number;
  taskBreakdown: DailyTimeSummary[];
}

// Timer operation results
export interface TimerOperationResult {
  success: boolean;
  session?: TimerSession;
  error?: string;
  requiresConfirmation?: boolean;
  currentActiveTask?: string;
}

// Timer configuration
export interface TimerConfig {
  dailyTargetHours: number;
  autoSaveInterval: number; // milliseconds
  syncInterval: number; // milliseconds
  maxRetries: number;
}

// Default timer configuration
export const DEFAULT_TIMER_CONFIG: TimerConfig = {
  dailyTargetHours: 8,
  autoSaveInterval: 30000, // 30 seconds
  syncInterval: 60000, // 1 minute
  maxRetries: 3,
};

// Utility types for timer calculations
export interface TimeBreakdown {
  hours: number;
  minutes: number;
  seconds: number;
}

export interface TimerProgress {
  elapsedSeconds: number;
  estimatedSeconds?: number;
  progressPercentage: number;
  isOverEstimate: boolean;
}

// Timer status enums
export enum TimerStatus {
  IDLE = 'idle',
  RUNNING = 'running',
  PAUSED = 'paused',
  STOPPED = 'stopped',
}

export enum EstimateDuration {
  THIRTY_MINUTES = 30,
  ONE_HOUR = 60,
  TWO_HOURS = 120,
  FOUR_HOURS = 240,
  CUSTOM = -1,
}