import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useLists, useCreateList, useUpdateList, useDeleteList } from '../use-lists';
import { useToast } from '@/hooks/use-toast';

// Mock the toast hook
jest.mock('@/hooks/use-toast', () => ({
  useToast: jest.fn(),
}));

// Mock fetch
global.fetch = jest.fn();

const mockToast = jest.fn();
(useToast as jest.Mock).mockReturnValue({ toast: mockToast });

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

describe('useLists', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetches lists with task counts', async () => {
    const mockLists = [
      { id: '1', name: 'Work', emoji: '💼' },
      { id: '2', name: 'Personal', emoji: '🏠' },
    ];

    const mockTasks1 = [
      { id: 'task1', completed: false },
      { id: 'task2', completed: true },
    ];

    const mockTasks2 = [
      { id: 'task3', completed: false },
    ];

    (fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockLists,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockTasks1,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockTasks2,
      });

    const { result } = renderHook(() => useLists(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual([
      {
        id: '1',
        name: 'Work',
        emoji: '💼',
        taskCount: 2,
        completedTaskCount: 1,
      },
      {
        id: '2',
        name: 'Personal',
        emoji: '🏠',
        taskCount: 1,
        completedTaskCount: 0,
      },
    ]);
  });

  it('handles fetch error', async () => {
    (fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useLists(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toEqual(new Error('Network error'));
  });
});

describe('useCreateList', () => {
  it('creates a list successfully', async () => {
    const mockNewList = { id: '1', name: 'New List', emoji: '📋' };

    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockNewList,
    });

    const { result } = renderHook(() => useCreateList(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ name: 'New List', emoji: '📋' });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(fetch).toHaveBeenCalledWith('/api/lists', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: 'New List', emoji: '📋' }),
    });

    expect(mockToast).toHaveBeenCalledWith({
      title: 'List created',
      description: '"New List" has been created successfully.',
    });
  });

  it('handles create error', async () => {
    (fetch as jest.Mock).mockRejectedValueOnce(new Error('Create failed'));

    const { result } = renderHook(() => useCreateList(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ name: 'New List', emoji: '📋' });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(mockToast).toHaveBeenCalledWith({
      title: 'Error',
      description: 'Create failed',
      variant: 'destructive',
    });
  });
});

describe('useUpdateList', () => {
  it('updates a list successfully', async () => {
    const mockUpdatedList = { id: '1', name: 'Updated List', emoji: '📋' };

    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockUpdatedList,
    });

    const { result } = renderHook(() => useUpdateList(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({
      listId: '1',
      updates: { name: 'Updated List' },
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(fetch).toHaveBeenCalledWith('/api/lists/1', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: 'Updated List' }),
    });

    expect(mockToast).toHaveBeenCalledWith({
      title: 'List updated',
      description: '"Updated List" has been updated successfully.',
    });
  });
});

describe('useDeleteList', () => {
  it('deletes a list successfully', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
    });

    const { result } = renderHook(() => useDeleteList(), {
      wrapper: createWrapper(),
    });

    result.current.mutate('1');

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(fetch).toHaveBeenCalledWith('/api/lists/1', {
      method: 'DELETE',
    });

    expect(mockToast).toHaveBeenCalledWith({
      title: 'List deleted',
      description: 'The list has been deleted successfully.',
    });
  });
});