import React, { useState, useMemo } from 'react';
import { Search, X } from 'lucide-react';
import { EMOJI_CATEGORIES, type EmojiCategory } from '@shared/list-types';

interface EmojiPickerProps {
  onEmojiSelect: (emoji: string) => void;
  selectedEmoji?: string;
  onClose?: () => void;
}

export function EmojiPicker({ onEmojiSelect, selectedEmoji, onClose }: EmojiPickerProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('work');

  // Filter emojis based on search term
  const filteredCategories = useMemo(() => {
    if (!searchTerm.trim()) {
      return EMOJI_CATEGORIES;
    }

    const filtered: Record<string, EmojiCategory> = {};
    Object.entries(EMOJI_CATEGORIES).forEach(([key, category]) => {
      const matchingEmojis = category.emojis.filter(emoji => 
        // Simple search - could be enhanced with emoji names/descriptions
        category.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
      
      if (matchingEmojis.length > 0) {
        filtered[key] = {
          ...category,
          emojis: matchingEmojis,
        };
      }
    });

    return filtered;
  }, [searchTerm]);

  const handleEmojiClick = (emoji: string) => {
    onEmojiSelect(emoji);
  };

  const categoryKeys = Object.keys(filteredCategories);
  const currentCategory = filteredCategories[activeCategory] || filteredCategories[categoryKeys[0]];

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-4 w-80">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Choose an emoji</h3>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-md transition-colors"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        )}
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search emojis..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
        />
      </div>

      {/* Category Tabs */}
      {!searchTerm && (
        <div className="flex flex-wrap gap-1 mb-4">
          {categoryKeys.map((categoryKey) => {
            const category = filteredCategories[categoryKey];
            return (
              <button
                key={categoryKey}
                onClick={() => setActiveCategory(categoryKey)}
                className={`px-3 py-1 text-sm rounded-md transition-colors ${
                  activeCategory === categoryKey
                    ? 'bg-orange-100 text-orange-700 border border-orange-200'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {category.name}
              </button>
            );
          })}
        </div>
      )}

      {/* Emoji Grid */}
      <div className="max-h-64 overflow-y-auto">
        {searchTerm ? (
          // Show all matching emojis when searching
          <div className="grid grid-cols-8 gap-2">
            {Object.values(filteredCategories).flatMap(category => 
              category.emojis.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => handleEmojiClick(emoji)}
                  className={`w-8 h-8 flex items-center justify-center text-xl hover:bg-gray-100 rounded-md transition-colors ${
                    selectedEmoji === emoji ? 'bg-orange-100 ring-2 ring-orange-500' : ''
                  }`}
                  title={emoji}
                >
                  {emoji}
                </button>
              ))
            )}
          </div>
        ) : (
          // Show current category emojis
          currentCategory && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">
                {currentCategory.name}
              </h4>
              <div className="grid grid-cols-8 gap-2">
                {currentCategory.emojis.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => handleEmojiClick(emoji)}
                    className={`w-8 h-8 flex items-center justify-center text-xl hover:bg-gray-100 rounded-md transition-colors ${
                      selectedEmoji === emoji ? 'bg-orange-100 ring-2 ring-orange-500' : ''
                    }`}
                    title={emoji}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          )
        )}
      </div>

      {/* No results message */}
      {searchTerm && Object.keys(filteredCategories).length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <p>No emojis found for "{searchTerm}"</p>
          <p className="text-sm mt-1">Try a different search term</p>
        </div>
      )}

      {/* Selected emoji display */}
      {selectedEmoji && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Selected:</span>
            <div className="flex items-center gap-2">
              <span className="text-2xl">{selectedEmoji}</span>
              <button
                onClick={() => onEmojiSelect('')}
                className="text-xs text-gray-400 hover:text-gray-600"
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}