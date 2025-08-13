import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ResponsiveLayout } from '../components/layout/responsive-layout';
import { TodoDetailPane } from '../components/calendar/todo-detail-pane';
import { TimerDisplay } from '../components/timer/timer-display';
import { useSelectedTodo } from '../hooks/use-selected-todo';
import { useLists, useCreateList, useUpdateList, useDeleteList, useListTasks } from '../hooks/use-lists';
import { useCreateTaskInList, useUpdateTask, useDeleteTask } from '../hooks/use-list-tasks';
import { type CreateListRequest, type UpdateListRequest } from '@shared/list-types';
import { type UpdateTask } from '@shared/schema';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { Toaster } from '@/components/ui/toaster';
import { Plus, Edit3, Trash2 } from 'lucide-react';
import { CreateListDialog } from '@/components/lists/create-list-dialog';
import { SelectableTodoItem } from '@/components/calendar/selectable-todo-item';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MinimalisticSidebar } from '@/components/calendar/minimalistic-sidebar';

interface ListsState {
  selectedListId: string | null;
}

export function Lists() {
  const [state, setState] = useState<ListsState>({
    selectedListId: null,
  });
  const [isCreateListOpen, setIsCreateListOpen] = useState<boolean>(false);
  const [listSearch, setListSearch] = useState<string>('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'pending' | 'completed'>('all');
  const [sortBy, setSortBy] = useState<'startTime' | 'priority' | 'title'>('startTime');
  const [showNewTaskInput, setShowNewTaskInput] = useState<boolean>(false);
  const [newTaskTitle, setNewTaskTitle] = useState<string>('');
  const newTaskInputRef = useRef<HTMLInputElement>(null);

  // Use global selected todo context
  const { selectedTodoId, isDetailPaneOpen, selectTodo, closeDetailPane } = useSelectedTodo();

  // Fetch data using custom hooks
  const { data: lists = [], isLoading: listsLoading } = useLists();
  const { data: tasks = [], isLoading: tasksLoading } = useListTasks(state.selectedListId);

  // Get selected list
  const selectedList = lists.find(list => list.id === state.selectedListId) || null;

  // Mutations
  const createListMutation = useCreateList();
  const updateListMutation = useUpdateList();
  const deleteListMutation = useDeleteList();
  const createTaskMutation = useCreateTaskInList();
  const updateTaskMutation = useUpdateTask();
  const deleteTaskMutation = useDeleteTask();



  // Event handlers
  const handleListSelect = (listId: string) => {
    setState(prev => ({ 
      ...prev, 
      selectedListId: listId,
    }));
    // Clear task selection when switching lists
    selectTodo(null);
  };

  const handleListCreate = (listData: CreateListRequest) => {
    createListMutation.mutate(listData, {
      onSuccess: (newList) => {
        setState(prev => ({ ...prev, selectedListId: newList.id }));
        setIsCreateListOpen(false);
      },
    });
  };

  const handleListUpdate = (listId: string, updates: UpdateListRequest) => {
    updateListMutation.mutate({ listId, updates });
  };

  const handleListDelete = (listId: string) => {
    deleteListMutation.mutate(listId, {
      onSuccess: () => {
        if (state.selectedListId === listId) {
          setState(prev => ({ ...prev, selectedListId: null }));
          selectTodo(null);
        }
      },
    });
  };

  const handleTaskSelect = (taskId: string) => {
    selectTodo(taskId);
  };

  const handleTaskCreate = (taskData: {
    title: string;
    description?: string;
    notes?: string;
    startTime: Date;
    endTime: Date;
    priority?: 'low' | 'medium' | 'high';
  }) => {
    if (!state.selectedListId) return;
    
    createTaskMutation.mutate({
      ...taskData,
      listId: state.selectedListId,
      completed: false,
      // New tasks should be unscheduled by default
      scheduledDate: null,
    }, {
      onSuccess: (newTask) => {
        selectTodo(newTask.id);
        setShowNewTaskInput(false);
        setNewTaskTitle('');
      },
    });
  };

  const handleTaskUpdate = (taskId: string, updates: UpdateTask) => {
    updateTaskMutation.mutate({ taskId, updates });
  };

  const handleTaskDelete = (taskId: string) => {
    deleteTaskMutation.mutate(taskId, {
      onSuccess: () => {
        // Clear selection if deleted task was selected
        if (selectedTodoId === taskId) {
          selectTodo(null);
        }
      },
    });
  };

  const handleTaskToggleComplete = (taskId: string, completed: boolean) => {
    const newCompleted = !completed;
    const updates: UpdateTask = { completed: newCompleted } as UpdateTask;
    // If marking as complete, set due date (scheduledDate) to today
    if (newCompleted) {
      updates.scheduledDate = new Date();
    }
    updateTaskMutation.mutate({ taskId, updates });
  };



  // Select first list by default when lists load
  useEffect(() => {
    if (!listsLoading && !state.selectedListId && lists.length > 0) {
      setState((prev) => ({ ...prev, selectedListId: lists[0].id }));
    }
  }, [listsLoading, lists, state.selectedListId]);  
  
  // Render icon navigation sidebar
  const renderSidebar = () => (
    <MinimalisticSidebar />
  );

  // Derived lists filtered by search
  const filteredLists = useMemo(() => {
    const q = listSearch.trim().toLowerCase();
    if (!q) return lists;
    return lists.filter(l => l.name.toLowerCase().includes(q));
  }, [lists, listSearch]);

  // Derived tasks by filter/sort
  const displayTasks = useMemo(() => {
    const base = tasks.filter(t => {
      if (activeFilter === 'pending') return !t.completed;
      if (activeFilter === 'completed') return !!t.completed;
      return true;
    });
    const sorted = [...base].sort((a, b) => {
      if (sortBy === 'startTime') return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
      if (sortBy === 'priority') {
        const order: any = { high: 3, medium: 2, low: 1 };
        return (order[a.priority as keyof typeof order] || 0) - (order[b.priority as keyof typeof order] || 0);
      }
      return a.title.localeCompare(b.title);
    });
    return sorted;
  }, [tasks, activeFilter, sortBy]);

  // Focus new task input when shown
  useEffect(() => {
    if (showNewTaskInput && newTaskInputRef.current) {
      newTaskInputRef.current.focus();
    }
  }, [showNewTaskInput]);

  // Render main content
  const renderMainContent = () => (
    <div className="h-full bg-white flex">
      {/* Lists Panel */}
      <div className="w-80 flex-shrink-0 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-xl font-semibold text-gray-900">Lists</h1>
            <button
              className="w-8 h-8 bg-orange-50 text-orange-600 rounded-lg flex items-center justify-center hover:bg-orange-600 hover:text-white transition-colors"
              onClick={() => setIsCreateListOpen(true)}
              title="Create list"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <div className="relative">
            <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
            </svg>
            <input
              type="text"
              placeholder="Search lists..."
              value={listSearch}
              onChange={(e) => setListSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-600 focus:border-transparent transition-all"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {listsLoading ? (
            <div className="text-sm text-gray-500">Loading...</div>
          ) : (
            filteredLists.map((list) => (
              <div
                key={list.id}
                className={`group flex items-center justify-between p-3 rounded-lg cursor-pointer transition-all ${
                  state.selectedListId === list.id ? 'bg-orange-50 border-l-4 border-orange-500' : 'hover:bg-gray-50'
                }`}
                onClick={() => handleListSelect(list.id)}
              >
                <div className="flex items-center space-x-3">
                  <span className="text-xl">{list.emoji}</span>
                  <div>
                    <h3 className="font-medium text-gray-900">{list.name}</h3>
                    <p className="text-sm text-gray-500">{list.taskCount ?? 0} task{(list.taskCount ?? 0) === 1 ? '' : 's'}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    className="w-6 h-6 text-gray-400 hover:text-orange-600"
                    onClick={(e) => {
                      e.stopPropagation();
                      const newName = window.prompt('Rename list', list.name)?.trim();
                      if (newName && newName !== list.name) handleListUpdate(list.id, { name: newName });
                    }}
                    title="Rename"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    className="w-6 h-6 text-gray-400 hover:text-red-500"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (window.confirm('Delete this list?')) handleListDelete(list.id);
                    }}
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Todos Panel */}
      <div className="flex-1 min-w-0 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <span className="text-2xl">{selectedList?.emoji ?? '📋'}</span>
              <div>
                <h1 className="text-2xl font-semibold text-gray-900">{selectedList?.name ?? 'Select a list'}</h1>
                {selectedList && null}
              </div>
            </div>
            <button
              className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors flex items-center space-x-2 disabled:opacity-50"
              onClick={() => {
                if (!state.selectedListId) return;
                setShowNewTaskInput(true);
                setTimeout(() => newTaskInputRef.current?.focus(), 0);
              }}
              disabled={!state.selectedListId}
            >
              <Plus className="w-4 h-4" />
              <span>Add Task</span>
            </button>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <button
                className={`px-3 py-1 rounded-md text-sm font-medium ${activeFilter === 'all' ? 'bg-orange-50 text-orange-600' : 'text-gray-500 hover:bg-gray-100'}`}
                onClick={() => setActiveFilter('all')}
              >
                All
              </button>
              <button
                className={`px-3 py-1 rounded-md text-sm ${activeFilter === 'pending' ? 'bg-orange-50 text-orange-600' : 'text-gray-500 hover:bg-gray-100'}`}
                onClick={() => setActiveFilter('pending')}
              >
                Pending
              </button>
              <button
                className={`px-3 py-1 rounded-md text-sm ${activeFilter === 'completed' ? 'bg-orange-50 text-orange-600' : 'text-gray-500 hover:bg-gray-100'}`}
                onClick={() => setActiveFilter('completed')}
              >
                Completed
              </button>
            </div>
            <div className="ml-auto w-[200px]">
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
                <SelectTrigger className="h-8 text-sm rounded-md border border-gray-200 px-3 py-1 focus:ring-2 focus:ring-orange-600 focus:ring-offset-0">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="title">Sort by Name</SelectItem>
                  <SelectItem value="priority">Sort by Priority</SelectItem>
                  <SelectItem value="startTime">Sort by Due Date</SelectItem>                  
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Todos list */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {tasksLoading ? (
            <div className="text-sm text-gray-500">Loading...</div>
          ) : (
            displayTasks.map((task) => (
              <SelectableTodoItem
                key={task.id}
                task={task}
                isSelected={selectedTodoId === task.id}
                onSelect={handleTaskSelect}
                onToggleComplete={handleTaskToggleComplete}
                onUpdate={handleTaskUpdate}
                onDelete={handleTaskDelete}
                variant="list"
                showTime={false}
                showDate={false}
                showTimer={false}
                showLoggedTime={false}
                showEstimate={false}
                showListChip={false}
                showUnscheduledBadge
              />
            ))
          )}

          {/* Add new */}
          <div
            className="flex items-center space-x-4 p-4 border-2 border-dashed border-gray-200 rounded-lg hover:border-orange-600 transition-colors cursor-pointer"
            onClick={() => {
              if (!state.selectedListId) return;
              setShowNewTaskInput(true);
            }}
          >
            <div className="w-5 h-5 border-2 border-gray-300 rounded-full"></div>
            {showNewTaskInput ? (
              <input
                ref={newTaskInputRef}
                type="text"
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newTaskTitle.trim()) {
                    const start = new Date();
                    const end = new Date(start.getTime() + 30 * 60 * 1000);
                    handleTaskCreate({ title: newTaskTitle.trim(), startTime: start, endTime: end });
                  } else if (e.key === 'Escape') {
                    setShowNewTaskInput(false);
                    setNewTaskTitle('');
                  }
                }}
                placeholder="Add a new task..."
                className="flex-1 bg-transparent outline-none text-gray-600 placeholder-gray-400"
              />
            ) : (
              <span className="flex-1 text-gray-500">Add a new task...</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  // Render detail pane
  const renderDetailPane = () => (
    selectedTodoId ? (
      <TodoDetailPane
        onClose={closeDetailPane}
      />
    ) : (
      <div className="h-full bg-white flex items-center justify-center">
        <div className="text-center text-gray-500">
          <div className="text-4xl mb-2">📝</div>
          <p className="text-sm">Select a task to view details</p>
        </div>
      </div>
    )
  );

  return (
    <>
      <DndProvider backend={HTML5Backend}>
        <ResponsiveLayout
          sidebar={renderSidebar()}
          main={renderMainContent()}
          detail={renderDetailPane()}
          isDetailOpen={isDetailPaneOpen}
          onDetailClose={closeDetailPane}
          detailWidthClass="w-[480px]"
        />
      </DndProvider>

      {/* Global Timer Display */}
      <div className="fixed top-4 right-4 z-50">
        <TimerDisplay compact />
      </div>

      <Toaster />

      {isCreateListOpen && (
        <CreateListDialog
          onCreateList={async (data) => handleListCreate(data)}
          onClose={() => setIsCreateListOpen(false)}
        />
      )}
    </>
  );
}