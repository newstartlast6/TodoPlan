import React, { useState, useEffect } from 'react';
import { MinimalisticSidebar } from '../components/calendar/minimalistic-sidebar';
import { ResponsiveLayout } from '../components/layout/responsive-layout';
import { ListsPanel } from '../components/lists/lists-panel';
import { ListDetailPanel } from '../components/lists/list-detail-panel';
import { TodoDetailPane } from '../components/calendar/todo-detail-pane';
import { TimerDisplay } from '../components/timer/timer-display';
import { useSelectedTodo } from '../hooks/use-selected-todo';
import { useLists, useCreateList, useUpdateList, useDeleteList, useListTasks } from '../hooks/use-lists';
import { useCreateTaskInList, useUpdateTask, useDeleteTask } from '../hooks/use-list-tasks';
import { type CreateListRequest, type UpdateListRequest } from '@shared/list-types';
import { type UpdateTask } from '@shared/schema';

interface ListsState {
  selectedListId: string | null;
}

export function Lists() {
  const [state, setState] = useState<ListsState>({
    selectedListId: null,
  });

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
      },
    });
  };

  const handleListUpdate = (listId: string, updates: UpdateListRequest) => {
    updateListMutation.mutate({ listId, updates });
  };

  const handleListDelete = (listId: string) => {
    deleteListMutation.mutate(listId, {
      onSuccess: () => {
        // Clear selection if deleted list was selected
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
    }, {
      onSuccess: (newTask) => {
        selectTodo(newTask.id);
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
    updateTaskMutation.mutate({ taskId, updates: { completed: !completed } });
  };



  // Render sidebar
  const renderSidebar = () => (
    <MinimalisticSidebar />
  );

  // Render main content
  const renderMainContent = () => (
    <div className="h-full bg-gray-50 flex">
      {/* Panel 1: Lists Sidebar */}
      <div className="w-80 flex-shrink-0">
        <ListsPanel
          lists={lists}
          selectedListId={state.selectedListId}
          onListSelect={handleListSelect}
          onListCreate={handleListCreate}
          onListUpdate={handleListUpdate}
          onListDelete={handleListDelete}
          isLoading={listsLoading}
        />
      </div>

      {/* Panel 2: List Detail */}
      <div className="flex-1 min-w-0">
        <ListDetailPanel
          list={selectedList}
          tasks={tasks}
          selectedTaskId={selectedTodoId}
          onTaskSelect={handleTaskSelect}
          onTaskCreate={handleTaskCreate}
          onTaskUpdate={handleTaskUpdate}
          onTaskDelete={handleTaskDelete}
          onTaskToggleComplete={handleTaskToggleComplete}
          isLoading={tasksLoading}
        />
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
      <ResponsiveLayout
        sidebar={renderSidebar()}
        main={renderMainContent()}
        detail={renderDetailPane()}
        isDetailOpen={isDetailPaneOpen}
        onDetailClose={closeDetailPane}
      />

      {/* Global Timer Display */}
      <div className="fixed top-4 right-4 z-50">
        <TimerDisplay compact />
      </div>
    </>
  );
}