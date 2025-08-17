import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface EditableTextProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  autoFocusOnEmpty?: boolean;
  editTrigger?: number; // increment to programmatically start editing
  autoSaveOnIdle?: boolean; // emit onChange after user stops typing
  idleMs?: number; // debounce duration for idle save
  onStartEditing?: () => void; // callback when entering edit mode
}

export function EditableText({
  value,
  onChange,
  placeholder = "Add goal...",
  className,
  autoFocusOnEmpty = false,
  editTrigger,
  autoSaveOnIdle = true,
  idleMs = 800,
  onStartEditing,
}: EditableTextProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const editableRef = useRef<HTMLDivElement | null>(null);
  const lastTriggerRef = useRef<number | undefined>(editTrigger);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isComposingRef = useRef(false);
  const lastEmittedRef = useRef<string>(value);
  const pendingEnterCommitRef = useRef(false);
  const suppressNextBlurCommitRef = useRef(false);
  const hasCommittedRef = useRef(false);
  const pendingCaretPointRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    // Avoid resetting caret position while actively editing
    if (!isEditing) {
      setDraft(value);
    }
  }, [value, isEditing]);

  useEffect(() => {
    if (isEditing) {
      // Reset per-edit flags when entering edit mode
      hasCommittedRef.current = false;
      suppressNextBlurCommitRef.current = false;
      onStartEditing?.();
      const el = editableRef.current;
      if (!el) return;
      // Initialize content from current draft once when entering edit mode
      try {
        el.textContent = draft ?? "";
      } catch {}
      el.focus();

      const placeCaretAtPointIfNeeded = () => {
        const point = pendingCaretPointRef.current;
        if (!point) return false;
        pendingCaretPointRef.current = null;
        try {
          // Try modern API first
          // @ts-ignore - not in TS lib yet for all targets
          if (document.caretPositionFromPoint) {
            // @ts-ignore
            const pos = document.caretPositionFromPoint(point.x, point.y);
            if (pos && pos.offsetNode) {
              const range = document.createRange();
              range.setStart(pos.offsetNode, pos.offset);
              range.collapse(true);
              const sel = window.getSelection();
              sel?.removeAllRanges();
              sel?.addRange(range);
              return true;
            }
          }
          // Fallback for WebKit
          // @ts-ignore
          if (document.caretRangeFromPoint) {
            // @ts-ignore
            const range = document.caretRangeFromPoint(point.x, point.y);
            if (range) {
              const sel = window.getSelection();
              sel?.removeAllRanges();
              sel?.addRange(range);
              return true;
            }
          }
        } catch {}
        return false;
      };

      const placeCaretAtEnd = () => {
        try {
          const range = document.createRange();
          range.selectNodeContents(el);
          range.collapse(false);
          const sel = window.getSelection();
          sel?.removeAllRanges();
          sel?.addRange(range);
        } catch {}
      };

      // Attempt to place caret where user clicked; if not available, leave default
      const placeCaret = () => {
        const placed = placeCaretAtPointIfNeeded();
        if (!placed) placeCaretAtEnd();
      };
      // Run after layout is stable to compute caret position
      requestAnimationFrame(placeCaret);
      setTimeout(placeCaret, 0);
    }
  }, [isEditing]);

  useEffect(() => {
    if (autoFocusOnEmpty && !value) {
      setIsEditing(true);
    }
  }, [autoFocusOnEmpty, value]);

  // Programmatically start editing when trigger changes
  useEffect(() => {
    if (typeof editTrigger === 'number' && editTrigger !== lastTriggerRef.current) {
      lastTriggerRef.current = editTrigger;
      setIsEditing(true);
    }
  }, [editTrigger]);

  const commit = () => {
    if (hasCommittedRef.current) return;
    // Clear any pending idle save to avoid duplicate emits
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
    // Read from DOM to ensure latest character is included
    const el = editableRef.current;
    const currentText = el ? (el.textContent ?? el.innerText ?? draft) : draft;
    const trimmed = (currentText ?? "").trim();
    if (trimmed !== lastEmittedRef.current) {
      onChange(trimmed);
      lastEmittedRef.current = trimmed;
    }
    setDraft(trimmed);
    setIsEditing(false);
    hasCommittedRef.current = true;
  };

  const cancel = () => {
    setDraft(value);
    setIsEditing(false);
  };

  const scheduleIdleSave = () => {
    if (!autoSaveOnIdle) return;
    if (isComposingRef.current) return;
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(() => {
      const el = editableRef.current;
      const current = el ? el.innerText : draft;
      const trimmed = current.trim();
      if (trimmed !== lastEmittedRef.current) {
        onChange(trimmed);
        lastEmittedRef.current = trimmed;
      }
    }, idleMs);
  };

  useEffect(() => {
    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, []);

  if (isEditing) {
    return (
      <div
        ref={editableRef}
        contentEditable
        suppressContentEditableWarning
        onBeforeInput={(e) => {
          // Let the browser apply the input and keep DOM in control while editing
          // Only schedule idle save; avoid setState to preserve caret position
          requestAnimationFrame(() => {
            scheduleIdleSave();
          });
        }}
        onCompositionStart={() => { isComposingRef.current = true; }}
        onCompositionEnd={(e) => {
          isComposingRef.current = false;
          // Sync draft from DOM after composition applies
          requestAnimationFrame(() => {
            const el = editableRef.current;
            if (!el) return;
            scheduleIdleSave();
            if (pendingEnterCommitRef.current) {
              pendingEnterCommitRef.current = false;
              setTimeout(commit, 0);
            }
          });
        }}
        onBlur={() => {
          if (suppressNextBlurCommitRef.current) {
            suppressNextBlurCommitRef.current = false;
            return;
          }
          commit();
        }}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === 'Enter') {
            e.preventDefault();
            // Prevent immediate blur from causing a second commit
            suppressNextBlurCommitRef.current = true;
            if (isComposingRef.current) {
              // Defer commit until composition ends to avoid losing last character
              pendingEnterCommitRef.current = true;
            } else {
              // Defer to next frame to ensure state has applied
              requestAnimationFrame(() => setTimeout(commit, 0));
            }
            return;
          }
          else if (e.key === 'Escape') { e.preventDefault(); cancel(); }
        }}
        onKeyUp={(e) => {
          if (e.key === 'Enter' && pendingEnterCommitRef.current && !isComposingRef.current) {
            pendingEnterCommitRef.current = false;
            requestAnimationFrame(() => setTimeout(commit, 0));
          }
        }}
        role="textbox"
        aria-label={placeholder}
        className={cn(
          "bg-transparent text-foreground outline-none border-0 inline-block max-w-full whitespace-nowrap overflow-hidden text-ellipsis placeholder:text-muted-foreground/60 min-w-[1ch] px-0.5",
          className
        )}
        data-editable="true"
      />
    );
  }

  return (
    <span
      onMouseDown={(e) => {
        // Record the click point so we can restore caret at that location after entering edit mode
        pendingCaretPointRef.current = { x: e.clientX, y: e.clientY };
      }}
      onClick={() => setIsEditing(true)}
      className={cn(
        "inline-block max-w-full whitespace-nowrap overflow-hidden text-ellipsis",
        value ? "text-foreground" : "text-muted-foreground/70",
        className
      )}
    >
      {value || placeholder}
    </span>
  );
}


