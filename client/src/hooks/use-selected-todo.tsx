import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';

interface SelectionState {
  selectedTodoId: string | null;
  isDetailPaneOpen: boolean;
}

interface SelectionContextType {
  selectedTodoId: string | null;
  isDetailPaneOpen: boolean;
  selectTodo: (todoId: string | null) => void;
  openDetailPane: () => void;
  closeDetailPane: () => void;
  toggleDetailPane: () => void;
}

const SelectionContext = createContext<SelectionContextType | undefined>(undefined);

const STORAGE_KEY = 'todo-selection-state';

// Helper functions for localStorage
const loadSelectionState = (): SelectionState => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        selectedTodoId: parsed.selectedTodoId || null,
        isDetailPaneOpen: parsed.isDetailPaneOpen || false,
      };
    }
  } catch (error) {
    console.warn('Failed to load selection state from localStorage:', error);
  }
  return {
    selectedTodoId: null,
    isDetailPaneOpen: false,
  };
};

const saveSelectionState = (state: SelectionState) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.warn('Failed to save selection state to localStorage:', error);
  }
};

interface SelectionProviderProps {
  children: ReactNode;
}

export function SelectionProvider({ children }: SelectionProviderProps) {
  const [state, setState] = useState<SelectionState>(loadSelectionState);

  // Save state to localStorage whenever it changes
  useEffect(() => {
    saveSelectionState(state);
  }, [state]);

  const selectTodo = useCallback((todoId: string | null) => {
    setState(prev => ({
      ...prev,
      selectedTodoId: todoId,
      isDetailPaneOpen: todoId !== null, // Auto-open detail pane when selecting a todo
    }));
  }, []);

  const openDetailPane = useCallback(() => {
    setState(prev => ({ ...prev, isDetailPaneOpen: true }));
  }, []);

  const closeDetailPane = useCallback(() => {
    setState(prev => ({ 
      ...prev, 
      isDetailPaneOpen: false,
      selectedTodoId: null, // Clear selection when closing detail pane
    }));
  }, []);

  const toggleDetailPane = useCallback(() => {
    setState(prev => ({ ...prev, isDetailPaneOpen: !prev.isDetailPaneOpen }));
  }, []);

  const value: SelectionContextType = {
    selectedTodoId: state.selectedTodoId,
    isDetailPaneOpen: state.isDetailPaneOpen,
    selectTodo,
    openDetailPane,
    closeDetailPane,
    toggleDetailPane,
  };

  return (
    <SelectionContext.Provider value={value}>
      {children}
    </SelectionContext.Provider>
  );
}

export function useSelectedTodo() {
  const context = useContext(SelectionContext);
  if (context === undefined) {
    throw new Error('useSelectedTodo must be used within a SelectionProvider');
  }
  return context;
}