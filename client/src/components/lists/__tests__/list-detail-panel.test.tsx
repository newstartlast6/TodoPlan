import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ListDetailPanel } from '../list-detail-panel';
import { type List } from '@shared/list-types';
import { type Task } from '@shared/schema';

const mockList: List = {
  id: '1',
  name: 'Work Tasks',
  emoji: '💼',
  color: '#f97316',
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockTasks: Task[] = [
  {
    id: '1',
    title: 'Complete project',
    description: 'Finish the project by deadline',
    notes: 'Important project',
    startTime: new Date('2024-01-01T09:00:00'),
    endTime: new Date('2024-01-01T10:00:00'),
    completed: false,
    priority: 'high',
    listId: '1',
    createdAt: new Date(),
  },
  {
    id: '2',
    title: 'Review documents',
    description: 'Review project documents',
    notes: null,
    startTime: new Date('2024-01-01T11:00:00'),
    endTime: new Date('2024-01-01T12:00:00'),
    completed: true,
    priority: 'medium',
    listId: '1',
    createdAt: new Date(),
  },
];

const defaultProps = {
  list: mockList,
  tasks: mockTasks,
  selectedTaskId: null,
  onTaskSelect: jest.fn(),
  onTaskCreate: jest.fn(),
  onTaskUpdate: jest.fn(),
  onTaskDelete: jest.fn(),
  onTaskToggleComplete: jest.fn(),
};

describe('ListDetailPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders list header with name and statistics', () => {
    render(<ListDetailPanel {...defaultProps} />);
    
    expect(screen.getByText('💼')).toBeInTheDocument();
    expect(screen.getByText('Work Tasks')).toBeInTheDocument();
    expect(screen.getByText('2 tasks')).toBeInTheDocument();
    expect(screen.getByText('• 50% complete')).toBeInTheDocument();
  });

  it('shows progress bar with correct completion percentage', () => {
    render(<ListDetailPanel {...defaultProps} />);
    
    const progressBar = screen.getByRole('generic', { hidden: true });
    expect(progressBar).toHaveStyle('width: 50%');
  });

  it('displays all tasks', () => {
    render(<ListDetailPanel {...defaultProps} />);
    
    expect(screen.getByText('Complete project')).toBeInTheDocument();
    expect(screen.getByText('Review documents')).toBeInTheDocument();
  });

  it('shows placeholder when no list is selected', () => {
    render(<ListDetailPanel {...defaultProps} list={null} />);
    
    expect(screen.getByText('Select a list to view tasks')).toBeInTheDocument();
  });

  it('shows empty state when list has no tasks', () => {
    render(<ListDetailPanel {...defaultProps} tasks={[]} />);
    
    expect(screen.getByText('No tasks in "Work Tasks"')).toBeInTheDocument();
    expect(screen.getByText('Add First Task')).toBeInTheDocument();
  });

  it('opens add task dialog when add task button is clicked', () => {
    render(<ListDetailPanel {...defaultProps} />);
    
    fireEvent.click(screen.getByText('Add Task'));
    
    expect(screen.getByText('Add New Task')).toBeInTheDocument();
  });

  it('calls onTaskCreate when task is added', async () => {
    render(<ListDetailPanel {...defaultProps} />);
    
    // Open add task dialog
    fireEvent.click(screen.getByText('Add Task'));
    
    // Fill form
    fireEvent.change(screen.getByPlaceholderText('Enter task title'), {
      target: { value: 'New Task' },
    });
    
    // Submit form
    fireEvent.click(screen.getByText('Add Task'));
    
    await waitFor(() => {
      expect(defaultProps.onTaskCreate).toHaveBeenCalled();
    });
  });

  it('calls onTaskSelect when task is clicked', () => {
    render(<ListDetailPanel {...defaultProps} />);
    
    fireEvent.click(screen.getByText('Complete project'));
    
    expect(defaultProps.onTaskSelect).toHaveBeenCalledWith('1');
  });

  it('calls onTaskToggleComplete when task completion is toggled', () => {
    render(<ListDetailPanel {...defaultProps} />);
    
    const toggleButton = screen.getAllByRole('button')[2]; // First task's toggle button
    fireEvent.click(toggleButton);
    
    expect(defaultProps.onTaskToggleComplete).toHaveBeenCalledWith('1', false);
  });

  it('filters out completed tasks when filter is applied', () => {
    render(<ListDetailPanel {...defaultProps} />);
    
    // Click the completed filter toggle
    fireEvent.click(screen.getByTitle('Hide completed tasks'));
    
    expect(screen.getByText('Complete project')).toBeInTheDocument();
    expect(screen.queryByText('Review documents')).not.toBeInTheDocument();
  });

  it('shows filter panel when filter button is clicked', () => {
    render(<ListDetailPanel {...defaultProps} />);
    
    fireEvent.click(screen.getByTitle('Filter tasks'));
    
    expect(screen.getByText('Priority:')).toBeInTheDocument();
    expect(screen.getByText('Sort by:')).toBeInTheDocument();
  });

  it('filters tasks by priority', () => {
    render(<ListDetailPanel {...defaultProps} />);
    
    // Open filter panel
    fireEvent.click(screen.getByTitle('Filter tasks'));
    
    // Select high priority filter
    const prioritySelect = screen.getByDisplayValue('All');
    fireEvent.change(prioritySelect, { target: { value: 'high' } });
    
    expect(screen.getByText('Complete project')).toBeInTheDocument();
    expect(screen.queryByText('Review documents')).not.toBeInTheDocument();
  });

  it('sorts tasks by different fields', () => {
    render(<ListDetailPanel {...defaultProps} />);
    
    // Open filter panel
    fireEvent.click(screen.getByTitle('Filter tasks'));
    
    // Change sort to title
    const sortSelect = screen.getByDisplayValue('Time');
    fireEvent.change(sortSelect, { target: { value: 'title' } });
    
    // Tasks should be reordered (Complete project comes before Review documents alphabetically)
    const taskElements = screen.getAllByText(/Complete project|Review documents/);
    expect(taskElements[0]).toHaveTextContent('Complete project');
  });

  it('toggles sort direction', () => {
    render(<ListDetailPanel {...defaultProps} />);
    
    // Open filter panel
    fireEvent.click(screen.getByTitle('Filter tasks'));
    
    // Click sort direction toggle
    fireEvent.click(screen.getByTitle('Sort ascending'));
    
    // Button title should change
    expect(screen.getByTitle('Sort descending')).toBeInTheDocument();
  });

  it('shows loading state', () => {
    render(<ListDetailPanel {...defaultProps} isLoading={true} />);
    
    expect(screen.getAllByRole('generic')).toHaveLength(3); // 3 skeleton items
  });

  it('shows no results message when filters match no tasks', () => {
    render(<ListDetailPanel {...defaultProps} />);
    
    // Open filter panel and set filter that matches no tasks
    fireEvent.click(screen.getByTitle('Filter tasks'));
    const prioritySelect = screen.getByDisplayValue('All');
    fireEvent.change(prioritySelect, { target: { value: 'low' } });
    
    expect(screen.getByText('No tasks match your filters')).toBeInTheDocument();
    expect(screen.getByText('Try adjusting your filter settings')).toBeInTheDocument();
  });

  it('highlights selected task', () => {
    render(<ListDetailPanel {...defaultProps} selectedTaskId="1" />);
    
    const selectedTask = screen.getByTestId('selectable-todo-1');
    expect(selectedTask).toHaveClass('bg-blue-50/60');
  });

  it('shows correct task count in singular form', () => {
    const singleTask = [mockTasks[0]];
    render(<ListDetailPanel {...defaultProps} tasks={singleTask} />);
    
    expect(screen.getByText('1 task')).toBeInTheDocument();
  });

  it('handles empty list name gracefully', () => {
    const listWithoutName = { ...mockList, name: '' };
    render(<ListDetailPanel {...defaultProps} list={listWithoutName} tasks={[]} />);
    
    expect(screen.getByText('No tasks in ""')).toBeInTheDocument();
  });
});