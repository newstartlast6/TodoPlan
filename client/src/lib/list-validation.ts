// Client-side validation functions for list operations
import { z } from 'zod';
import { 
  createListRequestSchema, 
  updateListRequestSchema, 
  createTaskInListRequestSchema,
  type CreateListRequest,
  type UpdateListRequest,
  type CreateTaskInListRequest,
  LIST_ERROR_CODES
} from '@shared/list-types';

// Validation result type
export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  errors?: string[];
}

// List validation functions
export function validateCreateListRequest(data: unknown): ValidationResult<CreateListRequest> {
  try {
    const validatedData = createListRequestSchema.parse(data);
    return {
      success: true,
      data: validatedData,
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        errors: error.errors.map(err => err.message),
      };
    }
    return {
      success: false,
      errors: ['Invalid list data'],
    };
  }
}

export function validateUpdateListRequest(data: unknown): ValidationResult<UpdateListRequest> {
  try {
    const validatedData = updateListRequestSchema.parse(data);
    return {
      success: true,
      data: validatedData,
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        errors: error.errors.map(err => err.message),
      };
    }
    return {
      success: false,
      errors: ['Invalid list update data'],
    };
  }
}

export function validateCreateTaskInListRequest(data: unknown): ValidationResult<CreateTaskInListRequest> {
  try {
    const validatedData = createTaskInListRequestSchema.parse(data);
    return {
      success: true,
      data: validatedData,
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        errors: error.errors.map(err => err.message),
      };
    }
    return {
      success: false,
      errors: ['Invalid task data'],
    };
  }
}

// Emoji validation
export function isValidEmoji(emoji: string): boolean {
  // Basic emoji validation - checks if string contains emoji characters
  const emojiRegex = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/u;
  return emojiRegex.test(emoji) && emoji.length <= 4; // Allow for complex emojis
}

// List name validation
export function validateListName(name: string): ValidationResult<string> {
  if (!name || name.trim().length === 0) {
    return {
      success: false,
      errors: ['List name is required'],
    };
  }
  
  if (name.length > 50) {
    return {
      success: false,
      errors: ['List name must be 50 characters or less'],
    };
  }
  
  return {
    success: true,
    data: name.trim(),
  };
}

// Color validation (hex color)
export function validateListColor(color?: string): ValidationResult<string | undefined> {
  if (!color) {
    return {
      success: true,
      data: undefined,
    };
  }
  
  const hexColorRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
  if (!hexColorRegex.test(color)) {
    return {
      success: false,
      errors: ['Color must be a valid hex color (e.g., #FF0000)'],
    };
  }
  
  return {
    success: true,
    data: color,
  };
}

// Bulk operation validation
export function validateBulkTaskIds(taskIds: unknown): ValidationResult<string[]> {
  if (!Array.isArray(taskIds)) {
    return {
      success: false,
      errors: ['Task IDs must be an array'],
    };
  }
  
  if (taskIds.length === 0) {
    return {
      success: false,
      errors: ['At least one task must be selected'],
    };
  }
  
  const invalidIds = taskIds.filter(id => typeof id !== 'string' || id.trim().length === 0);
  if (invalidIds.length > 0) {
    return {
      success: false,
      errors: ['All task IDs must be valid strings'],
    };
  }
  
  return {
    success: true,
    data: taskIds as string[],
  };
}

// Error handling utilities
export class ListValidationError extends Error {
  constructor(
    message: string,
    public code: string = LIST_ERROR_CODES.INVALID_LIST_DATA,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ListValidationError';
  }
}

export function createListValidationError(
  message: string,
  code: string = LIST_ERROR_CODES.INVALID_LIST_DATA,
  details?: Record<string, unknown>
): ListValidationError {
  return new ListValidationError(message, code, details);
}

// Validation helpers for forms
export function getFieldError(errors: string[], field: string): string | undefined {
  return errors.find(error => error.toLowerCase().includes(field.toLowerCase()));
}

export function hasFieldError(errors: string[], field: string): boolean {
  return errors.some(error => error.toLowerCase().includes(field.toLowerCase()));
}