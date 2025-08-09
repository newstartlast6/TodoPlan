import { useState, useEffect, useCallback, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Task, UpdateTask } from '@shared/schema';

interface NotesAutoSaveState {
  notes: string;
  isDirty: boolean;
  isSaving: boolean;
  lastSaved: Date | null;
  error: string | null;
}

interface UseNotesAutoSaveOptions {
  taskId: string;
  initialNotes: string;
  debounceMs?: number;
  onSaveSuccess?: () => void;
  onSaveError?: (error: string) => void;
}

export function useNotesAutoSave({
  taskId,
  initialNotes,
  debounceMs = 1000,
  onSaveSuccess,
  onSaveError,
}: UseNotesAutoSaveOptions) {
  const queryClient = useQueryClient();
  const debounceTimeoutRef = useRef<NodeJS.Timeout>();
  const retryTimeoutRef = useRef<NodeJS.Timeout>();
  const retryCountRef = useRef(0);
  const maxRetries = 3;

  const [state, setState] = useState<NotesAutoSaveState>({
    notes: initialNotes,
    isDirty: false,
    isSaving: false,
    lastSaved: null,
    error: null,
  });

  // Update mutation for saving notes
  const updateTaskMutation = useMutation({
    mutationFn: async (updates: UpdateTask): Promise<Task> => {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        throw new Error(`Failed to update task: ${response.statusText}`);
      }

      return response.json();
    },
    onMutate: async (updates) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['tasks'] });
      await queryClient.cancelQueries({ queryKey: ['task', taskId] });

      // Snapshot the previous value
      const previousTasks = queryClient.getQueryData(['tasks']);
      const previousTask = queryClient.getQueryData(['task', taskId]);

      // Optimistically update the cache
      queryClient.setQueryData(['tasks'], (old: Task[] | undefined) => {
        if (!old) return old;
        return old.map(task => 
          task.id === taskId ? { ...task, ...updates } : task
        );
      });

      queryClient.setQueryData(['task', taskId], (old: Task | undefined) => {
        if (!old) return old;
        return { ...old, ...updates };
      });

      return { previousTasks, previousTask };
    },
    onSuccess: (updatedTask) => {
      setState(prev => ({
        ...prev,
        isSaving: false,
        isDirty: false,
        lastSaved: new Date(),
        error: null,
      }));
      retryCountRef.current = 0;
      onSaveSuccess?.();
    },
    onError: (error, variables, context) => {
      // Rollback optimistic updates
      if (context?.previousTasks) {
        queryClient.setQueryData(['tasks'], context.previousTasks);
      }
      if (context?.previousTask) {
        queryClient.setQueryData(['task', taskId], context.previousTask);
      }

      const errorMessage = error instanceof Error ? error.message : 'Failed to save notes';
      
      setState(prev => ({
        ...prev,
        isSaving: false,
        error: errorMessage,
      }));

      // Retry logic
      if (retryCountRef.current < maxRetries) {
        retryCountRef.current++;
        const retryDelay = Math.pow(2, retryCountRef.current) * 1000; // Exponential backoff
        
        retryTimeoutRef.current = setTimeout(() => {
          updateTaskMutation.mutate(variables);
        }, retryDelay);
      } else {
        onSaveError?.(errorMessage);
      }
    },
  });

  // Debounced save function
  const debouncedSave = useCallback((notes: string) => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    debounceTimeoutRef.current = setTimeout(() => {
      if (notes !== initialNotes) {
        setState(prev => ({ ...prev, isSaving: true, error: null }));
        updateTaskMutation.mutate({ notes });
      }
    }, debounceMs);
  }, [debounceMs, initialNotes, updateTaskMutation]);

  // Update notes function
  const updateNotes = useCallback((newNotes: string) => {
    setState(prev => ({
      ...prev,
      notes: newNotes,
      isDirty: newNotes !== initialNotes,
      error: null,
    }));

    // Trigger debounced save
    debouncedSave(newNotes);
  }, [initialNotes, debouncedSave]);

  // Force save function (for immediate saves)
  const forceSave = useCallback(() => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    if (state.notes !== initialNotes && !state.isSaving) {
      setState(prev => ({ ...prev, isSaving: true, error: null }));
      updateTaskMutation.mutate({ notes: state.notes });
    }
  }, [state.notes, state.isSaving, initialNotes, updateTaskMutation]);

  // Retry failed save
  const retrySave = useCallback(() => {
    if (state.error && !state.isSaving) {
      retryCountRef.current = 0;
      setState(prev => ({ ...prev, error: null, isSaving: true }));
      updateTaskMutation.mutate({ notes: state.notes });
    }
  }, [state.error, state.isSaving, state.notes, updateTaskMutation]);

  // Update initial notes when task changes
  useEffect(() => {
    setState(prev => ({
      ...prev,
      notes: initialNotes,
      isDirty: false,
      error: null,
    }));
  }, [initialNotes]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, []);

  return {
    notes: state.notes,
    isDirty: state.isDirty,
    isSaving: state.isSaving,
    lastSaved: state.lastSaved,
    error: state.error,
    updateNotes,
    forceSave,
    retrySave,
  };
}