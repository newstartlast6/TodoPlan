import React from 'react';
import { Plus, Calendar, CheckSquare, Clock } from 'lucide-react';

interface EmptyListStateProps {
  listName: string;
  onAddTask: () => void;
}

export function EmptyListState({ listName, onAddTask }: EmptyListStateProps) {
  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="text-center max-w-sm">
        {/* Icon */}
        <div className="mb-6">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckSquare className="w-8 h-8 text-gray-400" />
          </div>
        </div>

        {/* Title */}
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          No tasks in "{listName}"
        </h3>

        {/* Description */}
        <p className="text-sm text-gray-500 mb-6">
          Get started by adding your first task to this list. You can organize your work, 
          set priorities, and track your progress.
        </p>

        {/* Add Task Button */}
        <button
          onClick={onAddTask}
          className="inline-flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add First Task
        </button>

        {/* Tips */}
        <div className="mt-8 text-left">
          <h4 className="text-sm font-medium text-gray-700 mb-3">Tips for organizing tasks:</h4>
          <div className="space-y-2 text-xs text-gray-500">
            <div className="flex items-start gap-2">
              <Calendar className="w-3 h-3 mt-0.5 flex-shrink-0" />
              <span>Set specific start and end times for better planning</span>
            </div>
            <div className="flex items-start gap-2">
              <Clock className="w-3 h-3 mt-0.5 flex-shrink-0" />
              <span>Use the timer to track time spent on tasks</span>
            </div>
            <div className="flex items-start gap-2">
              <CheckSquare className="w-3 h-3 mt-0.5 flex-shrink-0" />
              <span>Mark tasks as complete to track your progress</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}