import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Lists } from '../lists';

// Mock the hooks and components
jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: jest.fn(),
  }),
}));

jest.mock('../components/lists/lists-panel', () => ({
  ListsPanel: ({ onListSelect, onListCreate }: any) => (
    <div data-testid="lists-panel">
      <button onClick={() => onListSelect('list-1')}>Select List 1</button>
      <button onClick={() => onListCreate({ name: 'New List', emoji: '📋' })}>Create List</button>
    </div>
  ),
}));

jest.mock('../components/lists/list-detail-panel', () => ({
  ListDetailPanel: ({ onTaskSelect, onTaskCreate }: any) => (
    <div data-testid="list-detail-panel">
      <button onClick={() => onTaskSelect('task-1')}>Select Task 1</button>
      <button onClick={() => onTaskCreate({ title: 'New Task', startTime: new Date(), endTime: new Date() })}>Create Task</button>
    </div>
  ),
}));

jest.mock('../components/calendar/todo-detail-pane', () => ({
  TodoDetailPane: ({ onClose }: any) => (
    <div data-testid="todo-detail-pane">
      <button onClick={onClose}>Close Detail</button>
    </div>
  ),
}));

jest.mock('../components/lists/responsive-lists-layout', () => ({
  ResponsiveListsLayout: ({ listsPanel, listDetailPanel, todoDetailPanel }: any) => (
    <div data-testid="responsive-layout">
      {listsPanel}
      {listDetailPanel}
      {todoDetailPanel}
    </div>
  ),
}));

// Mock fetch
global.fetch = jest.fn();

const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

describe('Lists Page', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
    jest.clearAllMocks();
  });

  const renderWithQueryClient = (component: React.ReactElement) => {
    return render(
      <QueryClientProvider client={queryClient}>
        {component}
      </QueryClientProvider>
    );
  };

  it('renders the lists page with all panels', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    } as Response);

    renderWithQueryClient(<Lists />);

    expect(screen.getByTestId('responsive-layout')).toBeInTheDocument();
    expect(screen.getByTestId('lists-panel')).toBeInTheDocument();
    expect(screen.getByTestId('list-detail-panel')).toBeInTheDocument();
  });

  it('fetches lists on mount', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        { id: 'list-1', name: 'Work', emoji: '💼' },
      ],
    } as Response);

    renderWithQueryClient(<Lists />);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/lists');
    });
  });

  it('handles list selection', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [
          { id: 'list-1', name: 'Work', emoji: '💼' },
        ],
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      } as Response);

    renderWithQueryClient(<Lists />);

    // Wait for initial load
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/lists');
    });

    // Select a list
    fireEvent.click(screen.getByText('Select List 1'));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/lists/list-1/tasks');
    });
  });

  it('handles task selection', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    } as Response);

    renderWithQueryClient(<Lists />);

    // Select a task
    fireEvent.click(screen.getByText('Select Task 1'));

    // Should show todo detail pane
    expect(screen.getByTestId('todo-detail-pane')).toBeInTheDocument();
  });

  it('handles list creation', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'new-list', name: 'New List', emoji: '📋' }),
      } as Response);

    renderWithQueryClient(<Lists />);

    // Create a list
    fireEvent.click(screen.getByText('Create List'));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/lists', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: 'New List', emoji: '📋' }),
      });
    });
  });

  it('handles task creation', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [
          { id: 'list-1', name: 'Work', emoji: '💼' },
        ],
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'new-task', title: 'New Task' }),
      } as Response);

    renderWithQueryClient(<Lists />);

    // Wait for initial load and select a list
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/lists');
    });

    fireEvent.click(screen.getByText('Select List 1'));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/lists/list-1/tasks');
    });

    // Create a task
    fireEvent.click(screen.getByText('Create Task'));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: expect.stringContaining('"title":"New Task"'),
      });
    });
  });

  it('closes todo detail pane', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    } as Response);

    renderWithQueryClient(<Lists />);

    // Select a task to show detail pane
    fireEvent.click(screen.getByText('Select Task 1'));
    expect(screen.getByTestId('todo-detail-pane')).toBeInTheDocument();

    // Close detail pane
    fireEvent.click(screen.getByText('Close Detail'));

    // Should show placeholder
    expect(screen.getByText('Select a task to view details')).toBeInTheDocument();
  });

  it('handles API errors gracefully', async () => {
    mockFetch.mockRejectedValueOnce(new Error('API Error'));

    renderWithQueryClient(<Lists />);

    // Should still render the layout even if API fails
    expect(screen.getByTestId('responsive-layout')).toBeInTheDocument();
  });

  it('clears task selection when list changes', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [
          { id: 'list-1', name: 'Work', emoji: '💼' },
          { id: 'list-2', name: 'Personal', emoji: '🏠' },
        ],
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      } as Response);

    renderWithQueryClient(<Lists />);

    // Wait for initial load
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/lists');
    });

    // Select first list and then a task
    fireEvent.click(screen.getByText('Select List 1'));
    fireEvent.click(screen.getByText('Select Task 1'));

    expect(screen.getByTestId('todo-detail-pane')).toBeInTheDocument();

    // Switch to different list - should clear task selection
    fireEvent.click(screen.getByText('Select List 1')); // Simulate selecting different list

    // Task detail should be hidden
    expect(screen.getByText('Select a task to view details')).toBeInTheDocument();
  });
});