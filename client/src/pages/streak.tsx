import { useEffect, useMemo, useState } from "react";
import { addDays, format, isSameDay, startOfDay, startOfMonth, addMonths, getDaysInMonth, isBefore, isAfter, endOfMonth, differenceInCalendarDays } from "date-fns";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MinimalisticSidebar } from "@/components/calendar/minimalistic-sidebar";
import { ResponsiveLayout } from "@/components/layout/responsive-layout";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Sparkles, Flame } from "lucide-react";
import { Task } from "@shared/schema";
import { apiRequest } from '@/lib/queryClient';

type DailySummary = {
  date: string;
  totalSeconds: number;
  remainingSeconds: number;
  targetSeconds: number;
};

const DAILY_TARGET_SECONDS = 8 * 60 * 60;
const STREAK_START_DATE = startOfDay(new Date("2025-08-11T00:00:00"));
const STREAK_END_DATE = endOfMonth(new Date("2025-12-01T00:00:00"));

export default function Streak() {
  const [summaries, setSummaries] = useState<Record<string, DailySummary>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const today = startOfDay(new Date());
  const endDate = STREAK_END_DATE;
  const totalDays = Math.max(1, differenceInCalendarDays(endDate, STREAK_START_DATE) + 1);

  const allDays = useMemo(() => {
    return Array.from({ length: totalDays }, (_, i) => addDays(STREAK_START_DATE, i));
  }, [totalDays]);

  const months = useMemo(() => {
    const list: { start: Date; label: string; year: number; month: number; daysInMonth: number }[] = [];
    let m = startOfMonth(STREAK_START_DATE);
    while (!isAfter(m, endDate)) {
      list.push({
        start: m,
        label: format(m, 'MMM yyyy'),
        year: m.getFullYear(),
        month: m.getMonth(),
        daysInMonth: getDaysInMonth(m),
      });
      m = addMonths(m, 1);
    }
    return list;
  }, [endDate]);

  useEffect(() => {
    let isCancelled = false;
    async function fetchTasks() {
      setIsLoading(true);
      setError(null);
      try {
        const searchParams = new URLSearchParams({
          startDate: STREAK_START_DATE.toISOString(),
          endDate: endDate.toISOString(),
          includeUnscheduled: 'true',
        });
        const res = await apiRequest('GET', `/api/tasks?${searchParams}`);
        const tasks: Task[] = await res.json();
        if (isCancelled) return;
        // Aggregate by day using startTime or scheduledDate (mirrors week view logic)
        const totals = new Map<string, number>();
        for (const t of tasks) {
          const when = (t as any).scheduledDate ? new Date((t as any).scheduledDate) : new Date(t.startTime);
          const key = format(when, 'yyyy-MM-dd');
          const prev = totals.get(key) ?? 0;
          const add = Number((t as any).timeLoggedSeconds) || 0;
          totals.set(key, prev + add);
        }
        const map: Record<string, DailySummary> = {};
        allDays.forEach((d) => {
          const key = format(d, 'yyyy-MM-dd');
          const total = totals.get(key) ?? 0;
          map[key] = {
            date: key,
            totalSeconds: total,
            remainingSeconds: Math.max(0, DAILY_TARGET_SECONDS - total),
            targetSeconds: DAILY_TARGET_SECONDS,
          };
        });
        setSummaries(map);
      } catch (e) {
        if (!isCancelled) setError(e instanceof Error ? e.message : 'Failed to load streak data');
      } finally {
        if (!isCancelled) setIsLoading(false);
      }
    }
    fetchTasks();
    return () => {
      isCancelled = true;
    };
  }, [endDate.toISOString()]);

  const achievedByDate = (date: Date) => {
    const key = format(date, "yyyy-MM-dd");
    const item = summaries[key];
    if (!item) return false;
    return item.totalSeconds >= DAILY_TARGET_SECONDS;
  };

  const streakStats = useMemo(() => {
    let current = 0;
    let longest = 0;
    for (let i = allDays.length - 1; i >= 0; i--) {
      if (achievedByDate(allDays[i])) current++;
      else break;
    }
    let temp = 0;
    for (let i = 0; i < allDays.length; i++) {
      if (achievedByDate(allDays[i])) {
        temp++;
        longest = Math.max(longest, temp);
      } else {
        temp = 0;
      }
    }
    // Bounce back: length of the most recent lost streak immediately before an achieved day
    let bounceBack = 0;
    for (let i = allDays.length - 1; i >= 1; i--) {
      if (achievedByDate(allDays[i]) && !achievedByDate(allDays[i - 1])) {
        // Count consecutive lost days backward
        let lostCount = 0;
        let t = i - 1;
        while (t >= 0 && !achievedByDate(allDays[t])) {
          lostCount++;
          t--;
        }
        bounceBack = lostCount;
        break;
      }
    }
    return { current, longest, bounceBack };
  }, [summaries, allDays]);

  const renderSidebar = () => (
    <MinimalisticSidebar />
  );

  const renderMain = () => (
    <div className="flex-1 flex flex-col">
      <header className="bg-surface border-b border-border px-8 py-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-foreground flex items-center gap-3">
              <Flame className="text-orange-500" /> Streak
            </h2>
            <div className="text-sm text-muted-foreground">From {format(STREAK_START_DATE, "MMM d, yyyy")} to {format(today, "MMM d, yyyy")}</div>
          </div>
          <div className="flex items-center gap-2">
            <Badge className="bg-orange-500 text-white">
              Current: {streakStats.current}d
            </Badge>
            <Badge variant="outline" className="border-orange-300 text-orange-700">
              Longest: {streakStats.longest}d
            </Badge>
            <Badge variant="outline" className="border-emerald-300 text-emerald-700">
              Bounce Back: {streakStats.bounceBack}d
            </Badge>
            <Badge variant="outline">Target: 8h/day</Badge>
          </div>
        </div>
      </header>

      <main className="p-8">
        <Card className="overflow-hidden shadow-sm">
          <CardHeader className="border-b">
            <div className="flex items-center justify-between">
              <div className="font-semibold">Continuous Year</div>
              {isLoading && <div className="text-sm text-muted-foreground">Loading…</div>}
              {error && <div className="text-sm text-red-600">{error}</div>}
            </div>
          </CardHeader>
          <CardContent className="p-5">
            <div className="space-y-4">
              {months.map((m) => {
                const days = Array.from({ length: 31 }, (_, i) => i + 1);
                return (
                  <div key={`row-${m.label}`} className="flex items-center gap-3">
                    <div className="w-[120px] text-sm font-semibold text-foreground whitespace-nowrap">{m.label}</div>
                    <div
                      className="grid flex-1"
                      style={{ gridTemplateColumns: `repeat(31, minmax(24px, 1fr))`, columnGap: 6, rowGap: 6 }}
                    >
                      {days.map((day) => {
                        if (day > m.daysInMonth) {
                          // End-of-month placeholders to keep a full 31-column grid
                          return (
                            <div key={`cell-${m.label}-${day}`} className="relative aspect-square w-full rounded-[4px] border bg-white/60">
                              <div
                                aria-hidden
                                className="absolute inset-0 pointer-events-none"
                                style={{
                                  backgroundImage:
                                    "linear-gradient(45deg, transparent calc(50% - 1px), #94a3b8 calc(50% - 1px), #94a3b8 calc(50% + 1px), transparent calc(50% + 1px)), linear-gradient(-45deg, transparent calc(50% - 1px), #94a3b8 calc(50% - 1px), #94a3b8 calc(50% + 1px), transparent calc(50% + 1px))",
                                  backgroundRepeat: "no-repeat, no-repeat",
                                  backgroundSize: "100% 100%, 100% 100%",
                                  opacity: 0.6,
                                }}
                              />
                            </div>
                          );
                        }

                        const date = new Date(m.year, m.month, day);
                        const outOfRange = isBefore(date, STREAK_START_DATE) || isAfter(date, endDate);
                        const key = format(date, 'yyyy-MM-dd');
                        const summary = summaries[key];
                        const achieved = !outOfRange && !!summary && summary.totalSeconds >= DAILY_TARGET_SECONDS;
                        const isTodayFlag = !outOfRange && isSameDay(date, today);

                        if (outOfRange) {
                          return (
                            <div key={`cell-${m.label}-${day}`} className="relative aspect-square w-full rounded-[4px] border bg-white/60">
                              <div
                                aria-hidden
                                className="absolute inset-0 pointer-events-none"
                                style={{
                                  backgroundImage:
                                    "linear-gradient(45deg, transparent calc(50% - 1px), #94a3b8 calc(50% - 1px), #94a3b8 calc(50% + 1px), transparent calc(50% + 1px)), linear-gradient(-45deg, transparent calc(50% - 1px), #94a3b8 calc(50% - 1px), #94a3b8 calc(50% + 1px), transparent calc(50% + 1px))",
                                  backgroundRepeat: "no-repeat, no-repeat",
                                  backgroundSize: "100% 100%, 100% 100%",
                                  opacity: 0.6,
                                }}
                              />
                            </div>
                          );
                        }

                        return (
                          <Tooltip key={`cell-${m.label}-${day}`}>
                            <TooltipTrigger asChild>
                              <div
                                className={cn(
                                  "relative aspect-square w-full rounded-[4px] border flex items-center justify-center text-[10px] select-none transition-shadow",
                                  achieved
                                    ? "bg-gradient-to-br from-slate-900 to-slate-800 border-slate-700 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
                                    : "bg-white border-slate-200 text-foreground hover:shadow-sm",
                                  isTodayFlag && "ring-1 ring-orange-400"
                                )}
                              >
                                {achieved && (
                                  <div
                                    aria-hidden
                                    className="absolute inset-0 pointer-events-none"
                                    style={{
                                      backgroundImage:
                                        "linear-gradient(45deg, transparent calc(50% - 1px), #ef4444 calc(50% - 1px), #ef4444 calc(50% + 1px), transparent calc(50% + 1px)), linear-gradient(-45deg, transparent calc(50% - 1px), #ef4444 calc(50% - 1px), #ef4444 calc(50% + 1px), transparent calc(50% + 1px))",
                                      backgroundRepeat: "no-repeat, no-repeat",
                                      backgroundSize: "100% 100%, 100% 100%",
                                    }}
                                  />
                                )}
                                <span
                                  className={cn(
                                    "relative z-[1] font-semibold",
                                    achieved ? "text-white line-through decoration-red-500 decoration-2" : ""
                                  )}
                                >
                                  {day}
                                </span>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="text-xs">
                              <div className="flex items-center gap-2">
                                {achieved ? (
                                  <span className="inline-flex items-center gap-1 text-green-600"><Sparkles className="h-3 w-3" /> Achieved • Keep going!</span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-red-600">Lost</span>
                                )}
                                <span>{format(date, "EEE, MMM d, yyyy")}</span>
                                <span>
                                  {summary ? formatSeconds(summary.totalSeconds) : "—"} / {formatSeconds(DAILY_TARGET_SECONDS)}
                                </span>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );

  return (
    <ResponsiveLayout
      sidebar={renderSidebar()}
      main={renderMain()}
      detail={<div />}
      isDetailOpen={false}
    />
  );
}

function formatSeconds(total: number) {
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  return `${hours}h ${minutes}m`;
}


