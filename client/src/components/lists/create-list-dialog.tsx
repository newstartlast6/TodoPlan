import React, { useState } from 'react';
import { X } from 'lucide-react';
import { validateCreateListRequest } from '../../lib/list-validation';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { EMOJI_CATEGORIES } from '@shared/list-types';

interface CreateListDialogProps {
  onCreateList: (list: { name: string; emoji: string }) => void;
  onClose: () => void;
}

export function CreateListDialog({ onCreateList, onClose }: CreateListDialogProps) {
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('📋');
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

  // Emoji-mart handler removed (we now only show quick picks)

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
            <Popover open={showEmojiPicker} onOpenChange={setShowEmojiPicker}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  className="flex items-center justify-center w-12 h-12 text-2xl bg-gray-50 border border-gray-300 rounded-md hover:bg-gray-100 transition-colors"
                >
                  {emoji}
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" sideOffset={8} className="p-0 border-none shadow-none bg-transparent">
                <div className="bg-white rounded-md border border-gray-200 p-3 w-[340px]">
                  <div className="text-[11px] font-medium text-gray-600 mb-2">Quick picks</div>
                  <div className="grid grid-cols-8 gap-2">
                    {Array.from(new Set(Object.values(EMOJI_CATEGORIES).flatMap(c => c.emojis))).slice(0, 48).map((e) => (
                      <button
                        key={e}
                        onClick={() => handleEmojiSelect(e)}
                        className={`w-8 h-8 flex items-center justify-center text-xl rounded-md transition-colors hover:bg-gray-100 ${emoji === e ? 'bg-orange-100 ring-2 ring-orange-500' : ''}`}
                        title={e}
                        type="button"
                      >
                        {e}
                      </button>
                    ))}
                  </div>
                </div>
              </PopoverContent>
            </Popover>
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

          {/* Color option removed */}

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