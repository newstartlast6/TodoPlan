import { useEffect, useMemo, useState } from "react";
import { format, startOfWeek, startOfMonth, startOfYear } from "date-fns";

export type GoalType = "daily" | "weekly" | "monthly" | "yearly";

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
  const storageKey = useMemo(() => getStorageKey(type, date), [type, date]);
  const [goal, setGoal] = useState<string>("");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      setGoal(saved ?? "");
    } catch {
      // ignore
      setGoal("");
    }
  }, [storageKey]);

  const updateGoal = (next: string) => {
    setGoal(next);
    try {
      if (!next) {
        localStorage.removeItem(storageKey);
      } else {
        localStorage.setItem(storageKey, next);
      }
      window.dispatchEvent(new CustomEvent("goals:updated"));
    } catch {
      // ignore persistence errors
    }
  };

  return { goal, setGoal: updateGoal } as const;
}

export function getGoalFor(type: GoalType, date: Date): string {
  try {
    const key = getStorageKey(type, date);
    return localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}

export function setGoalFor(type: GoalType, date: Date, value: string) {
  try {
    const key = getStorageKey(type, date);
    if (!value) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, value);
    }
    window.dispatchEvent(new CustomEvent("goals:updated"));
  } catch {
    // ignore
  }
}


