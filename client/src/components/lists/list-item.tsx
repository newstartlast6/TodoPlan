import React, { useState, useRef, useEffect } from 'react';
import { MoreVertical, Check, X } from 'lucide-react';
import { type ListWithTaskCount } from '@shared/list-types';
import { EmojiPicker } from './emoji-picker';

interface ListItemProps {
  list: ListWithTaskCount;
  isSelected: boolean;
  isEditing: boolean;
  onClick: () => void;
  onEdit: (updates: { name?: string; emoji?: string }) => void;
  onCancelEdit: () => void;
  onContextMenu: () => void;
}

export function ListItem({
  list,
  isSelected,
  isEditing,
  onClick,
  onEdit,
  onCancelEdit,
  onContextMenu,
}: ListItemProps) {
  const [editName, setEditName] = useState(list.name);
  const [editEmoji, setEditEmoji] = useState(list.emoji);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const itemRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  useEffect(() => {
    if (isEditing) {
      setEditName(list.name);
      setEditEmoji(list.emoji);
    }
  }, [isEditing, list.name, list.emoji]);

  const handleSaveEdit = () => {
    if (editName.trim()) {
      onEdit({
        name: editName.trim(),
        emoji: editEmoji,
      });
    } else {
      onCancelEdit();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveEdit();
    } else if (e.key === 'Escape') {
      onCancelEdit();
    }
  };

  const handleEmojiSelect = (emoji: string) => {
    setEditEmoji(emoji);
    setShowEmojiPicker(false);
  };

  if (isEditing) {
    return (
      <div ref={itemRef} className="relative">
        <div className="flex items-center gap-3 p-3 bg-orange-50 border border-orange-200 rounded-lg mb-1">
          {/* Emoji Button */}
          <button
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className="text-xl hover:bg-orange-100 rounded-md p-1 transition-colors"
            title="Change emoji"
          >
            {editEmoji}
          </button>

          {/* Name Input */}
          <input
            ref={inputRef}
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-white border border-gray-300 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            placeholder="List name"
          />

          {/* Action Buttons */}
          <div className="flex items-center gap-1">
            <button
              onClick={handleSaveEdit}
              className="p-1 text-green-600 hover:bg-green-100 rounded-md transition-colors"
              title="Save"
            >
              <Check className="w-4 h-4" />
            </button>
            <button
              onClick={onCancelEdit}
              className="p-1 text-gray-500 hover:bg-gray-100 rounded-md transition-colors"
              title="Cancel"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Emoji Picker */}
        {showEmojiPicker && (
          <div className="absolute top-full left-0 z-50 mt-1">
            <EmojiPicker
              selectedEmoji={editEmoji}
              onEmojiSelect={handleEmojiSelect}
              onClose={() => setShowEmojiPicker(false)}
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className={`group flex items-center gap-3 p-3 rounded-lg mb-1 cursor-pointer transition-colors ${
        isSelected
          ? 'bg-orange-100 border border-orange-200'
          : 'hover:bg-gray-50'
      }`}
      onClick={onClick}
    >
      {/* Emoji */}
      <span className="text-xl flex-shrink-0">{list.emoji}</span>

      {/* List Info */}
      <div className="flex-1 min-w-0">
        <div className="font-medium text-gray-900 truncate">
          {list.name}
        </div>
      </div>

      {/* Context Menu Button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onContextMenu();
        }}
        className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-all"
        title="More options"
      >
        <MoreVertical className="w-4 h-4" />
      </button>
    </div>
  );
}