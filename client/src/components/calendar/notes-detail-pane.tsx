import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { useNotes } from "@/hooks/use-notes";
import { Button } from "@/components/ui/button";
import { format, startOfWeek, endOfWeek } from "date-fns";
import { NotesPlainEditor } from "@/components/calendar/notes-editor";
import { StickyNote } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type NoteType = "daily" | "weekly" | "monthly" | "yearly";

interface NotesDetailPaneProps {
  type: NoteType;
  anchorDate: Date;
  onClose?: () => void;
  className?: string;
}

export function NotesDetailPane({ type, anchorDate, onClose, className }: NotesDetailPaneProps) {
  const { note, upsert } = useNotes(type, anchorDate);
  const [draft, setDraft] = useState<string>(note?.content ?? "");
  const { toast } = useToast();

  const title = useMemo(() => {
    switch (type) {
      case "daily":
        return `Day Notes · ${format(anchorDate, "EEEE, MMM d, yyyy")}`;
      case "weekly": {
        const ws = startOfWeek(anchorDate, { weekStartsOn: 1 });
        const we = endOfWeek(anchorDate, { weekStartsOn: 1 });
        return `Week Notes · ${format(ws, "MMM d")} - ${format(we, "MMM d, yyyy")}`;
      }
      case "monthly":
        return `Month Notes · ${format(anchorDate, "MMMM yyyy")}`;
      case "yearly":
        return `Year Notes · ${format(anchorDate, "yyyy")}`;
    }
  }, [type, anchorDate]);

  return (
    <div className={cn("h-full flex flex-col bg-white border-l border-gray-100", className)} data-testid="notes-detail-pane">
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-white">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-orange-100 text-orange-700 ring-1 ring-orange-300">
            <StickyNote className="h-3.5 w-3.5" />
          </span>
          <h3 className="text-base font-semibold text-gray-900">{title}</h3>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8"
            onClick={onClose}
          >
            Close
          </Button>
          <Button
            size="sm"
            className="h-8"
            onClick={async () => {
              try {
                await upsert(draft);
                const friendly = (() => {
                  switch (type) {
                    case "daily":
                      return format(anchorDate, "EEEE, MMM d, yyyy");
                    case "weekly": {
                      const ws = startOfWeek(anchorDate, { weekStartsOn: 1 });
                      const we = endOfWeek(anchorDate, { weekStartsOn: 1 });
                      return `${format(ws, "MMM d")} - ${format(we, "MMM d, yyyy")}`;
                    }
                    case "monthly":
                      return format(anchorDate, "MMMM yyyy");
                    case "yearly":
                      return format(anchorDate, "yyyy");
                  }
                })();
                toast({
                  title: "Notes saved",
                  description: `Your ${type} notes for ${friendly} have been saved successfully.`,
                });
              } catch (e) {
                toast({ title: "Failed to save notes", description: e instanceof Error ? e.message : "Please try again.", variant: "destructive" });
              }
            }}
          >
            Save
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        <div className="h-full p-6">
          <NotesPlainEditor
            key={`${type}:${anchorDate.toISOString().slice(0,10)}`}
            value={note?.content ?? ""}
            onChange={setDraft}
            placeholder="Set goal, brain dump, ideas, plan,…"
            className="text-[15px] h-full"
          />
        </div>
      </div>
    </div>
  );
}


