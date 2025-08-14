import { useEffect, useRef, useState } from "react";
import "@blocknote/core/fonts/inter.css";
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/mantine/style.css";
import { BlockNoteEditor, PartialBlock } from "@blocknote/core";
import { useCreateBlockNote, SuggestionMenuController } from "@blocknote/react";
import { getDefaultReactSlashMenuItems } from "@blocknote/react";
import { AlertCircle, CheckCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNotesAutoSave } from "@/hooks/use-notes-auto-save";

interface BlockNotesEditorProps {
  taskId: string;
  initialNotes: string;
  placeholder?: string;
  className?: string;
  onSaveSuccess?: () => void;
  onSaveError?: (error: string) => void;
}

export function BlockNotesEditor({
  taskId,
  initialNotes,
  placeholder = "Type '/' for commands",
  className,
  onSaveSuccess,
  onSaveError,
}: BlockNotesEditorProps) {
  const [isFocused, setIsFocused] = useState(false);

  const { isDirty, isSaving, lastSaved, error, updateNotes, forceSave, retrySave } =
    useNotesAutoSave({ taskId, initialNotes, debounceMs: 800, onSaveSuccess, onSaveError });

  // Initialize BlockNote with HTML content to keep storage as simple text
  const editor = useCreateBlockNote({
    initialContent: [{ type: "paragraph" }] as PartialBlock[],
    domAttributes: { editor: { class: "rounded-md" } },
    // disable drag handle side menu for a simpler experience
    _tiptapOptions: {
      editorProps: {
        handleDOMEvents: {},
      },
    },
    disableExtensions: [
      // Side menu contains drag handle; disable to avoid block dragging
      "sideMenu",
      // Tables, file panel, comments are not needed for simple notes
      "tableHandles",
      "filePanel",
      "comments",
    ],
  } as any);

  // Set initial content from HTML once editor mounts
  useEffect(() => {
    if (!editor) return;
    (async () => {
      const html = initialNotes || "";
      const blocks = await editor.tryParseHTMLToBlocks(html || "<p></p>");
      editor.replaceBlocks(editor.topLevelBlocks.map(b => b.id), blocks.length ? blocks : [{ type: "paragraph" }]);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  // Persist on change (serialize to HTML string)
  useEffect(() => {
    if (!editor) return;
    const unsubscribe = editor.onChange(async () => {
      const html = await editor.blocksToFullHTML(editor.document);
      updateNotes(html);
    });
    return () => { (unsubscribe as any)?.(); };
  }, [editor, updateNotes]);

  // Keyboard: Cmd/Ctrl+S to force save
  const containerRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        forceSave();
      }
    };
    el.addEventListener("keydown", onKey);
    return () => el.removeEventListener("keydown", onKey);
  }, [forceSave]);

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

  if (!editor) {
    return (
      <div className={cn("flex items-center justify-center p-8", className)}>
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div ref={containerRef} className={cn("flex flex-col space-y-3", className)}>
      <div
        className={cn(
          "relative rounded-lg border transition-all bg-background",
          isFocused ? "ring-2 ring-primary/20 border-primary/30" : "border-border"
        )}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        style={{ minHeight: 300 }}
      >
        <BlockNoteView
          editor={editor as unknown as BlockNoteEditor}
          theme={"light"}
          onChange={() => { /* handled in editor.onChange above */ }}
          editable
          // turn off optional UIs that reference sideMenu/drag
          sideMenu={false}
          tableHandles={false}
          filePanel={false}
          comments={false}
          emojiPicker={false}
          formattingToolbar={false}
          linkToolbar={false}
          slashMenu={false}
        >
          <SuggestionMenuController
            triggerCharacter="/"
            getItems={async (query: string) => {
              const items = getDefaultReactSlashMenuItems(editor as any);
              const allowed = new Set([
                "paragraph",
                "heading",
                "heading_2",
                "heading_3",
                "bullet_list",
                "numbered_list",
                "check_list",
                "quote",
                "page_break",
              ]);
              const filtered = (items as any[]).filter((i) => allowed.has(i.key));
              if (!query) return filtered;
              const q = query.toLowerCase();
              return filtered.filter((i) => (i.title || "").toLowerCase().includes(q));
            }}
          />
        </BlockNoteView>
      </div>

      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center space-x-2">
          {getSaveStatusIcon()}
          <span className={cn("text-muted-foreground", error && "text-destructive", lastSaved && !isDirty && "text-green-600")}>{getSaveStatusText()}</span>
        </div>
        <div className="flex items-center space-x-4">
          {error && (
            <button onClick={retrySave} className="text-xs text-primary hover:text-primary/80 underline">Retry</button>
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
  );
}


