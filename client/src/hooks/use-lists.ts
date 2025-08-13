import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { type ListWithTaskCount, type CreateListRequest, type UpdateListRequest } from '@shared/list-types';
import { type Task } from '@shared/schema';

// Query keys
export const listsKeys = {
  all: ['lists'] as const,
  lists: () => [...listsKeys.all, 'list'] as const,
  list: (id: string) => [...listsKeys.lists(), id] as const,
  listTasks: (id: string) => ['/api/lists', id, 'tasks'] as const,
};

// Fetch all lists with task counts
export function useLists() {
  return useQuery<ListWithTaskCount[]>({
    queryKey: listsKeys.lists(),
    queryFn: async () => {
      const response = await fetch('/api/lists');
      if (!response.ok) {
        throw new Error('Failed to fetch lists');
      }
      const listsData = await response.json();
      
      // Enhance with task counts
      const listsWithCounts = await Promise.all(
        listsData.map(async (list: any) => {
          const tasksResponse = await fetch(`/api/lists/${list.id}/tasks`);
          const tasks = tasksResponse.ok ? await tasksResponse.json() : [];
          const normalized: ListWithTaskCount = {
            id: list.id,
            name: list.name,
            emoji: list.emoji,
            color: null as string | null,
            createdAt: (list.createdAt as any) ?? new Date(),
            updatedAt: (list.updatedAt as any) ?? new Date(),
            taskCount: tasks.length,
            completedTaskCount: tasks.filter((task: Task) => task.completed).length,
          };
          return normalized;
        })
      );
      
      return listsWithCounts;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 10, // 10 minutes
  });
}

// Fetch single list
export function useList(listId: string | null) {
  return useQuery({
    queryKey: listsKeys.list(listId || ''),
    queryFn: async () => {
      if (!listId) return null;
      const response = await fetch(`/api/lists/${listId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch list');
      }
      return response.json();
    },
    enabled: !!listId,
    staleTime: 1000 * 60 * 5,
  });
}

// Fetch tasks for a specific list (using the same cache as calendar)
export function useListTasks(listId: string | null) {
  // Fetch all tasks using the same query key as calendar
  const { data: allTasks = [], isLoading, error } = useQuery<Task[]>({
    queryKey: ['/api/tasks'],
    queryFn: async () => {
      const response = await fetch('/api/tasks');
      if (!response.ok) {
        throw new Error('Failed to fetch tasks');
      }
      return response.json();
    },
    staleTime: 1000 * 60 * 2, // 2 minutes
  });

  // Filter tasks by listId client-side
  const filteredTasks = listId 
    ? allTasks.filter(task => task.listId === listId)
    : [];

  return {
    data: filteredTasks,
    isLoading,
    error,
  };
}

// Create list mutation
export function useCreateList() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (listData: CreateListRequest) => {
      const response = await fetch('/api/lists', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(listData),
      });

      if (!response.ok) {
        throw new Error('Failed to create list');
      }

      return response.json();
    },
    onMutate: async (newList) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: listsKeys.lists() });

      // Snapshot the previous value
      const previousLists = queryClient.getQueryData(listsKeys.lists());

      // Optimistically update to the new value
      queryClient.setQueryData(listsKeys.lists(), (old: ListWithTaskCount[] | undefined) => {
        if (!old) return old;
         const optimisticList: ListWithTaskCount = {
          id: `temp-${Date.now()}`,
          name: newList.name,
          emoji: newList.emoji,
           color: null,
          taskCount: 0,
          completedTaskCount: 0,
          createdAt: new Date() as any,
          updatedAt: new Date() as any,
        } as any;
        return [...old, optimisticList];
      });

      return { previousLists };
    },
    onSuccess: (newList) => {
      // Invalidate and refetch
      queryClient.invalidateQueries({ queryKey: listsKeys.lists() });
      
      toast({
        title: 'List created',
        description: `"${newList.name}" has been created successfully.`,
      });
    },
    onError: (error, variables, context) => {
      // Rollback optimistic update
      if (context?.previousLists) {
        queryClient.setQueryData(listsKeys.lists(), context.previousLists);
      }

      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create list',
        variant: 'destructive',
      });
    },
  });
}

// Update list mutation
export function useUpdateList() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ listId, updates }: { listId: string; updates: UpdateListRequest }) => {
      const response = await fetch(`/api/lists/${listId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        throw new Error('Failed to update list');
      }

      return response.json();
    },
    onMutate: async ({ listId, updates }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: listsKeys.lists() });
      await queryClient.cancelQueries({ queryKey: listsKeys.list(listId) });

      // Snapshot previous values
      const previousLists = queryClient.getQueryData(listsKeys.lists());
      const previousList = queryClient.getQueryData(listsKeys.list(listId));

      // Optimistically update
      queryClient.setQueryData(listsKeys.lists(), (old: ListWithTaskCount[] | undefined) => {
        if (!old) return old;
        return old.map(list => 
          list.id === listId 
            ? { ...list, ...updates, updatedAt: new Date() }
            : list
        );
      });

      queryClient.setQueryData(listsKeys.list(listId), (old: any) => {
        if (!old) return old;
        return { ...old, ...updates, updatedAt: new Date() };
      });

      return { previousLists, previousList };
    },
    onSuccess: (updatedList) => {
      queryClient.invalidateQueries({ queryKey: listsKeys.lists() });
      queryClient.invalidateQueries({ queryKey: listsKeys.list(updatedList.id) });
      
      toast({
        title: 'List updated',
        description: `"${updatedList.name}" has been updated successfully.`,
      });
    },
    onError: (error, { listId }, context) => {
      // Rollback optimistic updates
      if (context?.previousLists) {
        queryClient.setQueryData(listsKeys.lists(), context.previousLists);
      }
      if (context?.previousList) {
        queryClient.setQueryData(listsKeys.list(listId), context.previousList);
      }

      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update list',
        variant: 'destructive',
      });
    },
  });
}

// Delete list mutation
export function useDeleteList() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (listId: string) => {
      const response = await fetch(`/api/lists/${listId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete list');
      }
    },
    onMutate: async (listId) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: listsKeys.lists() });

      // Snapshot the previous value
      const previousLists = queryClient.getQueryData(listsKeys.lists());

      // Optimistically update
      queryClient.setQueryData(listsKeys.lists(), (old: ListWithTaskCount[] | undefined) => {
        if (!old) return old;
        return old.filter(list => list.id !== listId);
      });

      return { previousLists };
    },
    onSuccess: (_, deletedListId) => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: listsKeys.lists() });
      queryClient.removeQueries({ queryKey: listsKeys.list(deletedListId) });
      queryClient.removeQueries({ queryKey: listsKeys.listTasks(deletedListId) });
      queryClient.invalidateQueries({ queryKey: ['/api/tasks'] }); // Refresh tasks cache
      
      toast({
        title: 'List deleted',
        description: 'The list has been deleted successfully.',
      });
    },
    onError: (error, listId, context) => {
      // Rollback optimistic update
      if (context?.previousLists) {
        queryClient.setQueryData(listsKeys.lists(), context.previousLists);
      }

      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete list',
        variant: 'destructive',
      });
    },
  });
}

// Prefetch list tasks
export function usePrefetchListTasks() {
  const queryClient = useQueryClient();

  return (listId: string) => {
    queryClient.prefetchQuery({
      queryKey: listsKeys.listTasks(listId),
      queryFn: async () => {
        const response = await fetch(`/api/lists/${listId}/tasks`);
        if (!response.ok) {
          throw new Error('Failed to fetch tasks');
        }
        return response.json();
      },
      staleTime: 1000 * 60 * 2,
    });
  };
}

// Invalidate lists cache (useful for external updates)
export function useInvalidateLists() {
  const queryClient = useQueryClient();

  return () => {
    queryClient.invalidateQueries({ queryKey: listsKeys.all });
  };
}