import React, { useState } from 'react';
import { X, Calendar, Clock } from 'lucide-react';
import { format, addHours, startOfHour } from 'date-fns';
import { validateCreateTaskInListRequest } from '../../lib/list-validation';

interface AddTaskDialogProps {
  listId: string;
  onAddTask: (task: {
    title: string;
    description?: string;
    notes?: string;
    startTime: Date;
    endTime: Date;
    priority?: 'low' | 'medium' | 'high';
  }) => void;
  onClose: () => void;
}

export function AddTaskDialog({ listId, onAddTask, onClose }: AddTaskDialogProps) {
  const now = new Date();
  const defaultStartTime = startOfHour(addHours(now, 1)); // Next hour
  const defaultEndTime = addHours(defaultStartTime, 1); // One hour duration

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [startTime, setStartTime] = useState(defaultStartTime);
  const [endTime, setEndTime] = useState(defaultEndTime);
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [errors, setErrors] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors([]);
    setIsSubmitting(true);

    // Validate end time is after start time
    if (endTime <= startTime) {
      setErrors(['End time must be after start time']);
      setIsSubmitting(false);
      return;
    }

    const validation = validateCreateTaskInListRequest({
      title: title.trim(),
      description: description.trim() || undefined,
      notes: notes.trim() || undefined,
      startTime,
      endTime,
      priority,
      listId,
    });

    if (!validation.success) {
      setErrors(validation.errors || []);
      setIsSubmitting(false);
      return;
    }

    try {
      await onAddTask({
        title: title.trim(),
        description: description.trim() || undefined,
        notes: notes.trim() || undefined,
        startTime,
        endTime,
        priority,
      });
    } catch (error) {
      setErrors(['Failed to create task. Please try again.']);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStartTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newStartTime = new Date(e.target.value);
    setStartTime(newStartTime);
    
    // Auto-adjust end time to maintain duration if end time is before new start time
    if (endTime <= newStartTime) {
      setEndTime(addHours(newStartTime, 1));
    }
  };

  const handleEndTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newEndTime = new Date(e.target.value);
    setEndTime(newEndTime);
  };

  const formatDateTimeLocal = (date: Date) => {
    return format(date, "yyyy-MM-dd'T'HH:mm");
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Add New Task</h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6">
          {/* Error Messages */}
          {errors.length > 0 && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
              <ul className="text-sm text-red-600 space-y-1">
                {errors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Title */}
          <div className="mb-4">
            <label htmlFor="task-title" className="block text-sm font-medium text-gray-700 mb-2">
              Title *
            </label>
            <input
              id="task-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              placeholder="Enter task title"
              required
            />
          </div>

          {/* Description */}
          <div className="mb-4">
            <label htmlFor="task-description" className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <input
              id="task-description"
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              placeholder="Brief description (optional)"
            />
          </div>

          {/* Time Selection */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Clock className="w-4 h-4 inline mr-1" />
              Time
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="start-time" className="block text-xs text-gray-500 mb-1">
                  Start Time
                </label>
                <input
                  id="start-time"
                  type="datetime-local"
                  value={formatDateTimeLocal(startTime)}
                  onChange={handleStartTimeChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm"
                  required
                />
              </div>
              <div>
                <label htmlFor="end-time" className="block text-xs text-gray-500 mb-1">
                  End Time
                </label>
                <input
                  id="end-time"
                  type="datetime-local"
                  value={formatDateTimeLocal(endTime)}
                  onChange={handleEndTimeChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm"
                  required
                />
              </div>
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Duration: {Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60))} minutes
            </div>
          </div>

          {/* Priority */}
          <div className="mb-4">
            <label htmlFor="task-priority" className="block text-sm font-medium text-gray-700 mb-2">
              Priority
            </label>
            <select
              id="task-priority"
              value={priority}
              onChange={(e) => setPriority(e.target.value as 'low' | 'medium' | 'high')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>

          {/* Notes */}
          <div className="mb-6">
            <label htmlFor="task-notes" className="block text-sm font-medium text-gray-700 mb-2">
              Notes
            </label>
            <textarea
              id="task-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none"
              placeholder="Additional notes (optional)"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !title.trim()}
              className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSubmitting ? 'Adding...' : 'Add Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}