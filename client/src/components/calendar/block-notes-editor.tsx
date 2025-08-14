import { useEffect, useRef, useState } from "react";
import "@blocknote/core/fonts/inter.css";
import { BlockNoteView, Theme, lightDefaultTheme, darkDefaultTheme } from "@blocknote/mantine";
import "@blocknote/mantine/style.css";
import { BlockNoteEditor, PartialBlock } from "@blocknote/core";
import { useCreateBlockNote, SuggestionMenuController, DefaultReactSuggestionItem, SuggestionMenuProps } from "@blocknote/react";
import { AlertCircle, CheckCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNotesAutoSave } from "@/hooks/use-notes-auto-save";
import { Type, List, CheckSquare, Quote, Minus } from "lucide-react";

interface BlockNotesEditorProps {
  // Autosave mode (task notes)
  taskId?: string;
  initialNotes?: string;
  // Controlled mode (period notes)
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  className?: string;
  onSaveSuccess?: () => void;
  onSaveError?: (error: string) => void;
}

export function BlockNotesEditor({
  taskId,
  initialNotes,
  value,
  onChange,
  placeholder = "Type '/' for commands",
  className,
  onSaveSuccess,
  onSaveError,
}: BlockNotesEditorProps) {
  const [isFocused, setIsFocused] = useState(false);

  const autosaveMode = !!taskId;
  const { isDirty, isSaving, lastSaved, error, updateNotes, forceSave, retrySave } =
    useNotesAutoSave({ taskId: taskId || "", initialNotes: initialNotes || "", debounceMs: 800, onSaveSuccess, onSaveError });

  // Initialize BlockNote with HTML content to keep storage as simple text
  const editor = useCreateBlockNote({
    initialContent: [{ type: "paragraph" }] as PartialBlock[],
    // Match enhanced editor: tight left alignment, smaller font, no side spacing
    domAttributes: {
        editor: {
          // Remove padding/margins and shrink font-size for compact appearance
          class: "px-2 mx-2 text-[13px] leading-[1.45]",
        },
      },
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

  // Initialize content only when the editor mounts or when the logical doc changes (taskId)
  const initializedForRef = useRef<string | null>(null);
  const initKey = autosaveMode ? (taskId || '') : 'controlled';
  useEffect(() => {
    if (!editor) return;
    if (initializedForRef.current === initKey) return;
    (async () => {
      const html = autosaveMode ? (initialNotes || "") : (value || "");
      const blocks = await editor.tryParseHTMLToBlocks(html || "<p></p>");
      editor.replaceBlocks(editor.topLevelBlocks.map(b => b.id), blocks.length ? blocks : [{ type: "paragraph" }]);
      initializedForRef.current = initKey;
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, initKey]);

  // Persist on change (serialize to HTML string)
  useEffect(() => {
    if (!editor) return;
    const unsubscribe = editor.onChange(async () => {
      const html = await editor.blocksToFullHTML(editor.document);
      if (autosaveMode) {
        updateNotes(html);
      } else {
        onChange?.(html);
      }
    });
    return () => { (unsubscribe as any)?.(); };
  }, [editor, autosaveMode, updateNotes, onChange]);

  // Keyboard: Cmd/Ctrl+S to force save
  const containerRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onKey = (e: KeyboardEvent) => {
      if (autosaveMode && (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        forceSave();
      }
    };
    el.addEventListener("keydown", onKey);
    return () => el.removeEventListener("keydown", onKey);
  }, [autosaveMode, forceSave]);

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

  // Helpers for current block state
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

  // Custom Slash Menu component (white menu with selection highlight and arrow)
  function CustomSlashMenu(
    props: SuggestionMenuProps<DefaultReactSuggestionItem & { icon?: JSX.Element }>
  ) {
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
            {item.icon ? (
              <span className="mr-2 inline-flex items-center justify-center text-muted-foreground">
                {item.icon}
              </span>
            ) : null}
            <span className="text-foreground">{item.title}</span>
          </div>
        ))}
      </div>
    );
  }

  // Programmatic BlockNote theme to get crisp borders, white menus, and app font
  const minimalTheme: { light: Theme; dark: Theme } = {
    light: {
      colors: {
        editor: { text: "#111827", background: "#ffffff" },
        menu: { text: "#111827", background: "#ffffff" },
        tooltip: { text: "#111827", background: "#f9fafb" },
        hovered: { text: "#111827", background: "#f3f4f6" },
        selected: { text: "#111827", background: "#e5e7eb" },
        disabled: { text: "#9ca3af", background: "#f3f4f6" },
        shadow: "rgba(0,0,0,0.08)",
        border: "#e5e7eb",
        sideMenu: "#e5e7eb",
        highlights: lightDefaultTheme.colors!.highlights,
      },
      borderRadius: 8,
      fontFamily: "Inter, 'Open Sans', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
    },
    dark: {
      colors: {
        editor: { text: "#e5e7eb", background: "#0b0f1a" },
        menu: { text: "#e5e7eb", background: "#111827" },
        tooltip: { text: "#e5e7eb", background: "#0f172a" },
        hovered: { text: "#e5e7eb", background: "#0f172a" },
        selected: { text: "#e5e7eb", background: "#1f2937" },
        disabled: { text: "#6b7280", background: "#0f172a" },
        shadow: "rgba(0,0,0,0.35)",
        border: "#1f2937",
        sideMenu: "#374151",
        highlights: darkDefaultTheme.colors!.highlights,
      },
      borderRadius: 8,
      fontFamily: "Inter, 'Open Sans', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
    },
  };

  return (
    <div ref={containerRef} className={cn("flex flex-col space-y-3 h-full", className)}>
      {/* Slash menu styles and editor tweaks */}
      <style>{`
        .bn-custom-slash { position: relative; }
        .slash-menu {
          background-color: var(--bn-colors-menu-background);
          border: 1px solid var(--bn-colors-border);
          border-radius: 8px;
          box-shadow: 0 8px 28px var(--bn-colors-shadow, rgba(0,0,0,0.08));
          display: flex;
          flex-direction: column;
          gap: 4px;
          height: fit-content;
          max-height: inherit;
          overflow: auto;
          padding: 6px;
          width: 280px;
        }
        .slash-menu::before {
          content: "";
          position: absolute;
          top: -6px;
          left: 16px;
          width: 10px;
          height: 10px;
          background: var(--bn-colors-menu-background);
          border-left: 1px solid var(--bn-colors-border);
          border-top: 1px solid var(--bn-colors-border);
          transform: rotate(45deg);
        }
        .slash-menu-item {
          background-color: var(--bn-colors-menu-background);
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          display: flex;
          align-items: center;
          padding: 8px 10px;
        }
        .slash-menu-item:hover,
        .slash-menu-item.selected {
          background-color: var(--bn-colors-hovered-background);
        }
        /* Remove any default left gutter and ensure full width */
        .bn-container .bn-editor { padding-left: 12px !important; padding-right: 0 !important; margin-left: 0 !important; margin-right: 0 !important; width: 100% !important; }
        .bn-container .bn-block-group { margin-left: 0 !important; }
        .bn-container .bn-block-group .bn-block-group > .bn-block-outer:not([data-prev-depth-changed])::before { display: none !important; }
        /* Force inline content to flow normally (fix accidental vertical stacking) */
        .bn-container .bn-block-content { flex-direction: row !important; align-items: flex-start !important; }
        .bn-container .bn-inline-content { display: block !important; width: 100% !important; white-space: pre-wrap !important; word-break: break-word !important; }
      `}</style>
      {/* Header toolbar intentionally removed; rely on selection toolbar */}

      <div
        className={cn(
          "relative rounded-lg border transition-all bg-background flex-1 min-h-0",
          isFocused ? "ring-2 ring-primary/20 border-primary/30" : "border-border"
        )}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        style={{ minHeight: 300 }}       
      >
        <BlockNoteView
          editor={editor as unknown as BlockNoteEditor}
          theme={minimalTheme}
          onChange={() => { /* handled in editor.onChange above */ }}
          editable
          // turn off optional UIs that reference sideMenu/drag
          sideMenu={false}
          tableHandles={false}
          filePanel={false}
          comments={false}
          emojiPicker={false}
          formattingToolbar={true}
          linkToolbar={false}
           slashMenu={false}
           className="px-0"
        >
          <SuggestionMenuController
            triggerCharacter="/"
            // Build the same set as the TipTap enhanced editor, with our own icons and actions
            getItems={async (query: string) => {
              const items: Array<DefaultReactSuggestionItem & { icon?: JSX.Element }> = [
                { title: "Heading 1", onItemClick: () => toggleHeading(1), icon: <Type className="w-4 h-4" /> },
                { title: "Heading 2", onItemClick: () => toggleHeading(2), icon: <Type className="w-4 h-4" /> },
                { title: "Heading 3", onItemClick: () => toggleHeading(3), icon: <Type className="w-4 h-4" /> },
                { title: "Bulleted List", onItemClick: () => toggleBlockType("bulletListItem"), icon: <List className="w-4 h-4" /> },
                { title: "Numbered List", onItemClick: () => toggleBlockType("numberedListItem"), icon: <List className="w-4 h-4" /> },
                { title: "Check Item", onItemClick: () => toggleBlockType("checkListItem"), icon: <CheckSquare className="w-4 h-4" /> },
                { title: "Quote", onItemClick: () => toggleBlockType("quote"), icon: <Quote className="w-4 h-4" /> },
                { title: "Horizontal Line", onItemClick: () => toggleBlockType("pageBreak"), icon: <Minus className="w-4 h-4" /> },
              ];
              const q = (query || "").toLowerCase();
              return q ? items.filter(i => i.title.toLowerCase().includes(q)) : items;
            }}
            suggestionMenuComponent={CustomSlashMenu}
          />
        </BlockNoteView>
      </div>

      {autosaveMode && (
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
      )}
    </div>
  );
}


