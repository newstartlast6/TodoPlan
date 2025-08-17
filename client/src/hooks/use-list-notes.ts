import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import type { ListNote, InsertListNote, UpdateListNote } from '@shared/schema';

// Hook to fetch list notes for a specific list
export function useListNotes(listId: string | null) {
  return useQuery({
    queryKey: ['/api/list-notes', listId],
    queryFn: async () => {
      if (!listId) return [];
      const response = await fetch(`/api/list-notes?listId=${listId}`);
      if (!response.ok) throw new Error('Failed to fetch list notes');
      return response.json() as Promise<ListNote[]>;
    },
    enabled: !!listId,
  });
}

// Hook to create a new list note
export function useCreateListNote() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: InsertListNote): Promise<ListNote> => {
      const response = await fetch('/api/list-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to create list note');
      return response.json();
    },
    onSuccess: (newNote) => {
      // Invalidate and refetch list notes for the affected list
      queryClient.invalidateQueries({ queryKey: ['/api/list-notes', newNote.listId] });
    },
  });
}

// Hook to update a list note
export function useUpdateListNote() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ noteId, updates }: { noteId: string; updates: UpdateListNote }): Promise<ListNote> => {
      const response = await fetch(`/api/list-notes/${noteId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!response.ok) throw new Error('Failed to update list note');
      return response.json();
    },
    onSuccess: (updatedNote) => {
      // Invalidate and refetch list notes for the affected list
      queryClient.invalidateQueries({ queryKey: ['/api/list-notes', updatedNote.listId] });
    },
  });
}

// Hook to delete a list note
export function useDeleteListNote() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (noteId: string): Promise<void> => {
      const response = await fetch(`/api/list-notes/${noteId}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete list note');
    },
    onSuccess: (_, noteId) => {
      // Invalidate all list notes queries since we don't know which list it belonged to
      queryClient.invalidateQueries({ queryKey: ['/api/list-notes'] });
    },
  });
}