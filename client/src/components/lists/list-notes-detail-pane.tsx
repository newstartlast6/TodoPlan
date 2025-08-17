import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { BlockNotesEditor } from "@/components/calendar/block-notes-editor";
import { StickyNote, Loader2, CheckCircle, AlertCircle, Maximize2, Minimize2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useUpdateListNote } from "@/hooks/use-list-notes";
import type { ListNote } from "@shared/schema";

interface ListNotesDetailPaneProps {
  note: ListNote;
  onClose?: () => void;
  className?: string;
  onUpdate?: (noteId: string, updates: { title?: string; content?: string }) => void;
  onDelete?: (noteId: string) => void;
}

export function ListNotesDetailPane({ note, onClose, className, onUpdate, onDelete }: ListNotesDetailPaneProps) {
  const [draft, setDraft] = useState<string>(note?.content ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();
  
  const updateNoteMutation = useUpdateListNote();

  const title = useMemo(() => {
    return `Note: ${note.title}`;
  }, [note.title]);

  // Update content when note changes
  useEffect(() => {
    setDraft(note?.content ?? "");
  }, [note?.content]);

  // Autosave when draft changes
  useEffect(() => {
    if (draft === (note?.content ?? "")) {
      setIsDirty(false);
      return;
    }
    setIsDirty(true);
    setError(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        setIsSaving(true);
        await updateNoteMutation.mutateAsync({
          noteId: note.id,
          updates: { content: draft }
        });
        setIsSaving(false);
        setIsDirty(false);
        setLastSaved(new Date());
      } catch (e) {
        setIsSaving(false);
        setError(e instanceof Error ? e.message : "Failed to save");
      }
    }, 800);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [draft, updateNoteMutation, note?.content, note.id]);

  return (
    <div className={cn(
      isFullscreen ? "fixed inset-0 z-50 bg-white" : "h-full bg-white border-l border-gray-100",
      "flex flex-col py-3",
      className
    )} data-testid="list-notes-detail-pane">
      <div className={cn("flex items-center justify-between px-4 sm:px-8 py-3 border-b border-gray-100", isFullscreen && "shadow-sm") }>
        <div className="flex items-center gap-2">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-orange-100 text-orange-700 ring-1 ring-orange-300">
            <StickyNote className="h-3.5 w-3.5" />
          </span>
          <h3 className="text-base font-semibold text-gray-900">{title}</h3>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-8"
            onClick={() => setIsFullscreen(v => !v)}
            title={isFullscreen ? "Exit full screen" : "Full screen"}
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8"
            onClick={onClose}
          >
            Close
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        <div className={cn("h-full", isFullscreen ? "p-4 sm:p-6" : "p-6") }>
          <BlockNotesEditor
            key={`list-note:${note.id}`}
            value={note?.content ?? ""}
            onChange={setDraft}
            placeholder="Write your notes here..."
            className="text-lg md:text-[16px] font-medium h-full border-none"
          />
          <div className="mt-2 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              {isSaving ? (
                <Loader2 className="w-3 h-3 animate-spin text-gray-500" />
              ) : error ? (
                <AlertCircle className="w-3 h-3 text-red-600" />
              ) : lastSaved && !isDirty ? (
                <CheckCircle className="w-3 h-3 text-green-600" />
              ) : null}
              <span className={cn(
                "text-gray-500",
                error && "text-red-600",
                lastSaved && !isDirty && "text-green-600"
              )}>
                {isSaving ? "Saving..." : error ? "Failed to save" : lastSaved && !isDirty ? "Saved" : isDirty ? "Unsaved changes" : ""}
              </span>
            </div>
            {lastSaved && !isDirty && (
              <span className="text-gray-500">
                {new Date(lastSaved).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}