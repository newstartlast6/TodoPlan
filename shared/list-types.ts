// List-specific TypeScript interfaces and types
// This file contains types that are used across client and server for list functionality

import { Task, List } from './schema';
import { z } from 'zod';

// Extended List interface with computed properties
export interface ListWithTaskCount extends Omit<List, 'color'> {
  color: string | null;
  taskCount: number;
  completedTaskCount: number;
}

// API request/response types
export interface CreateListRequest {
  name: string;
  emoji: string;
}

export interface UpdateListRequest {
  name?: string;
  emoji?: string;
}

export interface CreateTaskInListRequest {
  title: string;
  description?: string;
  notes?: string;
  startTime: Date;
  endTime: Date;
  priority?: 'low' | 'medium' | 'high';
  listId: string;
}

// Client-side validation schemas
export const createListRequestSchema = z.object({
  name: z.string().min(1, 'List name is required').max(50, 'List name must be 50 characters or less'),
  emoji: z.string().min(1, 'Emoji is required'),
});

export const updateListRequestSchema = createListRequestSchema.partial();

export const createTaskInListRequestSchema = z.object({
  title: z.string().min(1, 'Task title is required'),
  description: z.string().optional(),
  notes: z.string().optional(),
  startTime: z.date(),
  endTime: z.date(),
  priority: z.enum(['low', 'medium', 'high']).optional(),
  listId: z.string().min(1, 'List ID is required'),
});

// List management state
export interface ListsState {
  lists: ListWithTaskCount[];
  selectedListId: string | null;
  selectedTaskId: string | null;
  isLoading: boolean;
  error?: string;
  isCreatingList: boolean;
  isEditingList: string | null;
}

// Emoji categories for list creation
export interface EmojiCategory {
  name: string;
  emojis: string[];
}

export const EMOJI_CATEGORIES: Record<string, EmojiCategory> = {
  work: {
    name: 'Work',
    emojis: ['💼', '📊', '📈', '💻', '📝', '📋', '🎯', '⚡', '🔧', '🚀'],
  },
  personal: {
    name: 'Personal',
    emojis: ['🏠', '👤', '❤️', '🎯', '🌟', '✨', '🎨', '📚', '🎵', '🎮'],
  },
  projects: {
    name: 'Projects',
    emojis: ['🚀', '🔧', '⚡', '🎨', '🔥', '💡', '🛠️', '📦', '🎪', '🎭'],
  },
  health: {
    name: 'Health',
    emojis: ['🏃', '🥗', '💪', '🧘', '❤️‍🩹', '🌱', '🍎', '💊', '🏥', '🧠'],
  },
  education: {
    name: 'Education',
    emojis: ['📚', '🎓', '📖', '✏️', '🔬', '🧮', '📐', '🎒', '👨‍🎓', '🏫'],
  },
  finance: {
    name: 'Finance',
    emojis: ['💰', '💳', '📊', '💹', '🏦', '💎', '🪙', '📈', '💵', '🧾'],
  },
};

// List operation results
export interface ListOperationResult {
  success: boolean;
  list?: List;
  error?: string;
}

export interface TaskMoveResult {
  success: boolean;
  movedTasks: Task[];
  error?: string;
}

// Bulk operations
export interface BulkTaskOperation {
  taskIds: string[];
  operation: 'complete' | 'delete' | 'move';
  targetListId?: string; // For move operations
}

export interface BulkOperationResult {
  success: boolean;
  affectedTaskIds: string[];
  error?: string;
}

// List filtering and sorting
export interface ListFilter {
  showCompleted: boolean;
  priority?: 'low' | 'medium' | 'high';
  dateRange?: {
    start: Date;
    end: Date;
  };
}

export interface ListSort {
  field: 'title' | 'startTime' | 'priority' | 'completed';
  direction: 'asc' | 'desc';
}

// List statistics
export interface ListStatistics {
  totalTasks: number;
  completedTasks: number;
  pendingTasks: number;
  completionRate: number;
  averageTaskDuration: number; // in minutes
  totalTimeSpent: number; // in seconds
}

// Error types specific to lists
export interface ListError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export const LIST_ERROR_CODES = {
  LIST_NOT_FOUND: 'LIST_NOT_FOUND',
  INVALID_LIST_DATA: 'INVALID_LIST_DATA',
  LIST_NAME_REQUIRED: 'LIST_NAME_REQUIRED',
  EMOJI_REQUIRED: 'EMOJI_REQUIRED',
  TASK_NOT_IN_LIST: 'TASK_NOT_IN_LIST',
  BULK_OPERATION_FAILED: 'BULK_OPERATION_FAILED',
} as const;

// List context menu actions
export interface ListContextMenuAction {
  id: string;
  label: string;
  icon?: string;
  action: (listId: string) => void;
  destructive?: boolean;
}

// Default list context menu actions
export const DEFAULT_LIST_ACTIONS: ListContextMenuAction[] = [
  {
    id: 'rename',
    label: 'Rename List',
    icon: '✏️',
    action: () => {},
  },
  {
    id: 'delete',
    label: 'Delete List',
    icon: '🗑️',
    action: () => {},
    destructive: true,
  },
];

// List panel layout configuration
export interface ListPanelConfig {
  showTaskCount: boolean;
  showCompletionRate: boolean;
  enableDragAndDrop: boolean;
  enableBulkOperations: boolean;
}

export const DEFAULT_LIST_PANEL_CONFIG: ListPanelConfig = {
  showTaskCount: true,
  showCompletionRate: true,
  enableDragAndDrop: true,
  enableBulkOperations: true,
};