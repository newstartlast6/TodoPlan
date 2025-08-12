import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { type Task, type InsertTask, type UpdateTask } from '@shared/schema';
import { listsKeys } from './use-lists';

// Create task in list mutation
export function useCreateTaskInList() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (taskData: InsertTask) => {
      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(taskData),
      });

      if (!response.ok) {
        throw new Error('Failed to create task');
      }

      return response.json();
    },
    onMutate: async (newTask) => {
      // Cancel outgoing refetches (using same keys as calendar)
      await queryClient.cancelQueries({ queryKey: ['/api/tasks'] });
      await queryClient.cancelQueries({ queryKey: listsKeys.lists() });

      // Snapshot previous values
      const previousTasks = queryClient.getQueryData(['/api/tasks']);
      const previousLists = queryClient.getQueryData(listsKeys.lists());

      // Optimistically update tasks (same as calendar)
      queryClient.setQueryData(['/api/tasks'], (old: Task[] | undefined) => {
        if (!old) return old;
        const optimisticTask = {
          id: `temp-${Date.now()}`,
          title: newTask.title,
          description: newTask.description ?? null,
          notes: newTask.notes ?? null,
          startTime: newTask.startTime,
          endTime: newTask.endTime,
          completed: newTask.completed ?? false as any,
          priority: (newTask as any).priority ?? 'medium',
          listId: (newTask as any).listId ?? null,
          scheduledDate: (newTask as any).scheduledDate ?? null,
          createdAt: new Date(),
          timeLoggedSeconds: 0,
        } as unknown as Task;
        return [...old, optimisticTask];
      });

      // Optimistically update list task count
      queryClient.setQueryData(listsKeys.lists(), (old: any[] | undefined) => {
        if (!old) return old;
        return old.map(list => 
          list.id === newTask.listId 
            ? { ...list, taskCount: list.taskCount + 1 }
            : list
        );
      });

      return { previousTasks, previousLists };
    },
    onSuccess: (newTask) => {
      // Invalidate and refetch (same as calendar)
      queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
      queryClient.invalidateQueries({ queryKey: listsKeys.lists() });
      
      toast({
        title: 'Task created',
        description: `"${newTask.title}" has been added to the list.`,
      });
    },
    onError: (error, newTask, context) => {
      // Rollback optimistic updates
      if (context?.previousTasks) {
        queryClient.setQueryData(['/api/tasks'], context.previousTasks);
      }
      if (context?.previousLists) {
        queryClient.setQueryData(listsKeys.lists(), context.previousLists);
      }

      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create task',
        variant: 'destructive',
      });
    },
  });
}

// Update task mutation (using same cache as calendar)
export function useUpdateTask() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ taskId, updates }: { taskId: string; updates: UpdateTask }) => {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        throw new Error('Failed to update task');
      }

      return response.json();
    },
    onMutate: async ({ taskId, updates }) => {
      // Cancel outgoing refetches (using same keys as calendar)
      await queryClient.cancelQueries({ queryKey: ['task', taskId] });
      await queryClient.cancelQueries({ queryKey: ['/api/tasks'] });

      // Snapshot previous values
      const previousTask = queryClient.getQueryData(['task', taskId]);
      const previousTasks = queryClient.getQueryData(['/api/tasks']);

      // Optimistically update task detail
      queryClient.setQueryData(['task', taskId], (old: Task | undefined) => {
        if (!old) return old;
        return { ...old, ...updates };
      });

      // Optimistically update tasks list (same as calendar)
      queryClient.setQueriesData(
        { queryKey: ['/api/tasks'] },
        (old: Task[] | undefined) => {
          if (!old) return old;
          return old.map(task =>
            task.id === taskId ? { ...task, ...updates } : task
          );
        }
      );

      return { previousTask, previousTasks };
    },
    onSuccess: (updatedTask, { taskId }) => {
      // Invalidate queries (same as calendar)
      queryClient.invalidateQueries({ queryKey: ['task', taskId] });
      queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
      queryClient.invalidateQueries({ queryKey: listsKeys.lists() }); // Refresh list counts
    },
    onError: (error, { taskId }, context) => {
      // Rollback optimistic updates
      if (context?.previousTask) {
        queryClient.setQueryData(['task', taskId], context.previousTask);
      }
      if (context?.previousTasks) {
        queryClient.setQueriesData({ queryKey: ['/api/tasks'] }, context.previousTasks);
      }

      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update task',
        variant: 'destructive',
      });
    },
  });
}

// Delete task mutation
export function useDeleteTask() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (taskId: string) => {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete task');
      }
    },
    onMutate: async (taskId) => {
      // Find the task to delete
      const allTasks = queryClient.getQueryData(['/api/tasks']) as Task[] | undefined;
      const deletedTask = allTasks?.find(task => task.id === taskId);

      // Cancel outgoing refetches (using same keys as calendar)
      await queryClient.cancelQueries({ queryKey: ['/api/tasks'] });
      await queryClient.cancelQueries({ queryKey: listsKeys.lists() });

      // Snapshot previous values
      const previousTasks = queryClient.getQueryData(['/api/tasks']);
      const previousLists = queryClient.getQueryData(listsKeys.lists());

      // Optimistically remove task (same as calendar)
      queryClient.setQueryData(['/api/tasks'], (old: Task[] | undefined) => {
        if (!old) return old;
        return old.filter(task => task.id !== taskId);
      });

      // Optimistically update list task counts
      if (deletedTask?.listId) {
        queryClient.setQueryData(listsKeys.lists(), (old: any[] | undefined) => {
          if (!old) return old;
          return old.map(list => 
            list.id === deletedTask.listId 
              ? { 
                  ...list, 
                  taskCount: Math.max(0, list.taskCount - 1),
                  completedTaskCount: deletedTask.completed 
                    ? Math.max(0, list.completedTaskCount - 1)
                    : list.completedTaskCount
                }
              : list
          );
        });
      }

      return { previousTasks, previousLists };
    },
    onSuccess: (_, taskId) => {
      // Invalidate and remove queries (same as calendar)
      queryClient.removeQueries({ queryKey: ['task', taskId] });
      queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
      queryClient.invalidateQueries({ queryKey: listsKeys.lists() });
      
      toast({
        title: 'Task deleted',
        description: 'The task has been deleted successfully.',
      });
    },
    onError: (error, taskId, context) => {
      // Rollback optimistic updates
      if (context?.previousTasks) {
        queryClient.setQueryData(['/api/tasks'], context.previousTasks);
      }
      if (context?.previousLists) {
        queryClient.setQueryData(listsKeys.lists(), context.previousLists);
      }

      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete task',
        variant: 'destructive',
      });
    },
  });
}

// Bulk operations
export function useBulkUpdateTasks() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ taskIds, updates }: { taskIds: string[]; updates: UpdateTask }) => {
      const promises = taskIds.map(taskId =>
        fetch(`/api/tasks/${taskId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(updates),
        })
      );

      const responses = await Promise.all(promises);
      const failedResponses = responses.filter(response => !response.ok);
      
      if (failedResponses.length > 0) {
        throw new Error(`Failed to update ${failedResponses.length} tasks`);
      }

      return Promise.all(responses.map(response => response.json()));
    },
    onSuccess: (updatedTasks, { taskIds }) => {
      // Invalidate all related queries
      taskIds.forEach(taskId => {
        queryClient.invalidateQueries({ queryKey: ['task', taskId] });
      });
      queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
      queryClient.invalidateQueries({ queryKey: listsKeys.all });
      
      toast({
        title: 'Tasks updated',
        description: `${updatedTasks.length} tasks have been updated successfully.`,
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update tasks',
        variant: 'destructive',
      });
    },
  });
}