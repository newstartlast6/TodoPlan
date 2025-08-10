import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface EditableTextProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  autoFocusOnEmpty?: boolean;
}

export function EditableText({
  value,
  onChange,
  placeholder = "Add goal...",
  className,
  autoFocusOnEmpty = false,
}: EditableTextProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing]);

  useEffect(() => {
    if (autoFocusOnEmpty && !value) {
      setIsEditing(true);
    }
  }, [autoFocusOnEmpty, value]);

  const commit = () => {
    const trimmed = draft.trim();
    onChange(trimmed);
    setIsEditing(false);
  };

  const cancel = () => {
    setDraft(value);
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") cancel();
        }}
        placeholder={placeholder}
        className={cn(
          "bg-transparent border-0 outline-none text-foreground placeholder:text-muted-foreground/60",
          "text-base whitespace-nowrap truncate",
          className
        )}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setIsEditing(true)}
      className={cn(
        "group inline-flex items-center gap-2 text-left",
        className
      )}
    >
      <span
        className={cn(
          "font-semibold tracking-tight",
          value ? "text-foreground" : "text-muted-foreground/70"
        )}
      >
        {value || placeholder}
      </span>
      <span className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground/50 text-xs">
        edit
      </span>
    </button>
  );
}


