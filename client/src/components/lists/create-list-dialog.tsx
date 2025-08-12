import React, { useState } from 'react';
import { X } from 'lucide-react';
import { EmojiPicker } from './emoji-picker';
import { validateCreateListRequest } from '../../lib/list-validation';

interface CreateListDialogProps {
  onCreateList: (list: { name: string; emoji: string; color?: string }) => void;
  onClose: () => void;
}

export function CreateListDialog({ onCreateList, onClose }: CreateListDialogProps) {
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('📋');
  const [color, setColor] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors([]);
    setIsSubmitting(true);

    const validation = validateCreateListRequest({
      name: name.trim(),
      emoji,
      color: color || undefined,
    });

    if (!validation.success) {
      setErrors(validation.errors || []);
      setIsSubmitting(false);
      return;
    }

    try {
      await onCreateList(validation.data!);
    } catch (error) {
      setErrors(['Failed to create list. Please try again.']);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEmojiSelect = (selectedEmoji: string) => {
    setEmoji(selectedEmoji);
    setShowEmojiPicker(false);
  };

  const predefinedColors = [
    '#f97316', // orange
    '#ef4444', // red
    '#10b981', // green
    '#3b82f6', // blue
    '#8b5cf6', // purple
    '#f59e0b', // yellow
    '#ec4899', // pink
    '#06b6d4', // cyan
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Create New List</h2>
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

          {/* Emoji Selection */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Icon
            </label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                className="flex items-center justify-center w-12 h-12 text-2xl bg-gray-50 border border-gray-300 rounded-md hover:bg-gray-100 transition-colors"
              >
                {emoji}
              </button>
              
              {showEmojiPicker && (
                <div className="absolute top-full left-0 z-10 mt-1">
                  <EmojiPicker
                    selectedEmoji={emoji}
                    onEmojiSelect={handleEmojiSelect}
                    onClose={() => setShowEmojiPicker(false)}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Name Input */}
          <div className="mb-4">
            <label htmlFor="list-name" className="block text-sm font-medium text-gray-700 mb-2">
              Name
            </label>
            <input
              id="list-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              placeholder="Enter list name"
              maxLength={50}
              required
            />
            <div className="text-xs text-gray-500 mt-1">
              {name.length}/50 characters
            </div>
          </div>

          {/* Color Selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Color (optional)
            </label>
            <div className="flex items-center gap-2 flex-wrap">
              {predefinedColors.map((predefinedColor) => (
                <button
                  key={predefinedColor}
                  type="button"
                  onClick={() => setColor(predefinedColor)}
                  className={`w-8 h-8 rounded-full border-2 transition-all ${
                    color === predefinedColor
                      ? 'border-gray-400 scale-110'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  style={{ backgroundColor: predefinedColor }}
                  title={predefinedColor}
                />
              ))}
              
              {/* Custom Color Input */}
              <div className="relative">
                <input
                  type="color"
                  value={color || '#f97316'}
                  onChange={(e) => setColor(e.target.value)}
                  className="w-8 h-8 rounded-full border-2 border-gray-200 cursor-pointer"
                  title="Custom color"
                />
              </div>
            </div>
            
            {color && (
              <button
                type="button"
                onClick={() => setColor('')}
                className="text-xs text-gray-500 hover:text-gray-700 mt-2"
              >
                Clear color
              </button>
            )}
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
              disabled={isSubmitting || !name.trim()}
              className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSubmitting ? 'Creating...' : 'Create List'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}