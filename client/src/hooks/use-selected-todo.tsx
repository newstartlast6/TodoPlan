import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';

interface SelectionState {
  selectedTodoId: string | null;
  // Review selection (mutually exclusive with selectedTodoId)
  selectedReviewType: 'daily' | 'weekly' | null;
  selectedReviewAnchorDate: string | null; // ISO date string (yyyy-mm-dd)
  // Notes selection (mutually exclusive with above)
  selectedNotesType: 'daily' | 'weekly' | 'monthly' | 'yearly' | null;
  selectedNotesAnchorDate: string | null; // ISO date string
  isDetailPaneOpen: boolean;
}

interface SelectionContextType {
  selectedTodoId: string | null;
  selectedReviewType: 'daily' | 'weekly' | null;
  selectedReviewAnchorDate: string | null;
  selectedNotesType: 'daily' | 'weekly' | 'monthly' | 'yearly' | null;
  selectedNotesAnchorDate: string | null;
  isDetailPaneOpen: boolean;
  selectTodo: (todoId: string | null) => void;
  selectReview: (type: 'daily' | 'weekly', anchorDate: Date) => void;
  selectNotes: (type: 'daily' | 'weekly' | 'monthly' | 'yearly', anchorDate: Date) => void;
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
        selectedReviewType: parsed.selectedReviewType || null,
        selectedReviewAnchorDate: parsed.selectedReviewAnchorDate || null,
        selectedNotesType: parsed.selectedNotesType || null,
        selectedNotesAnchorDate: parsed.selectedNotesAnchorDate || null,
        isDetailPaneOpen: parsed.isDetailPaneOpen || false,
      };
    }
  } catch (error) {
    console.warn('Failed to load selection state from localStorage:', error);
  }
  return {
    selectedTodoId: null,
    selectedReviewType: null,
    selectedReviewAnchorDate: null,
    selectedNotesType: null,
    selectedNotesAnchorDate: null,
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

  // Allow external code to request selecting a task (e.g., right after create)
  useEffect(() => {
    const handler = (e: Event) => {
      const custom = e as CustomEvent<string>;
      const id = custom.detail;
      if (id) {
        setState(prev => ({ ...prev, selectedTodoId: id, isDetailPaneOpen: true }));
      }
    };
    window.addEventListener('tasks:select', handler as EventListener);
    return () => window.removeEventListener('tasks:select', handler as EventListener);
  }, []);

  const selectTodo = useCallback((todoId: string | null) => {
    setState(prev => ({
      ...prev,
      selectedTodoId: todoId,
      selectedReviewType: null,
      selectedReviewAnchorDate: null,
      selectedNotesType: null,
      selectedNotesAnchorDate: null,
      isDetailPaneOpen: todoId !== null, // Auto-open detail pane when selecting a todo
    }));
  }, []);

  const selectReview = useCallback((type: 'daily' | 'weekly', anchorDate: Date) => {
    const d = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), anchorDate.getDate());
    const iso = d.toISOString();
    setState(prev => ({
      ...prev,
      selectedTodoId: null,
      selectedReviewType: type,
      selectedReviewAnchorDate: iso,
      selectedNotesType: null,
      selectedNotesAnchorDate: null,
      isDetailPaneOpen: true,
    }));
  }, []);

  const selectNotes = useCallback((type: 'daily' | 'weekly' | 'monthly' | 'yearly', anchorDate: Date) => {
    const d = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), anchorDate.getDate());
    const iso = d.toISOString();
    setState(prev => ({
      ...prev,
      selectedTodoId: null,
      selectedReviewType: null,
      selectedReviewAnchorDate: null,
      selectedNotesType: type,
      selectedNotesAnchorDate: iso,
      isDetailPaneOpen: true,
    }));
  }, []);

  const openDetailPane = useCallback(() => {
    setState(prev => ({ ...prev, isDetailPaneOpen: true }));
  }, []);

  const closeDetailPane = useCallback(() => {
    setState(prev => ({ 
      ...prev, 
      isDetailPaneOpen: false,
      selectedTodoId: null,
      selectedReviewType: null,
      selectedReviewAnchorDate: null,
      selectedNotesType: null,
      selectedNotesAnchorDate: null,
    }));
  }, []);

  const toggleDetailPane = useCallback(() => {
    setState(prev => ({ ...prev, isDetailPaneOpen: !prev.isDetailPaneOpen }));
  }, []);

  const value: SelectionContextType = {
    selectedTodoId: state.selectedTodoId,
    selectedReviewType: state.selectedReviewType,
    selectedReviewAnchorDate: state.selectedReviewAnchorDate,
    selectedNotesType: state.selectedNotesType,
    selectedNotesAnchorDate: state.selectedNotesAnchorDate,
    isDetailPaneOpen: state.isDetailPaneOpen,
    selectTodo,
    selectReview,
    selectNotes,
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