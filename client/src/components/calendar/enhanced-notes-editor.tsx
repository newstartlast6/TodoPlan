import { useEffect, useRef, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Placeholder from "@tiptap/extension-placeholder";
import { useNotesAutoSave } from "@/hooks/use-notes-auto-save";
import {
  AlertCircle,
  CheckCircle,
  Loader2,
  Type,
  List,
  CheckSquare,
  Bold,
  Italic,
  Strikethrough,
  Quote,
  Code,
  Undo,
  Redo,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Toggle } from "@/components/ui/toggle";

interface EnhancedNotesEditorProps {
  taskId: string;
  initialNotes: string;
  placeholder?: string;
  className?: string;
  onSaveSuccess?: () => void;
  onSaveError?: (error: string) => void;
}

export function EnhancedNotesEditor({
  taskId,
  initialNotes,
  placeholder = "Start writing your notes...",
  className,
  onSaveSuccess,
  onSaveError,
}: EnhancedNotesEditorProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [slashOpen, setSlashOpen] = useState(false);
  const [slashQuery, setSlashQuery] = useState("");
  const [slashIndex, setSlashIndex] = useState(0);
  const [slashPos, setSlashPos] = useState<{ x: number; y: number } | null>(null);
  const slashFromRef = useRef<number | null>(null);

  const { isDirty, isSaving, lastSaved, error, updateNotes, forceSave, retrySave } =
    useNotesAutoSave({
      taskId,
      initialNotes,
      debounceMs: 1000,
      onSaveSuccess,
      onSaveError,
    });

  const editor = useEditor({
    content: initialNotes || "",
    extensions: [
      StarterKit,
      TaskList.configure({
        HTMLAttributes: { class: "task-list" },
      }),
      TaskItem.configure({
        nested: true,
        HTMLAttributes: { class: "task-item" },
      }),
      Placeholder.configure({ placeholder, showOnlyWhenEditable: true, showOnlyCurrent: false }),
    ],
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      updateNotes(html);

      if (slashOpen && slashFromRef.current != null) {
        const from = slashFromRef.current;
        const to = editor.state.selection.from;
        if (to < from) {
          setSlashOpen(false);
          setSlashQuery("");
          setSlashIndex(0);
          slashFromRef.current = null;
        } else {
          const text = editor.state.doc.textBetween(from, to, " ");
          const q = text.startsWith("/") ? text.slice(1) : text;
          setSlashQuery(q);
        }
      }
    },
    editorProps: {
      attributes: {
        class: "enhanced-notes-editor prose prose-sm max-w-none focus:outline-none min-h-[200px] p-4",
        "aria-label": "Enhanced task notes editor",
        "data-testid": "enhanced-notes-editor",
      },
      handleKeyDown: (view, event) => {
        if (event.key === "/" && !event.ctrlKey && !event.metaKey && !event.altKey) {
          const { from } = view.state.selection;
          const coords = view.coordsAtPos(from);
          setSlashPos({ x: coords.left, y: coords.bottom + 6 });
          setSlashOpen(true);
          setSlashQuery("");
          setSlashIndex(0);
          slashFromRef.current = from;
          return false;
        }

        if (slashOpen) {
          if (event.key === "ArrowDown") {
            setSlashIndex((i) => Math.min(i + 1, getFilteredSlashItems(slashQuery).length - 1));
            event.preventDefault();
            return true;
          }
          if (event.key === "ArrowUp") {
            setSlashIndex((i) => Math.max(i - 1, 0));
            event.preventDefault();
            return true;
          }
          if (event.key === "Escape") {
            setSlashOpen(false);
            setSlashQuery("");
            setSlashIndex(0);
            slashFromRef.current = null;
            return true;
          }
          if (event.key === "Enter") {
            const items = getFilteredSlashItems(slashQuery);
            const item = items[slashIndex] ?? items[0];
            if (item) {
              applySlashItem(item, view.state.selection.from);
              event.preventDefault();
              return true;
            }
          }
          if (event.key === " " || event.key === "Tab") {
            setSlashOpen(false);
            setSlashQuery("");
            setSlashIndex(0);
            slashFromRef.current = null;
          }
        }
        return false;
      },
    },
  });

  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    const next = initialNotes || "";
    if (current !== next) editor.commands.setContent(next);
  }, [initialNotes, editor]);

  useEffect(() => {
    if (!editor) return;
    const onFocus = () => setIsFocused(true);
    const onBlur = () => setIsFocused(false);
    editor.on("focus", onFocus);
    editor.on("blur", onBlur);
    return () => {
      editor.off("focus", onFocus);
      editor.off("blur", onBlur);
    };
  }, [editor]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
      e.preventDefault();
      forceSave();
    }
  };

  const getSaveStatusIcon = () => {
    if (isSaving) return <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />;
    if (error) return <AlertCircle className="w-3 h-3 text-destructive" />;
    if (lastSaved && !isDirty) return <CheckCircle className="w-3 h-3 text-green-600" />;
    return null;
  };

  const getSaveStatusText = () => {
    if (isSaving) return "Saving...";
    if (error) return "Failed to save";
    if (lastSaved && !isDirty) return "Saved";
    if (isDirty) return "Unsaved changes";
    return "";
  };

  const insertTaskList = () => {
    if (!editor) return;
    editor.chain().focus().toggleTaskList().run();
  };

  const SLASH_ITEMS: Array<{
    key: string;
    label: string;
    icon: JSX.Element;
    action: () => void;
  }> = [
    { key: "h1", label: "Heading 1", icon: <Type className="w-4 h-4" />, action: () => editor?.chain().focus().toggleHeading({ level: 1 }).run() },
    { key: "h2", label: "Heading 2", icon: <Type className="w-4 h-4" />, action: () => editor?.chain().focus().toggleHeading({ level: 2 }).run() },
    { key: "h3", label: "Heading 3", icon: <Type className="w-4 h-4" />, action: () => editor?.chain().focus().toggleHeading({ level: 3 }).run() },
    { key: "bulleted", label: "Bulleted List", icon: <List className="w-4 h-4" />, action: () => editor?.chain().focus().toggleBulletList().run() },
    { key: "numbered", label: "Numbered List", icon: <List className="w-4 h-4" />, action: () => editor?.chain().focus().toggleOrderedList().run() },
    { key: "check", label: "Check Item", icon: <CheckSquare className="w-4 h-4" />, action: () => editor?.chain().focus().toggleTaskList().run() },
    { key: "quote", label: "Quote", icon: <Quote className="w-4 h-4" />, action: () => editor?.chain().focus().toggleBlockquote().run() },
    { key: "hr", label: "Horizontal Line", icon: <Separator className="w-3 h-3" />, action: () => editor?.chain().focus().setHorizontalRule().run() },
  ];

  const getFilteredSlashItems = (query: string) => {
    const q = query.trim().toLowerCase();
    if (!q) return SLASH_ITEMS;
    return SLASH_ITEMS.filter((i) => i.label.toLowerCase().includes(q));
  };

  const applySlashItem = (item: { action: () => void }, toPos: number) => {
    if (!editor) return;
    if (slashFromRef.current != null) {
      const from = slashFromRef.current;
      editor.chain().focus().setTextSelection({ from, to: toPos }).deleteSelection().run();
    }
    item.action();
    setSlashOpen(false);
    setSlashQuery("");
    setSlashIndex(0);
    slashFromRef.current = null;
  };

  if (!editor) {
    return (
      <div className={cn("flex items-center justify-center p-8", className)}>
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      <style>{`
        .enhanced-notes-editor p.is-editor-empty:first-child::before { color: #adb5bd; content: attr(data-placeholder); float: left; height: 0; pointer-events: none; }
        .enhanced-notes-editor ul[data-type="taskList"] { list-style: none; padding-left: 0; margin: 0.75rem 0; }
        .enhanced-notes-editor li[data-type="taskItem"] { display: flex; align-items: flex-start; margin: 0.375rem 0; list-style: none; padding-left: 0; }
        .enhanced-notes-editor li[data-type="taskItem"] > label { margin-right: 0.5rem; margin-top: 0.125rem; flex-shrink: 0; display: flex; align-items: center; cursor: pointer; }
        .enhanced-notes-editor li[data-type="taskItem"] > label > input[type="checkbox"] { margin: 0; width: 18px; height: 18px; border-radius: 4px; border: 2px solid #d1d5db; background: white; cursor: pointer; }
        .enhanced-notes-editor li[data-type="taskItem"] > label > input[type="checkbox"]:checked { background: #3b82f6; border-color: #3b82f6; }
        .enhanced-notes-editor li[data-type="taskItem"] > div { flex: 1; line-height: 1.5; }
        .enhanced-notes-editor li[data-type="taskItem"] > div > p { margin: 0; }
        .enhanced-notes-editor li[data-type="taskItem"][data-checked="true"] > div { text-decoration: line-through; opacity: 0.6; }
        .enhanced-notes-editor blockquote { border-left: 4px solid #e5e7eb; padding-left: 1rem; margin: 1rem 0; font-style: italic; color: #6b7280; }
      `}</style>

      <div className={cn("flex flex-col space-y-3", className)} data-testid="enhanced-notes-editor-container">
        <div className="flex items-center gap-1 p-2 border rounded-lg bg-muted/30">
          <div className="flex items-center gap-1">
            <Toggle size="sm" pressed={editor.isActive("bold")} onPressedChange={() => editor.chain().focus().toggleBold().run()} aria-label="Bold">
              <Bold className="w-4 h-4" />
            </Toggle>
            <Toggle size="sm" pressed={editor.isActive("italic")} onPressedChange={() => editor.chain().focus().toggleItalic().run()} aria-label="Italic">
              <Italic className="w-4 h-4" />
            </Toggle>
            <Toggle size="sm" pressed={editor.isActive("strike")} onPressedChange={() => editor.chain().focus().toggleStrike().run()} aria-label="Strikethrough">
              <Strikethrough className="w-4 h-4" />
            </Toggle>
            <Toggle size="sm" pressed={editor.isActive("code")} onPressedChange={() => editor.chain().focus().toggleCode().run()} aria-label="Inline code">
              <Code className="w-4 h-4" />
            </Toggle>
          </div>

          <Separator orientation="vertical" className="h-6" />

          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={insertTaskList} className={cn("h-8 px-2", editor.isActive("taskList") && "bg-accent text-accent-foreground")} title="Add task list">
              <CheckSquare className="w-4 h-4" />
            </Button>
            <Toggle size="sm" pressed={editor.isActive("bulletList")} onPressedChange={() => editor.chain().focus().toggleBulletList().run()} aria-label="Bullet list">
              <List className="w-4 h-4" />
            </Toggle>
            <Toggle size="sm" pressed={editor.isActive("blockquote")} onPressedChange={() => editor.chain().focus().toggleBlockquote().run()} aria-label="Quote">
              <Quote className="w-4 h-4" />
            </Toggle>
          </div>

          <Separator orientation="vertical" className="h-6" />

          <div className="flex items-center gap-1">
            <Toggle size="sm" pressed={editor.isActive("heading", { level: 1 })} onPressedChange={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} aria-label="Heading 1">
              <Type className="w-4 h-4" />
              <span className="text-xs ml-1">1</span>
            </Toggle>
            <Toggle size="sm" pressed={editor.isActive("heading", { level: 2 })} onPressedChange={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} aria-label="Heading 2">
              <Type className="w-4 h-4" />
              <span className="text-xs ml-1">2</span>
            </Toggle>
            <Toggle size="sm" pressed={editor.isActive("heading", { level: 3 })} onPressedChange={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} aria-label="Heading 3">
              <Type className="w-4 h-4" />
              <span className="text-xs ml-1">3</span>
            </Toggle>
          </div>

          <Separator orientation="vertical" className="h-6" />

          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={() => editor.chain().focus().undo().run()} className="h-8 px-2" title="Undo">
              <Undo className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => editor.chain().focus().redo().run()} className="h-8 px-2" title="Redo">
              <Redo className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className={cn("relative rounded-lg border transition-all bg-background", isFocused ? "ring-2 ring-primary/20 border-primary/30" : "border-border")} onKeyDown={handleKeyDown}>
          <EditorContent editor={editor} />

          {slashOpen && (
            <div className="fixed z-50 w-64 rounded-md border bg-popover p-2 shadow-lg" style={{ left: slashPos?.x ?? 0, top: slashPos?.y ?? 0 }} role="listbox" aria-label="Slash commands">
              {getFilteredSlashItems(slashQuery).map((item, idx) => (
                <button
                  key={item.key}
                  className={cn("w-full flex items-center gap-2 p-2 rounded text-left text-sm hover:bg-accent/40", idx === slashIndex && "bg-accent/50")}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    applySlashItem(item, editor.state.selection.from);
                  }}
                >
                  <span className="shrink-0 text-muted-foreground">{item.icon}</span>
                  <span className="text-foreground">{item.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center space-x-2">
            {getSaveStatusIcon()}
            <span className={cn("text-muted-foreground", error && "text-destructive", lastSaved && !isDirty && "text-green-600")}>{getSaveStatusText()}</span>
          </div>
          <div className="flex items-center space-x-4">
            {error && (
              <button onClick={retrySave} className="text-xs text-primary hover:text-primary/80 underline" data-testid="enhanced-notes-retry-button">
                Retry
              </button>
            )}
            {lastSaved && !isDirty && (
              <span className="text-muted-foreground">
                {new Date(lastSaved).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
            {isFocused && <span className="text-muted-foreground">Press Ctrl+S to save</span>}
          </div>
        </div>
      </div>
    </>
  );
}


