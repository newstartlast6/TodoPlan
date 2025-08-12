import React, { useState, useEffect } from 'react';
import { ArrowLeft, Menu, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ResponsiveListsLayoutProps {
  listsPanel: React.ReactNode;
  listDetailPanel: React.ReactNode;
  todoDetailPanel: React.ReactNode;
  selectedListId: string | null;
  selectedTaskId: string | null;
  onBackToLists?: () => void;
  onBackToTasks?: () => void;
}

type ViewMode = 'lists' | 'tasks' | 'detail';

export function ResponsiveListsLayout({
  listsPanel,
  listDetailPanel,
  todoDetailPanel,
  selectedListId,
  selectedTaskId,
  onBackToLists,
  onBackToTasks,
}: ResponsiveListsLayoutProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('lists');
  const [isMobile, setIsMobile] = useState(false);
  const [isTablet, setIsTablet] = useState(false);

  // Detect screen size
  useEffect(() => {
    const checkScreenSize = () => {
      const width = window.innerWidth;
      setIsMobile(width < 768);
      setIsTablet(width >= 768 && width < 1024);
    };

    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  // Auto-navigate based on selections
  useEffect(() => {
    if (isMobile) {
      if (selectedTaskId) {
        setViewMode('detail');
      } else if (selectedListId) {
        setViewMode('tasks');
      } else {
        setViewMode('lists');
      }
    }
  }, [selectedListId, selectedTaskId, isMobile]);

  const handleBackToLists = () => {
    setViewMode('lists');
    onBackToLists?.();
  };

  const handleBackToTasks = () => {
    setViewMode('tasks');
    onBackToTasks?.();
  };

  // Desktop layout (3 panels side by side)
  if (!isMobile && !isTablet) {
    return (
      <div className="h-screen bg-gray-50 flex">
        <div className="w-80 flex-shrink-0">{listsPanel}</div>
        <div className="flex-1 min-w-0">{listDetailPanel}</div>
        <div className="w-96 flex-shrink-0">{todoDetailPanel}</div>
      </div>
    );
  }

  // Tablet layout (2 panels with collapsible detail)
  if (isTablet) {
    return (
      <div className="h-screen bg-gray-50 flex">
        <div className="w-80 flex-shrink-0">{listsPanel}</div>
        <div className="flex-1 min-w-0">{listDetailPanel}</div>
        
        {/* Overlay detail panel for tablet */}
        {selectedTaskId && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-end">
            <div className="w-96 h-full bg-white shadow-xl">
              <div className="flex items-center justify-between p-4 border-b border-gray-200">
                <h3 className="font-semibold">Task Details</h3>
                <button
                  onClick={handleBackToTasks}
                  className="p-1 hover:bg-gray-100 rounded-md transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="h-full overflow-hidden">
                {todoDetailPanel}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Mobile layout (single panel navigation)
  return (
    <div className="h-screen bg-gray-50 flex flex-col">
      {/* Mobile Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {viewMode === 'tasks' && (
            <button
              onClick={handleBackToLists}
              className="p-1 hover:bg-gray-100 rounded-md transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          {viewMode === 'detail' && (
            <button
              onClick={handleBackToTasks}
              className="p-1 hover:bg-gray-100 rounded-md transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          
          <h1 className="text-lg font-semibold">
            {viewMode === 'lists' && 'Lists'}
            {viewMode === 'tasks' && 'Tasks'}
            {viewMode === 'detail' && 'Task Details'}
          </h1>
        </div>
      </div>

      {/* Mobile Content */}
      <div className="flex-1 overflow-hidden">
        <div
          className={cn(
            "flex h-full transition-transform duration-300 ease-in-out",
            viewMode === 'lists' && "translate-x-0",
            viewMode === 'tasks' && "-translate-x-full",
            viewMode === 'detail' && "-translate-x-[200%]"
          )}
          style={{ width: '300%' }}
        >
          {/* Lists Panel */}
          <div className="w-1/3 h-full">
            {listsPanel}
          </div>

          {/* Tasks Panel */}
          <div className="w-1/3 h-full">
            {listDetailPanel}
          </div>

          {/* Detail Panel */}
          <div className="w-1/3 h-full">
            {todoDetailPanel}
          </div>
        </div>
      </div>
    </div>
  );
}