import { useMemo, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format, startOfWeek, startOfMonth, startOfYear } from "date-fns";

type NoteType = "daily" | "weekly" | "monthly" | "yearly";

function normalizeAnchorDate(type: NoteType, date: Date): Date {
  switch (type) {
    case "weekly":
      return startOfWeek(date, { weekStartsOn: 1 });
    case "monthly":
      return startOfMonth(date);
    case "yearly":
      return startOfYear(date);
    default:
      return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }
}

function getKey(type: NoteType, anchorDate: Date): string {
  switch (type) {
    case "daily":
      return `${type}:${format(anchorDate, "yyyy-MM-dd")}`;
    case "weekly":
      return `${type}:${format(anchorDate, "yyyy-MM-dd")}`; // week start
    case "monthly":
      return `${type}:${format(anchorDate, "yyyy-MM")}`;
    case "yearly":
      return `${type}:${format(anchorDate, "yyyy")}`;
  }
}

export function useNotes(type: NoteType, date: Date) {
  const queryClient = useQueryClient();

  const anchorDate = useMemo(() => normalizeAnchorDate(type, date), [type, date]);
  const key = useMemo(() => getKey(type, anchorDate), [type, anchorDate]);

  const { data } = useQuery<{ id: string; content: string | null } | null>({
    queryKey: ["notes", type, key],
    queryFn: async () => {
      const params = new URLSearchParams({ type, anchorDate: anchorDate.toISOString() });
      const res = await fetch(`/api/notes?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to load note");
      return (await res.json()) as { id: string; content: string | null } | null;
    },
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 10,
  });

  const upsert = useCallback(
    async (content: string) => {
      const res = await fetch(`/api/notes`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, anchorDate: anchorDate.toISOString(), content }),
      });
      if (!res.ok) throw new Error("Failed to save note");
      const saved = (await res.json()) as { id: string; content: string | null };
      await queryClient.invalidateQueries({ queryKey: ["notes", type, key] });
      return saved;
    },
    [type, anchorDate, key, queryClient]
  );

  return { note: data ?? null, upsert } as const;
}


