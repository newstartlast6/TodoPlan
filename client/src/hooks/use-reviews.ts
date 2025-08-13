import { useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

type ReviewType = "daily" | "weekly";

export interface ReviewPayload {
  productivityRating?: number;
  achievedGoal?: boolean | null;
  achievedGoalReason?: string | null;
  satisfied?: boolean | null;
  satisfiedReason?: string | null;
  improvements?: string | null;
  biggestWin?: string | null;
  topChallenge?: string | null;
  topDistraction?: string | null;
  nextFocusPlan?: string | null;
  energyLevel?: number;
  mood?: string | null;
  goalAchievementStatus?: 'yes' | 'partially' | 'no' | null;
}

export interface Review extends ReviewPayload {
  id: string;
  type: ReviewType;
  anchorDate: string; // ISO date string (yyyy-mm-dd)
  createdAt?: string;
  updatedAt?: string;
}

function getKey(type: ReviewType, anchorDate: Date): string {
  const d = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), anchorDate.getDate());
  return `${type}:${d.toISOString().slice(0, 10)}`;
}

export function useReview(type: ReviewType, anchorDate: Date) {
  const queryClient = useQueryClient();
  const key = useMemo(() => getKey(type, anchorDate), [type, anchorDate]);

  const { data } = useQuery<Review | null>({
    queryKey: ["reviews", type, key],
    queryFn: async () => {
      const params = new URLSearchParams({
        type,
        anchorDate: anchorDate.toISOString(),
      });
      const res = await fetch(`/api/reviews?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to load review");
      return (await res.json()) as Review | null;
    },
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 10,
  });

  const upsert = useCallback(async (payload: ReviewPayload) => {
    const res = await fetch(`/api/reviews`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, anchorDate, ...payload }),
    });
    if (!res.ok) throw new Error("Failed to save review");
    const r = (await res.json()) as Review;
    await queryClient.invalidateQueries({ queryKey: ["reviews", type, key] });
    return r;
  }, [type, anchorDate, key, queryClient]);

  return { review: data ?? null, upsert };
}


