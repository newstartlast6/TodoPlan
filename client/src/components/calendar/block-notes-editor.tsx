import { useEffect, useRef, useState } from "react";
import "@blocknote/core/fonts/inter.css";
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/mantine/style.css";
import { BlockNoteEditor, PartialBlock } from "@blocknote/core";
import { useCreateBlockNote, SuggestionMenuController, DefaultReactSuggestionItem, SuggestionMenuProps } from "@blocknote/react";
import { getDefaultReactSlashMenuItems } from "@blocknote/react";
import { AlertCircle, CheckCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNotesAutoSave } from "@/hooks/use-notes-auto-save";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Toggle } from "@/components/ui/toggle";
import { Type, List, CheckSquare, Bold, Italic, Strikethrough, Quote, Code, Undo, Redo } from "lucide-react";

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
  const [, setSelectionVersion] = useState(0);

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
    const offSel = editor.onSelectionChange?.(() => setSelectionVersion((v) => v + 1));
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

  // Helpers reflecting pressed/active states
  const styles = editor.getActiveStyles?.() || {} as any;
  const currentBlock = editor.getTextCursorPosition().block as any;
  const currentType: string | undefined = currentBlock?.type;
  const currentLevel: number | undefined = currentBlock?.props?.level;

  const setBlockType = (type: string, props?: Record<string, any>) => {
    const block = editor.getTextCursorPosition().block;
    if (!block) return;
    editor.updateBlock(block, { type: type as any, props: props as any });
  };

  const toggleBlockType = (type: string, props?: Record<string, any>) => {
    if (currentType === type) {
      setBlockType("paragraph");
    } else {
      setBlockType(type, props);
    }
  };

  const toggleHeading = (level: 1 | 2 | 3) => {
    if (currentType === "heading" && currentLevel === level) {
      setBlockType("paragraph");
    } else {
      setBlockType("heading", { level });
    }
  };

  const insertTaskList = () => toggleBlockType("checkListItem");

  // Custom Slash Menu component (white menu with selection highlight and arrow)
  function CustomSlashMenu(props: SuggestionMenuProps<DefaultReactSuggestionItem>) {
    return (
      <div className="slash-menu bn-custom-slash">
        {props.items.map((item, index) => (
          <div
            key={item.title + index}
            className={cn("slash-menu-item", props.selectedIndex === index && "selected")}
            onClick={() => props.onItemClick?.(item)}
            role="option"
            aria-selected={props.selectedIndex === index}
          >
            {item.title}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div ref={containerRef} className={cn("flex flex-col space-y-3", className)}>
      {/* Toolbar - mirrors EnhancedNotesEditor */}
      <style>{`
        .bn-custom-slash { position: relative; }
        .slash-menu { background-color: #fff; border: 1px solid #e5e7eb; border-radius: 6px; box-shadow: 0 8px 24px rgba(0,0,0,0.08); display: flex; flex-direction: column; gap: 6px; height: fit-content; max-height: inherit; overflow: auto; padding: 6px; }
        .slash-menu::before { content: ""; position: absolute; top: -6px; left: 16px; width: 10px; height: 10px; background: #fff; border-left: 1px solid #e5e7eb; border-top: 1px solid #e5e7eb; transform: rotate(45deg); }
        .slash-menu-item { background-color: #fff; border: 1px solid #f3f4f6; border-radius: 6px; box-shadow: 0 1px 2px rgba(0,0,0,0.03); cursor: pointer; font-size: 14px; display: flex; align-items: center; padding: 8px 10px; }
        .slash-menu-item:hover, .slash-menu-item.selected { background-color: #f8fafc; }
      `}</style>
      <div className="flex items-center gap-1 p-2 border rounded-lg bg-muted/30">
        <div className="flex items-center gap-1">
          <Toggle size="sm" pressed={!!styles.bold} onPressedChange={() => editor.toggleStyles({ bold: true } as any)} aria-label="Bold">
            <Bold className="w-4 h-4" />
          </Toggle>
          <Toggle size="sm" pressed={!!styles.italic} onPressedChange={() => editor.toggleStyles({ italic: true } as any)} aria-label="Italic">
            <Italic className="w-4 h-4" />
          </Toggle>
          <Toggle size="sm" pressed={!!styles.strike} onPressedChange={() => editor.toggleStyles({ strike: true } as any)} aria-label="Strikethrough">
            <Strikethrough className="w-4 h-4" />
          </Toggle>
          <Toggle size="sm" pressed={!!styles.code} onPressedChange={() => editor.toggleStyles({ code: true } as any)} aria-label="Inline code">
            <Code className="w-4 h-4" />
          </Toggle>
        </div>

        <Separator orientation="vertical" className="h-6" />

        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={insertTaskList} className={cn("h-8 px-2", currentType === "checkListItem" && "bg-accent text-accent-foreground")} title="Add task list">
            <CheckSquare className="w-4 h-4" />
          </Button>
          <Toggle size="sm" pressed={currentType === "bulletListItem"} onPressedChange={() => toggleBlockType("bulletListItem")} aria-label="Bullet list">
            <List className="w-4 h-4" />
          </Toggle>
          <Toggle size="sm" pressed={currentType === "quote"} onPressedChange={() => toggleBlockType("quote")} aria-label="Quote">
            <Quote className="w-4 h-4" />
          </Toggle>
        </div>

        <Separator orientation="vertical" className="h-6" />

        <div className="flex items-center gap-1">
          <Toggle size="sm" pressed={currentType === "heading" && currentLevel === 1} onPressedChange={() => toggleHeading(1)} aria-label="Heading 1">
            <Type className="w-4 h-4" />
            <span className="text-xs ml-1">1</span>
          </Toggle>
          <Toggle size="sm" pressed={currentType === "heading" && currentLevel === 2} onPressedChange={() => toggleHeading(2)} aria-label="Heading 2">
            <Type className="w-4 h-4" />
            <span className="text-xs ml-1">2</span>
          </Toggle>
          <Toggle size="sm" pressed={currentType === "heading" && currentLevel === 3} onPressedChange={() => toggleHeading(3)} aria-label="Heading 3">
            <Type className="w-4 h-4" />
            <span className="text-xs ml-1">3</span>
          </Toggle>
        </div>

        <Separator orientation="vertical" className="h-6" />

        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={() => editor.undo()} className="h-8 px-2" title="Undo">
            <Undo className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => editor.redo()} className="h-8 px-2" title="Redo">
            <Redo className="w-4 h-4" />
          </Button>
        </div>
      </div>

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
            suggestionMenuComponent={CustomSlashMenu}
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


