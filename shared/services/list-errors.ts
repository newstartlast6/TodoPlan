// List-specific error handling utilities
// This file contains error classes and utilities for list operations

import { LIST_ERROR_CODES, type ListError } from '../list-types';

// Base list error class
export class ListError extends Error {
  constructor(
    message: string,
    public code: string = LIST_ERROR_CODES.INVALID_LIST_DATA,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ListError';
  }

  toJSON(): ListError {
    return {
      code: this.code,
      message: this.message,
      details: this.details,
    };
  }
}

// Specific list error types
export class ListNotFoundError extends ListError {
  constructor(listId: string, details?: Record<string, unknown>) {
    super(
      `List with ID "${listId}" not found`,
      LIST_ERROR_CODES.LIST_NOT_FOUND,
      { listId, ...details }
    );
    this.name = 'ListNotFoundError';
  }
}

export class ListValidationError extends ListError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, LIST_ERROR_CODES.INVALID_LIST_DATA, details);
    this.name = 'ListValidationError';
  }
}

export class ListNameRequiredError extends ListError {
  constructor(details?: Record<string, unknown>) {
    super(
      'List name is required',
      LIST_ERROR_CODES.LIST_NAME_REQUIRED,
      details
    );
    this.name = 'ListNameRequiredError';
  }
}

export class EmojiRequiredError extends ListError {
  constructor(details?: Record<string, unknown>) {
    super(
      'Emoji is required for list creation',
      LIST_ERROR_CODES.EMOJI_REQUIRED,
      details
    );
    this.name = 'EmojiRequiredError';
  }
}

export class TaskNotInListError extends ListError {
  constructor(taskId: string, listId: string, details?: Record<string, unknown>) {
    super(
      `Task "${taskId}" is not in list "${listId}"`,
      LIST_ERROR_CODES.TASK_NOT_IN_LIST,
      { taskId, listId, ...details }
    );
    this.name = 'TaskNotInListError';
  }
}

export class BulkOperationFailedError extends ListError {
  constructor(operation: string, failedCount: number, details?: Record<string, unknown>) {
    super(
      `Bulk ${operation} operation failed for ${failedCount} items`,
      LIST_ERROR_CODES.BULK_OPERATION_FAILED,
      { operation, failedCount, ...details }
    );
    this.name = 'BulkOperationFailedError';
  }
}

// Error handler utility
export class ListErrorHandler {
  static handleError(error: unknown): ListError {
    if (error instanceof ListError) {
      return error;
    }

    if (error instanceof Error) {
      return new ListError(error.message, LIST_ERROR_CODES.INVALID_LIST_DATA, {
        originalError: error.name,
        stack: error.stack,
      });
    }

    return new ListError(
      'An unknown error occurred',
      LIST_ERROR_CODES.INVALID_LIST_DATA,
      { originalError: String(error) }
    );
  }

  static isRetryableError(error: ListError): boolean {
    // Define which errors are retryable
    const retryableCodes = [
      // Add codes for network errors, temporary failures, etc.
    ];
    
    return retryableCodes.includes(error.code);
  }

  static getErrorMessage(error: ListError): string {
    switch (error.code) {
      case LIST_ERROR_CODES.LIST_NOT_FOUND:
        return 'The requested list could not be found.';
      case LIST_ERROR_CODES.LIST_NAME_REQUIRED:
        return 'Please enter a name for your list.';
      case LIST_ERROR_CODES.EMOJI_REQUIRED:
        return 'Please select an emoji for your list.';
      case LIST_ERROR_CODES.TASK_NOT_IN_LIST:
        return 'The task is not associated with this list.';
      case LIST_ERROR_CODES.BULK_OPERATION_FAILED:
        return 'Some items could not be processed. Please try again.';
      default:
        return error.message || 'An unexpected error occurred.';
    }
  }

  static getErrorSeverity(error: ListError): 'low' | 'medium' | 'high' {
    switch (error.code) {
      case LIST_ERROR_CODES.LIST_NOT_FOUND:
      case LIST_ERROR_CODES.TASK_NOT_IN_LIST:
        return 'medium';
      case LIST_ERROR_CODES.BULK_OPERATION_FAILED:
        return 'high';
      default:
        return 'low';
    }
  }
}

// Error reporting utilities
export interface ErrorReport {
  errorId: string;
  timestamp: string;
  severity: 'low' | 'medium' | 'high';
  errorCode: string;
  errorMessage: string;
  context: {
    component?: string;
    action?: string;
    listId?: string;
    taskId?: string;
    userId?: string;
    url?: string;
    userAgent?: string;
  };
  retryCount: number;
}

export function createErrorReport(
  error: ListError,
  context: Partial<ErrorReport['context']> = {},
  retryCount: number = 0
): ErrorReport {
  return {
    errorId: generateErrorId(),
    timestamp: new Date().toISOString(),
    severity: ListErrorHandler.getErrorSeverity(error),
    errorCode: error.code,
    errorMessage: error.message,
    context: {
      component: 'lists',
      ...context,
    },
    retryCount,
  };
}

function generateErrorId(): string {
  return `list_error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Error boundary helpers
export function isListError(error: unknown): error is ListError {
  return error instanceof ListError;
}

export function extractListErrorInfo(error: unknown): {
  message: string;
  code: string;
  details?: Record<string, unknown>;
} {
  if (isListError(error)) {
    return {
      message: ListErrorHandler.getErrorMessage(error),
      code: error.code,
      details: error.details,
    };
  }

  return {
    message: 'An unexpected error occurred',
    code: LIST_ERROR_CODES.INVALID_LIST_DATA,
    details: { originalError: String(error) },
  };
}