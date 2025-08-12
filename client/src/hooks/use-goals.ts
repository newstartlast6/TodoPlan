import { useMemo, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format, startOfWeek, startOfMonth, startOfYear } from "date-fns";
import type { GoalType } from "@shared/schema";

function getStorageKey(type: GoalType, anchorDate: Date): string {
  switch (type) {
    case "daily": {
      const dayKey = format(anchorDate, "yyyy-MM-dd");
      return `goal:daily:${dayKey}`;
    }
    case "weekly": {
      const weekStart = startOfWeek(anchorDate, { weekStartsOn: 1 });
      const weekKey = format(weekStart, "yyyy-MM-dd");
      return `goal:weekly:${weekKey}`;
    }
    case "monthly": {
      const monthStart = startOfMonth(anchorDate);
      const monthKey = format(monthStart, "yyyy-MM");
      return `goal:monthly:${monthKey}`;
    }
    case "yearly": {
      const yearStart = startOfYear(anchorDate);
      const yearKey = format(yearStart, "yyyy");
      return `goal:yearly:${yearKey}`;
    }
  }
}

export function useGoal(type: GoalType, date: Date) {
  const queryClient = useQueryClient();

  const anchorDate = useMemo(() => {
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
  }, [type, date]);

  const anchorKey = useMemo(() => getStorageKey(type, anchorDate), [type, anchorDate]);

  const { data: goal = "" } = useQuery<string>({
    queryKey: ["goals", type, anchorKey],
    queryFn: async () => {
      const params = new URLSearchParams({
        type,
        anchorDate: anchorDate.toISOString(),
      });
      const res = await fetch(`/api/goals?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to load goal");
      const data = await res.json();
      return data?.value ?? "";
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 10, // 10 minutes
    enabled: Boolean(type && anchorKey),
  });

  const updateGoal = useCallback(
    async (next: string) => {
      const queryKey = ["goals", type, anchorKey] as const;
      // Optimistic update
      const previous = queryClient.getQueryData<string>(queryKey);
      queryClient.setQueryData<string>(queryKey, next);
      try {
        const res = await fetch(`/api/goals`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type, anchorDate: anchorDate.toISOString(), value: next }),
        });
        if (!res.ok) throw new Error("Failed to save goal");
        // Keep cache; notify any listeners that want to refresh UI outside of React Query
        try { window.dispatchEvent(new CustomEvent("goals:updated")); } catch {}
      } catch (e) {
        // Revert on failure
        queryClient.setQueryData<string | undefined>(queryKey, previous);
      }
    },
    [queryClient, type, anchorKey, anchorDate]
  );

  return { goal, setGoal: updateGoal } as const;
}

export function getGoalFor(type: GoalType, date: Date): string {
  // Deprecated: kept for compatibility if some components still import it
  return "";
}

export function setGoalFor(type: GoalType, date: Date, value: string) {
  // Deprecated: use API-backed hook instead
}


