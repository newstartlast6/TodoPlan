import { useEffect, useRef, useState } from "react";
import { useNotesAutoSave } from "@/hooks/use-notes-auto-save";
import { AlertCircle, CheckCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface NotesEditorProps {
  taskId: string;
  initialNotes: string;
  placeholder?: string;
  className?: string;
  onSaveSuccess?: () => void;
  onSaveError?: (error: string) => void;
}

export function NotesEditor({
  taskId,
  initialNotes,
  placeholder = "Add notes...",
  className,
  onSaveSuccess,
  onSaveError,
}: NotesEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isFocused, setIsFocused] = useState(false);

  const {
    notes,
    isDirty,
    isSaving,
    lastSaved,
    error,
    updateNotes,
    forceSave,
    retrySave,
  } = useNotesAutoSave({
    taskId,
    initialNotes,
    debounceMs: 1000,
    onSaveSuccess,
    onSaveError,
  });

  // Auto-resize textarea
  const adjustTextareaHeight = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  };

  useEffect(() => {
    adjustTextareaHeight();
  }, [notes]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    updateNotes(e.target.value);
    adjustTextareaHeight();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Allow Ctrl+S to force save
    if (e.ctrlKey && e.key === 's') {
      e.preventDefault();
      forceSave();
    }
  };

  const getSaveStatusIcon = () => {
    if (isSaving) {
      return <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />;
    }
    if (error) {
      return <AlertCircle className="w-3 h-3 text-destructive" />;
    }
    if (lastSaved && !isDirty) {
      return <CheckCircle className="w-3 h-3 text-green-600" />;
    }
    return null;
  };

  const getSaveStatusText = () => {
    if (isSaving) {
      return "Saving...";
    }
    if (error) {
      return "Failed to save";
    }
    if (lastSaved && !isDirty) {
      return "Saved";
    }
    if (isDirty) {
      return "Unsaved changes";
    }
    return "";
  };

  return (
    <div className={cn("flex flex-col space-y-2", className)} data-testid="notes-editor">
      {/* Notes textarea */}
      <div className={cn(
        "relative border-0 rounded-md transition-all",
        isFocused && "ring-1 ring-primary/20"
      )}>
        <textarea
          ref={textareaRef}
          value={notes}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder}
          className={cn(
            "w-full p-3 text-sm resize-none border-0 bg-transparent",
            "placeholder:text-muted-foreground focus:outline-none",
            "leading-relaxed overflow-hidden"
          )}
          style={{ height: 'auto', minHeight: '300px' }}
          data-testid="notes-textarea"
          aria-label="Task notes"
        />

        {/* Subtle border effect */}
        <div className={cn(
          "absolute inset-0 rounded-md border border-border pointer-events-none transition-all",
          isFocused && "border-primary/30"
        )} />
      </div>

      {/* Save status */}
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center space-x-2">
          {getSaveStatusIcon()}
          <span className={cn(
            "text-muted-foreground",
            error && "text-destructive",
            lastSaved && !isDirty && "text-green-600"
          )}>
            {getSaveStatusText()}
          </span>
        </div>

        {/* Error retry button */}
        {error && (
          <button
            onClick={retrySave}
            className="text-xs text-primary hover:text-primary/80 underline"
            data-testid="notes-retry-button"
          >
            Retry
          </button>
        )}

        {/* Last saved time */}
        {lastSaved && !isDirty && (
          <span className="text-muted-foreground">
            {new Date(lastSaved).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit'
            })}
          </span>
        )}
      </div>

      {/* Keyboard shortcut hint */}
      {isFocused && (
        <div className="text-xs text-muted-foreground">
          Press Ctrl+S to save immediately
        </div>
      )}
    </div>
  );
}