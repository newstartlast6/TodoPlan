import { useState, useMemo, useRef, useEffect } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { PencilLine, StickyNote, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type NoteType = "daily" | "weekly" | "monthly" | "yearly";

interface NotesButtonProps {
  type: NoteType;
  anchorDate: Date;
  value?: string | null;
  onSave: (content: string) => Promise<void> | void;
  className?: string;
}

export function NotesButton({ type, anchorDate, value, onSave, className }: NotesButtonProps) {
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState(value ?? "");
  const [saving, setSaving] = useState(false);
  const initialRef = useRef<HTMLTextAreaElement | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      // Slight delay to allow popover to mount
      setTimeout(() => initialRef.current?.focus(), 25);
    }
  }, [open]);

  useEffect(() => {
    setContent(value ?? "");
  }, [value, anchorDate?.toISOString?.()]);

  const hasNotes = useMemo(() => (value ?? "").trim().length > 0 || content.trim().length > 0, [value, content]);
  const label = useMemo(() => {
    switch (type) {
      case "daily": return "Day Notes";
      case "weekly": return "Week Notes";
      case "monthly": return "Month Notes";
      case "yearly": return "Year Notes";
    }
  }, [type]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(content.trim());
      toast({ title: "Notes saved", description: "Your note has been saved successfully." });
      setOpen(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <TooltipProvider>
      <Popover open={open} onOpenChange={setOpen}>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "h-7 w-7 rounded-full border border-transparent hover:border-border",
                  hasNotes ? "bg-yellow-100 text-yellow-800 hover:bg-yellow-200" : "text-muted-foreground",
                  className
                )}
                aria-label={`${label}`}
              >
                {hasNotes ? <StickyNote className="h-3.5 w-3.5" /> : <PencilLine className="h-3.5 w-3.5" />}
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent>{label}</TooltipContent>
        </Tooltip>
        <PopoverContent align="end" className="w-[320px] p-3">
          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground">{label}</div>
            <Textarea
              ref={initialRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write a quick note..."
              className="min-h-[100px]"
            />
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" size="sm" onClick={() => setOpen(false)}>Close</Button>
              <Button size="sm" onClick={handleSave} disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </TooltipProvider>
  );
}


