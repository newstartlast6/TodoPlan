import React, { useState } from 'react';
import { Plus, Filter, SortAsc, CheckSquare, Square } from 'lucide-react';
import { type List, type ListStatistics } from '@shared/list-types';
import { type Task } from '@shared/schema';
import { SelectableTodoItem } from '../calendar/selectable-todo-item';
import { AddTaskDialog } from './add-task-dialog';
import { EmptyListState } from './empty-list-state';

interface ListDetailPanelProps {
  list: List | null;
  tasks: Task[];
  selectedTaskId: string | null;
  onTaskSelect: (taskId: string) => void;
  onTaskCreate: (task: {
    title: string;
    description?: string;
    notes?: string;
    startTime: Date;
    endTime: Date;
    priority?: 'low' | 'medium' | 'high';
  }) => void;
  onTaskUpdate: (taskId: string, updates: Partial<Task>) => void;
  onTaskDelete: (taskId: string) => void;
  onTaskToggleComplete: (taskId: string, completed: boolean) => void;
  isLoading?: boolean;
}

interface TaskFilter {
  showCompleted: boolean;
  priority?: 'low' | 'medium' | 'high';
}

interface TaskSort {
  field: 'title' | 'startTime' | 'priority' | 'completed';
  direction: 'asc' | 'desc';
}

export function ListDetailPanel({
  list,
  tasks,
  selectedTaskId,
  onTaskSelect,
  onTaskCreate,
  onTaskUpdate,
  onTaskDelete,
  onTaskToggleComplete,
  isLoading = false,
}: ListDetailPanelProps) {
  const [isAddTaskDialogOpen, setIsAddTaskDialogOpen] = useState(false);
  const [filter, setFilter] = useState<TaskFilter>({ showCompleted: true });
  const [sort, setSort] = useState<TaskSort>({ field: 'startTime', direction: 'asc' });
  const [showFilters, setShowFilters] = useState(false);

  // Calculate list statistics
  const statistics: ListStatistics = {
    totalTasks: tasks.length,
    completedTasks: tasks.filter(task => task.completed).length,
    pendingTasks: tasks.filter(task => !task.completed).length,
    completionRate: tasks.length > 0 ? Math.round((tasks.filter(task => task.completed).length / tasks.length) * 100) : 0,
    averageTaskDuration: 0, // Could be calculated from task durations
    totalTimeSpent: 0, // Could be calculated from timer data
  };

  // Filter and sort tasks
  const filteredAndSortedTasks = tasks
    .filter(task => {
      if (!filter.showCompleted && task.completed) return false;
      if (filter.priority && task.priority !== filter.priority) return false;
      return true;
    })
    .sort((a, b) => {
      let comparison = 0;
      
      switch (sort.field) {
        case 'title':
          comparison = a.title.localeCompare(b.title);
          break;
        case 'startTime':
          comparison = new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
          break;
        case 'priority':
          const priorityOrder = { high: 3, medium: 2, low: 1 };
          comparison = priorityOrder[a.priority as keyof typeof priorityOrder] - priorityOrder[b.priority as keyof typeof priorityOrder];
          break;
        case 'completed':
          comparison = (a.completed ? 1 : 0) - (b.completed ? 1 : 0);
          break;
      }
      
      return sort.direction === 'desc' ? -comparison : comparison;
    });

  const handleAddTask = (taskData: {
    title: string;
    description?: string;
    notes?: string;
    startTime: Date;
    endTime: Date;
    priority?: 'low' | 'medium' | 'high';
  }) => {
    onTaskCreate(taskData);
    setIsAddTaskDialogOpen(false);
  };

  const toggleCompletedFilter = () => {
    setFilter(prev => ({ ...prev, showCompleted: !prev.showCompleted }));
  };

  if (!list) {
    return (
      <div className="h-full bg-white border-r border-gray-200 flex items-center justify-center">
        <div className="text-center text-gray-500">
          <div className="text-4xl mb-2">📋</div>
          <p className="text-sm">Select a list to view tasks</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-white border-r border-gray-200 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center gap-3 mb-3">
          <span className="text-2xl">{list.emoji}</span>
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-gray-900">{list.name}</h2>
            <div className="text-sm text-gray-500">
              {statistics.totalTasks} task{statistics.totalTasks !== 1 ? 's' : ''}
              {statistics.totalTasks > 0 && (
                <span> • {statistics.completionRate}% complete</span>
              )}
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        {statistics.totalTasks > 0 && (
          <div className="w-full bg-gray-200 rounded-full h-2 mb-3">
            <div
              className="bg-orange-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${statistics.completionRate}%` }}
            />
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsAddTaskDialogOpen(true)}
            className="flex items-center gap-2 px-3 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 transition-colors text-sm"
          >
            <Plus className="w-4 h-4" />
            Add Task
          </button>
          
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
            title="Filter tasks"
          >
            <Filter className="w-4 h-4" />
          </button>
          
          <button
            onClick={toggleCompletedFilter}
            className={`p-2 rounded-md transition-colors ${
              filter.showCompleted
                ? 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                : 'text-orange-600 bg-orange-100'
            }`}
            title={filter.showCompleted ? 'Hide completed tasks' : 'Show completed tasks'}
          >
            {filter.showCompleted ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
          </button>
        </div>

        {/* Filter Panel */}
        {showFilters && (
          <div className="mt-3 p-3 bg-gray-50 rounded-md">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600">Priority:</label>
                <select
                  value={filter.priority || ''}
                  onChange={(e) => setFilter(prev => ({ 
                    ...prev, 
                    priority: e.target.value as 'low' | 'medium' | 'high' | undefined || undefined 
                  }))}
                  className="text-sm border border-gray-300 rounded px-2 py-1"
                >
                  <option value="">All</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
              
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600">Sort by:</label>
                <select
                  value={sort.field}
                  onChange={(e) => setSort(prev => ({ 
                    ...prev, 
                    field: e.target.value as TaskSort['field']
                  }))}
                  className="text-sm border border-gray-300 rounded px-2 py-1"
                >
                  <option value="startTime">Time</option>
                  <option value="title">Title</option>
                  <option value="priority">Priority</option>
                  <option value="completed">Status</option>
                </select>
                
                <button
                  onClick={() => setSort(prev => ({ 
                    ...prev, 
                    direction: prev.direction === 'asc' ? 'desc' : 'asc' 
                  }))}
                  className="p-1 text-gray-500 hover:text-gray-700 rounded"
                  title={`Sort ${sort.direction === 'asc' ? 'descending' : 'ascending'}`}
                >
                  <SortAsc className={`w-4 h-4 ${sort.direction === 'desc' ? 'rotate-180' : ''}`} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Tasks List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-4">
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="flex items-center gap-3 p-4">
                    <div className="w-4 h-4 bg-gray-200 rounded-full"></div>
                    <div className="flex-1">
                      <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                      <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : filteredAndSortedTasks.length === 0 ? (
          tasks.length === 0 ? (
            <EmptyListState
              listName={list.name}
              onAddTask={() => setIsAddTaskDialogOpen(true)}
            />
          ) : (
            <div className="p-4 text-center">
              <div className="text-gray-500 mb-4">
                <div className="text-2xl mb-2">🔍</div>
                <p className="text-sm">No tasks match your filters</p>
                <p className="text-xs text-gray-400 mt-1">
                  Try adjusting your filter settings
                </p>
              </div>
            </div>
          )
        ) : (
          <div className="p-2">
            {filteredAndSortedTasks.map((task) => (
              <div key={task.id} className="mb-2">
                <SelectableTodoItem
                  task={task}
                  isSelected={selectedTaskId === task.id}
                  onSelect={onTaskSelect}
                  onToggleComplete={onTaskToggleComplete}
                  onUpdate={onTaskUpdate}
                  onDelete={onTaskDelete}
                  variant="list"
                  showTime={true}
                  showDate={false}
                  showTimer={true}
                  showLoggedTime={true}
                  showEstimate={true}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Task Dialog */}
      {isAddTaskDialogOpen && (
        <AddTaskDialog
          listId={list.id}
          onAddTask={handleAddTask}
          onClose={() => setIsAddTaskDialogOpen(false)}
        />
      )}
    </div>
  );
}