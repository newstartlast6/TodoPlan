import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SelectableTodoItem } from '../selectable-todo-item';
import { TodoDetailPane } from '../todo-detail-pane';
import { DayView } from '../day-view';
import { TimerProvider } from '@/contexts/timer-context';
import { useSelectedTodo } from '@/hooks/use-selected-todo';
import { Task } from '@shared/schema';

// Mock hooks and services
jest.mock('@/hooks/use-selected-todo');
jest.mock('@/hooks/use-timer-state');
jest.mock('@/services/timer-api-client');
jest.mock('@shared/services/timer-service');
jest.mock('@shared/services/persistence-service');
jest.mock('@shared/services/sync-service');

const mockUseSelectedTodo = useSelectedTodo as jest.MockedFunction<typeof useSelectedTodo>;

// Mock timer hooks
const mockTimerHooks = {
  useTaskTimer: jest.fn(),
  useTimerState: jest.fn(),
  useTimerActions: jest.fn(),
  useDailyTimerStats: jest.fn(),
};

jest.mock('@/hooks/use-timer-state', () => mockTimerHooks);

// Test wrapper component
function TestWrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return (
    <QueryClientProvider client={queryClient}>
      <TimerProvider>
        {children}
      </TimerProvider>
    </QueryClientProvider>
  );
}

// Sample task data
const sampleTask: Task = {
  id: 'task-1',
  title: 'Test Task',
  notes: 'Test notes',
  startTime: new Date('2024-01-15T09:00:00Z'),
  endTime: new Date('2024-01-15T10:00:00Z'),
  priority: 'medium',
  completed: false,
  createdAt: new Date('2024-01-15T08:00:00Z'),
  updatedAt: new Date('2024-01-15T08:00:00Z'),
  timeLoggedSeconds: 0,
};

describe('Timer Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default mock implementations
    mockUseSelectedTodo.mockReturnValue({
      selectedTodoId: null,
      selectTodo: jest.fn(),
      closeDetailPane: jest.fn(),
    });

    mockTimerHooks.useTaskTimer.mockReturnValue({
      taskId: 'task-1',
      isActiveTask: false,
      isRunning: false,
      totalTaskSeconds: 0,
      currentSessionSeconds: 0,
      totalTimeSeconds: 0,
      sessionCount: 0,
      formattedTotalTime: '0:00',
      formattedCurrentSession: '0:00',
    });

    mockTimerHooks.useTimerState.mockReturnValue({
      activeSession: undefined,
      dailySummary: [],
      isLoading: false,
      error: undefined,
      currentElapsedSeconds: 0,
      isTimerRunning: false,
      currentTaskId: undefined,
      totalDailySeconds: 0,
      remainingSeconds: 28800, // 8 hours
      dailyProgressPercentage: 0,
      isOverDailyTarget: false,
      formattedDailyTotal: '0:00',
      formattedRemainingTime: '8:00',
      formattedElapsedTime: '0:00',
      dailyTargetHours: 8,
    });

    mockTimerHooks.useTimerActions.mockReturnValue({
      startTimer: jest.fn(),
      pauseTimer: jest.fn(),
      resumeTimer: jest.fn(),
      stopTimer: jest.fn(),
      switchTimer: jest.fn(),
    });

    mockTimerHooks.useDailyTimerStats.mockReturnValue({
      date: '2024-01-15',
      totalSeconds: 0,
      remainingSeconds: 28800,
      progressPercentage: 0,
      isOverTarget: false,
      taskCount: 0,
      sessionCount: 0,
      mostWorkedTask: null,
      tasks: [],
      formattedTotal: '0:00',
      formattedRemaining: '8:00',
      formattedTarget: '8:00',
    });
  });

  describe('SelectableTodoItem Timer Integration', () => {
    it('should display timer button when showTimer is true', () => {
      render(
        <TestWrapper>
          <SelectableTodoItem
            task={sampleTask}
            isSelected={false}
            onSelect={jest.fn()}
            onToggleComplete={jest.fn()}
            showTimer={true}
          />
        </TestWrapper>
      );

      expect(screen.getByRole('button', { name: /start timer/i })).toBeInTheDocument();
    });

    it('should not display timer button when task is completed', () => {
      const completedTask = { ...sampleTask, completed: true };

      render(
        <TestWrapper>
          <SelectableTodoItem
            task={completedTask}
            isSelected={false}
            onSelect={jest.fn()}
            onToggleComplete={jest.fn()}
            showTimer={true}
          />
        </TestWrapper>
      );

      expect(screen.queryByRole('button', { name: /start timer/i })).not.toBeInTheDocument();
    });

    it('should show active timer status when task has active timer', () => {
      mockTimerHooks.useTaskTimer.mockReturnValue({
        taskId: 'task-1',
        isActiveTask: true,
        isRunning: true,
        totalTaskSeconds: 1800, // 30 minutes
        currentSessionSeconds: 600, // 10 minutes
        totalTimeSeconds: 1800,
        sessionCount: 2,
        formattedTotalTime: '30:00',
        formattedCurrentSession: '10:00',
      });

      render(
        <TestWrapper>
          <SelectableTodoItem
            task={sampleTask}
            isSelected={false}
            onSelect={jest.fn()}
            onToggleComplete={jest.fn()}
            showTimer={true}
          />
        </TestWrapper>
      );

      expect(screen.getByText('Timer Running')).toBeInTheDocument();
    });

    it('should show total time when task has logged time', () => {
      mockTimerHooks.useTaskTimer.mockReturnValue({
        taskId: 'task-1',
        isActiveTask: false,
        isRunning: false,
        totalTaskSeconds: 3600, // 1 hour
        currentSessionSeconds: 0,
        totalTimeSeconds: 3600,
        sessionCount: 3,
        formattedTotalTime: '1:00',
        formattedCurrentSession: '0:00',
      });

      render(
        <TestWrapper>
          <SelectableTodoItem
            task={sampleTask}
            isSelected={false}
            onSelect={jest.fn()}
            onToggleComplete={jest.fn()}
            showTimer={true}
          />
        </TestWrapper>
      );

      expect(screen.getByText('1:00')).toBeInTheDocument();
    });

    it('should not trigger selection when clicking timer controls', () => {
      const onSelect = jest.fn();

      render(
        <TestWrapper>
          <SelectableTodoItem
            task={sampleTask}
            isSelected={false}
            onSelect={onSelect}
            onToggleComplete={jest.fn()}
            showTimer={true}
          />
        </TestWrapper>
      );

      const timerButton = screen.getByRole('button', { name: /start timer/i });
      fireEvent.click(timerButton);

      expect(onSelect).not.toHaveBeenCalled();
    });
  });

  describe('TodoDetailPane Timer Integration', () => {
    beforeEach(() => {
      mockUseSelectedTodo.mockReturnValue({
        selectedTodoId: 'task-1',
        selectTodo: jest.fn(),
        closeDetailPane: jest.fn(),
      });

      // Mock the fetch for task details
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(sampleTask),
      });
    });

    it('should display timer section for non-completed tasks', async () => {
      render(
        <TestWrapper>
          <TodoDetailPane />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Time Tracking')).toBeInTheDocument();
      });
    });

    it('should show active timer display when task has active timer', async () => {
      mockTimerHooks.useTimerState.mockReturnValue({
        activeSession: {
          id: 'session-1',
          taskId: 'task-1',
          startTime: new Date(),
          durationSeconds: 600,
          isActive: true,
        },
        isTimerRunning: true,
        currentTaskId: 'task-1',
        formattedElapsedTime: '10:00',
        isLoading: false,
        error: undefined,
      } as any);

      render(
        <TestWrapper>
          <TodoDetailPane />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Time Tracking')).toBeInTheDocument();
      });
    });

    it('should show time logged summary when task has logged time', async () => {
      mockTimerHooks.useTaskTimer.mockReturnValue({
        taskId: 'task-1',
        isActiveTask: false,
        isRunning: false,
        totalTaskSeconds: 7200, // 2 hours
        currentSessionSeconds: 0,
        totalTimeSeconds: 7200,
        sessionCount: 4,
        formattedTotalTime: '2:00',
        formattedCurrentSession: '0:00',
      });

      render(
        <TestWrapper>
          <TodoDetailPane />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Time Logged Today')).toBeInTheDocument();
        expect(screen.getByText('2:00')).toBeInTheDocument();
        expect(screen.getByText('4 sessions')).toBeInTheDocument();
      });
    });

    it('should not show timer section for completed tasks', async () => {
      const completedTask = { ...sampleTask, completed: true };
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(completedTask),
      });

      render(
        <TestWrapper>
          <TodoDetailPane />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.queryByText('Time Tracking')).not.toBeInTheDocument();
      });
    });
  });

  describe('DayView Timer Integration', () => {
    const sampleTasks = [
      sampleTask,
      {
        ...sampleTask,
        id: 'task-2',
        title: 'Second Task',
        startTime: new Date('2024-01-15T10:00:00Z'),
        endTime: new Date('2024-01-15T11:00:00Z'),
        completed: true,
      },
    ];

    it('should display timer summary card', () => {
      mockTimerHooks.useDailyTimerStats.mockReturnValue({
        date: '2024-01-15',
        totalSeconds: 7200, // 2 hours
        remainingSeconds: 21600, // 6 hours
        progressPercentage: 25,
        isOverTarget: false,
        taskCount: 2,
        sessionCount: 5,
        mostWorkedTask: null,
        tasks: [],
        formattedTotal: '2:00',
        formattedRemaining: '6:00',
        formattedTarget: '8:00',
      });

      render(
        <TestWrapper>
          <DayView
            tasks={sampleTasks}
            currentDate={new Date('2024-01-15')}
            onTaskUpdate={jest.fn()}
            onAddTask={jest.fn()}
          />
        </TestWrapper>
      );

      expect(screen.getByTestId('timer-summary-card')).toBeInTheDocument();
      expect(screen.getByText('Time Tracking')).toBeInTheDocument();
      expect(screen.getByTestId('timer-total')).toHaveTextContent('2:00');
      expect(screen.getByTestId('timer-tasks')).toHaveTextContent('2');
      expect(screen.getByTestId('timer-progress')).toHaveTextContent('25%');
    });

    it('should show detailed timer summary for current day with logged time', () => {
      const today = new Date();
      mockTimerHooks.useDailyTimerStats.mockReturnValue({
        date: today.toISOString().split('T')[0],
        totalSeconds: 3600, // 1 hour
        remainingSeconds: 25200, // 7 hours
        progressPercentage: 12.5,
        isOverTarget: false,
        taskCount: 1,
        sessionCount: 2,
        mostWorkedTask: null,
        tasks: [],
        formattedTotal: '1:00',
        formattedRemaining: '7:00',
        formattedTarget: '8:00',
      });

      render(
        <TestWrapper>
          <DayView
            tasks={[{ ...sampleTask, startTime: today, endTime: new Date(today.getTime() + 3600000) }]}
            currentDate={today}
            onTaskUpdate={jest.fn()}
            onAddTask={jest.fn()}
          />
        </TestWrapper>
      );

      expect(screen.getByTestId('detailed-timer-summary')).toBeInTheDocument();
    });

    it('should not show detailed timer summary for past days', () => {
      const pastDate = new Date('2024-01-10');
      mockTimerHooks.useDailyTimerStats.mockReturnValue({
        date: '2024-01-10',
        totalSeconds: 3600,
        remainingSeconds: 25200,
        progressPercentage: 12.5,
        isOverTarget: false,
        taskCount: 1,
        sessionCount: 2,
        mostWorkedTask: null,
        tasks: [],
        formattedTotal: '1:00',
        formattedRemaining: '7:00',
        formattedTarget: '8:00',
      });

      render(
        <TestWrapper>
          <DayView
            tasks={[{ ...sampleTask, startTime: pastDate, endTime: new Date(pastDate.getTime() + 3600000) }]}
            currentDate={pastDate}
            onTaskUpdate={jest.fn()}
            onAddTask={jest.fn()}
          />
        </TestWrapper>
      );

      expect(screen.queryByTestId('detailed-timer-summary')).not.toBeInTheDocument();
    });

    it('should integrate timer controls in task items', () => {
      render(
        <TestWrapper>
          <DayView
            tasks={sampleTasks}
            currentDate={new Date('2024-01-15')}
            onTaskUpdate={jest.fn()}
            onAddTask={jest.fn()}
          />
        </TestWrapper>
      );

      // Should show timer button for non-completed task
      const timerButtons = screen.getAllByRole('button', { name: /start timer/i });
      expect(timerButtons).toHaveLength(1); // Only for the non-completed task
    });
  });

  describe('Cross-Component Timer State Consistency', () => {
    it('should maintain consistent timer state across components', async () => {
      const activeSession = {
        id: 'session-1',
        taskId: 'task-1',
        startTime: new Date(),
        durationSeconds: 1800, // 30 minutes
        isActive: true,
      };

      mockTimerHooks.useTimerState.mockReturnValue({
        activeSession,
        isTimerRunning: true,
        currentTaskId: 'task-1',
        formattedElapsedTime: '30:00',
        isLoading: false,
        error: undefined,
      } as any);

      mockTimerHooks.useTaskTimer.mockReturnValue({
        taskId: 'task-1',
        isActiveTask: true,
        isRunning: true,
        totalTaskSeconds: 1800,
        currentSessionSeconds: 1800,
        totalTimeSeconds: 1800,
        sessionCount: 1,
        formattedTotalTime: '30:00',
        formattedCurrentSession: '30:00',
      });

      mockUseSelectedTodo.mockReturnValue({
        selectedTodoId: 'task-1',
        selectTodo: jest.fn(),
        closeDetailPane: jest.fn(),
      });

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(sampleTask),
      });

      const { rerender } = render(
        <TestWrapper>
          <div>
            <SelectableTodoItem
              task={sampleTask}
              isSelected={true}
              onSelect={jest.fn()}
              onToggleComplete={jest.fn()}
              showTimer={true}
            />
            <TodoDetailPane />
          </div>
        </TestWrapper>
      );

      // Both components should show consistent timer state
      expect(screen.getByText('Timer Running')).toBeInTheDocument();
      
      await waitFor(() => {
        expect(screen.getByText('Time Tracking')).toBeInTheDocument();
      });

      // Update timer state
      mockTimerHooks.useTimerState.mockReturnValue({
        activeSession: { ...activeSession, isActive: false },
        isTimerRunning: false,
        currentTaskId: 'task-1',
        formattedElapsedTime: '30:00',
        isLoading: false,
        error: undefined,
      } as any);

      mockTimerHooks.useTaskTimer.mockReturnValue({
        taskId: 'task-1',
        isActiveTask: true,
        isRunning: false,
        totalTaskSeconds: 1800,
        currentSessionSeconds: 1800,
        totalTimeSeconds: 1800,
        sessionCount: 1,
        formattedTotalTime: '30:00',
        formattedCurrentSession: '30:00',
      });

      rerender(
        <TestWrapper>
          <div>
            <SelectableTodoItem
              task={sampleTask}
              isSelected={true}
              onSelect={jest.fn()}
              onToggleComplete={jest.fn()}
              showTimer={true}
            />
            <TodoDetailPane />
          </div>
        </TestWrapper>
      );

      // Both components should show paused state
      expect(screen.getByText('Timer Paused')).toBeInTheDocument();
    });
  });
});