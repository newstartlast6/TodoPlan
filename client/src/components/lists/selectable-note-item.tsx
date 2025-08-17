import React, { useState, useEffect } from 'react';
import { StickyNote, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { EditableText } from '@/components/ui/editable-text';
import { Button } from '@/components/ui/button';
import type { ListNote } from '@shared/schema';

interface SelectableNoteItemProps {
  note: ListNote;
  isSelected: boolean;
  onSelect: (noteId: string) => void;
  onUpdate: (noteId: string, updates: { title?: string; content?: string }) => void;
  onDelete: (noteId: string) => void;
  className?: string;
  startEditing?: boolean;
  disableTitleEditing?: boolean;
}

export function SelectableNoteItem({
  note,
  isSelected,
  onSelect,
  onUpdate,
  onDelete,
  className,
  startEditing = false,
  disableTitleEditing = false,
}: SelectableNoteItemProps) {
  const [titleEditTrigger, setTitleEditTrigger] = useState(0);

  // If parent asks to start editing, bump the trigger
  useEffect(() => {
    if (startEditing) {
      setTitleEditTrigger((n) => n + 1);
    }
  }, [startEditing]);

  const handleClick = (e: React.MouseEvent) => {
    // Don't trigger selection when clicking delete button
    if ((e.target as HTMLElement).closest('[data-delete-button]')) {
      return;
    }
    onSelect(note.id);
    // Start inline editing of title on item click (unless disabled)
    if (!disableTitleEditing) {
      setTitleEditTrigger((n) => n + 1);
    }
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('Delete this note?')) {
      onDelete(note.id);
    }
  };

  const handleTitleUpdate = (newTitle: string) => {
    if (newTitle.trim() && newTitle !== note.title) {
      onUpdate(note.id, { title: newTitle.trim() });
    }
  };

  // Get preview text from content (first few lines, stripped of HTML)
  const contentPreview = note.content 
    ? (() => {
        const tmp = document.createElement('div');
        tmp.innerHTML = note.content;
        const text = tmp.textContent || tmp.innerText || '';
        return text.length > 100 ? text.slice(0, 100) + '...' : text;
      })()
    : '';

  const containerClasses = cn(
    "group relative flex items-start space-x-3 p-4 rounded-lg border-2 transition-all duration-200 cursor-pointer",
    "hover:shadow-sm",
    isSelected ? "bg-blue-50/60 shadow-sm border-blue-200" : "bg-white border-gray-100 hover:border-gray-200",
    className
  );

  return (
    <div
      className={containerClasses}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(note.id);
        }
      }}
      aria-label={`Select note: ${note.title}`}
      aria-selected={isSelected}
      data-testid={`selectable-note-${note.id}`}
    >
      {/* Selection indicator */}
      <div
        className={cn(
          "w-1 h-6 rounded-full shrink-0",
          isSelected ? "bg-blue-400" : "invisible bg-blue-400"
        )}
        data-testid={`selection-indicator-${note.id}`}
      />
      
      {/* Note icon */}
      <div className="shrink-0 mt-1">
        <StickyNote className="w-4 h-4 text-orange-500" />
      </div>

      {/* Note Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center space-x-2">
          <div onClick={(e) => e.stopPropagation()} className="min-w-0" data-testid={`note-title-${note.id}`}>
            {disableTitleEditing ? (
              <span className={cn(
                "text-sm font-medium text-gray-900",
                "block truncate"
              )}>
                {note.title}
              </span>
            ) : (
              <EditableText
                value={note.title}
                onChange={handleTitleUpdate}
                editTrigger={titleEditTrigger}
                className={cn(
                  "text-sm font-medium text-gray-900",
                  "block truncate"
                )}
                placeholder="Note title"
              />
            )}
          </div>
        </div>

        {/* Content preview */}
        {contentPreview && (
          <p className="text-sm text-gray-500 mt-1 line-clamp-2">
            {contentPreview}
          </p>
        )}

        {/* Metadata */}
        <div className="flex items-center justify-between mt-2">
          <div className="text-xs text-gray-400">
            {note.updatedAt ? new Date(note.updatedAt).toLocaleDateString() : ''}
          </div>
          
          {/* Actions */}
          <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDelete}
              className="h-6 w-6 p-0 text-gray-400 hover:text-red-500"
              data-delete-button
              data-testid={`note-delete-${note.id}`}
              aria-label="Delete note"
            >
              <Trash2 className="w-3 h-3" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}