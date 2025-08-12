import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ListsPanel } from '../lists-panel';
import { type ListWithTaskCount } from '@shared/list-types';

const mockLists: ListWithTaskCount[] = [
  {
    id: '1',
    name: 'Work Tasks',
    emoji: '💼',
    color: '#f97316',
    createdAt: new Date(),
    updatedAt: new Date(),
    taskCount: 5,
    completedTaskCount: 2,
  },
  {
    id: '2',
    name: 'Personal',
    emoji: '🏠',
    color: '#10b981',
    createdAt: new Date(),
    updatedAt: new Date(),
    taskCount: 3,
    completedTaskCount: 1,
  },
];

const defaultProps = {
  lists: mockLists,
  selectedListId: null,
  onListSelect: jest.fn(),
  onListCreate: jest.fn(),
  onListUpdate: jest.fn(),
  onListDelete: jest.fn(),
};

describe('ListsPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders lists panel with header', () => {
    render(<ListsPanel {...defaultProps} />);
    
    expect(screen.getByText('Lists')).toBeInTheDocument();
    expect(screen.getByTitle('Create new list')).toBeInTheDocument();
  });

  it('displays all lists', () => {
    render(<ListsPanel {...defaultProps} />);
    
    expect(screen.getByText('Work Tasks')).toBeInTheDocument();
    expect(screen.getByText('Personal')).toBeInTheDocument();
    expect(screen.getByText('5 tasks')).toBeInTheDocument();
    expect(screen.getByText('3 tasks')).toBeInTheDocument();
  });

  it('shows loading state', () => {
    render(<ListsPanel {...defaultProps} lists={[]} isLoading={true} />);
    
    expect(screen.getAllByRole('generic')).toHaveLength(3); // 3 skeleton items
  });

  it('shows empty state when no lists', () => {
    render(<ListsPanel {...defaultProps} lists={[]} />);
    
    expect(screen.getByText('No lists yet')).toBeInTheDocument();
    expect(screen.getByText('Create your first list to get started')).toBeInTheDocument();
    expect(screen.getByText('Create List')).toBeInTheDocument();
  });

  it('calls onListSelect when list is clicked', () => {
    render(<ListsPanel {...defaultProps} />);
    
    fireEvent.click(screen.getByText('Work Tasks'));
    
    expect(defaultProps.onListSelect).toHaveBeenCalledWith('1');
  });

  it('highlights selected list', () => {
    render(<ListsPanel {...defaultProps} selectedListId="1" />);
    
    const workTasksItem = screen.getByText('Work Tasks').closest('div');
    expect(workTasksItem).toHaveClass('bg-orange-100');
  });

  it('opens create dialog when plus button is clicked', () => {
    render(<ListsPanel {...defaultProps} />);
    
    fireEvent.click(screen.getByTitle('Create new list'));
    
    expect(screen.getByText('Create New List')).toBeInTheDocument();
  });

  it('opens create dialog from empty state button', () => {
    render(<ListsPanel {...defaultProps} lists={[]} />);
    
    fireEvent.click(screen.getByText('Create List'));
    
    expect(screen.getByText('Create New List')).toBeInTheDocument();
  });

  it('calls onListCreate when list is created', async () => {
    render(<ListsPanel {...defaultProps} />);
    
    // Open create dialog
    fireEvent.click(screen.getByTitle('Create new list'));
    
    // Fill form
    fireEvent.change(screen.getByPlaceholderText('Enter list name'), {
      target: { value: 'New List' },
    });
    
    // Submit form
    fireEvent.click(screen.getByText('Create List'));
    
    await waitFor(() => {
      expect(defaultProps.onListCreate).toHaveBeenCalledWith({
        name: 'New List',
        emoji: '📋',
      });
    });
  });

  it('shows context menu when more options is clicked', () => {
    render(<ListsPanel {...defaultProps} />);
    
    // Hover over list item to show context menu button
    const listItem = screen.getByText('Work Tasks').closest('div');
    fireEvent.mouseEnter(listItem!);
    
    // Click context menu button
    fireEvent.click(screen.getByTitle('More options'));
    
    expect(screen.getByText('Rename List')).toBeInTheDocument();
    expect(screen.getByText('Delete List')).toBeInTheDocument();
  });

  it('enters edit mode when rename is clicked', () => {
    render(<ListsPanel {...defaultProps} />);
    
    // Open context menu
    const listItem = screen.getByText('Work Tasks').closest('div');
    fireEvent.mouseEnter(listItem!);
    fireEvent.click(screen.getByTitle('More options'));
    
    // Click rename
    fireEvent.click(screen.getByText('Rename List'));
    
    // Should show input field
    expect(screen.getByDisplayValue('Work Tasks')).toBeInTheDocument();
  });

  it('shows delete confirmation when delete is clicked', () => {
    render(<ListsPanel {...defaultProps} />);
    
    // Open context menu
    const listItem = screen.getByText('Work Tasks').closest('div');
    fireEvent.mouseEnter(listItem!);
    fireEvent.click(screen.getByTitle('More options'));
    
    // Click delete
    fireEvent.click(screen.getByText('Delete List'));
    
    expect(screen.getByText('Delete List')).toBeInTheDocument();
    expect(screen.getByText(/Are you sure you want to delete "Work Tasks"/)).toBeInTheDocument();
  });

  it('calls onListDelete when delete is confirmed', () => {
    render(<ListsPanel {...defaultProps} />);
    
    // Open context menu and click delete
    const listItem = screen.getByText('Work Tasks').closest('div');
    fireEvent.mouseEnter(listItem!);
    fireEvent.click(screen.getByTitle('More options'));
    fireEvent.click(screen.getByText('Delete List'));
    
    // Confirm deletion
    fireEvent.click(screen.getByText('Delete'));
    
    expect(defaultProps.onListDelete).toHaveBeenCalledWith('1');
  });

  it('shows task count warning in delete confirmation', () => {
    render(<ListsPanel {...defaultProps} />);
    
    // Open context menu and click delete
    const listItem = screen.getByText('Work Tasks').closest('div');
    fireEvent.mouseEnter(listItem!);
    fireEvent.click(screen.getByTitle('More options'));
    fireEvent.click(screen.getByText('Delete List'));
    
    expect(screen.getByText(/This list contains 5 task\(s\)/)).toBeInTheDocument();
  });

  it('calls onListUpdate when edit is saved', () => {
    render(<ListsPanel {...defaultProps} />);
    
    // Enter edit mode
    const listItem = screen.getByText('Work Tasks').closest('div');
    fireEvent.mouseEnter(listItem!);
    fireEvent.click(screen.getByTitle('More options'));
    fireEvent.click(screen.getByText('Rename List'));
    
    // Edit name
    const input = screen.getByDisplayValue('Work Tasks');
    fireEvent.change(input, { target: { value: 'Updated Work Tasks' } });
    
    // Save
    fireEvent.click(screen.getByTitle('Save'));
    
    expect(defaultProps.onListUpdate).toHaveBeenCalledWith('1', {
      name: 'Updated Work Tasks',
      emoji: '💼',
    });
  });

  it('cancels edit when escape is pressed', () => {
    render(<ListsPanel {...defaultProps} />);
    
    // Enter edit mode
    const listItem = screen.getByText('Work Tasks').closest('div');
    fireEvent.mouseEnter(listItem!);
    fireEvent.click(screen.getByTitle('More options'));
    fireEvent.click(screen.getByText('Rename List'));
    
    // Press escape
    const input = screen.getByDisplayValue('Work Tasks');
    fireEvent.keyDown(input, { key: 'Escape' });
    
    // Should exit edit mode
    expect(screen.queryByDisplayValue('Work Tasks')).not.toBeInTheDocument();
    expect(screen.getByText('Work Tasks')).toBeInTheDocument();
  });

  it('saves edit when enter is pressed', () => {
    render(<ListsPanel {...defaultProps} />);
    
    // Enter edit mode
    const listItem = screen.getByText('Work Tasks').closest('div');
    fireEvent.mouseEnter(listItem!);
    fireEvent.click(screen.getByTitle('More options'));
    fireEvent.click(screen.getByText('Rename List'));
    
    // Edit and press enter
    const input = screen.getByDisplayValue('Work Tasks');
    fireEvent.change(input, { target: { value: 'New Name' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    
    expect(defaultProps.onListUpdate).toHaveBeenCalledWith('1', {
      name: 'New Name',
      emoji: '💼',
    });
  });
});