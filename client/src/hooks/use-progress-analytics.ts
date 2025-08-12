import { useState, useEffect, useMemo } from 'react';
import { useDailyTimerStats } from './use-timer-state';
// Legacy TimerApiClient removed; use direct fetches or TimerStore if needed

interface DayProgress {
  date: string;
  totalSeconds: number;
  targetSeconds: number;
  progressPercentage: number;
  isOverTarget: boolean;
  taskCount: number;
  sessionCount: number;
}

interface WeekProgress {
  weekStart: Date;
  weekEnd: Date;
  days: DayProgress[];
  totalSeconds: number;
  averageDaily: number;
  targetHit: number; // Number of days target was hit
  bestDay: DayProgress | null;
  worstDay: DayProgress | null;
}

interface ProgressTrend {
  direction: 'up' | 'down' | 'stable';
  percentage: number;
  description: string;
}

/**
 * Hook for analyzing daily progress patterns
 */
export function useProgressAnalytics(days: number = 7) {
  const [historicalData, setHistoricalData] = useState<DayProgress[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  

  // Load historical data
  useEffect(() => {
    const loadHistoricalData = async () => {
      setIsLoading(true);
      try {
        const data: DayProgress[] = [];
        const targetSeconds = 8 * 60 * 60; // 8 hours

        for (let i = days - 1; i >= 0; i--) {
          const date = new Date();
          date.setDate(date.getDate() - i);
          
          try {
            const params = new URLSearchParams({ date: date.toISOString().split('T')[0] });
            const res = await fetch(`/api/timers/daily?${params}`);
            const summary = res.ok ? await res.json() : { totalSeconds: 0, taskBreakdown: [] };
            data.push({
              date: date.toISOString().split('T')[0],
              totalSeconds: summary.totalSeconds,
              targetSeconds,
              progressPercentage: (summary.totalSeconds / targetSeconds) * 100,
              isOverTarget: summary.totalSeconds > targetSeconds,
              taskCount: summary.taskBreakdown.length,
              sessionCount: summary.taskBreakdown.reduce((sum: number, task: any) => sum + (task.sessionCount || 0), 0),
            });
          } catch (error) {
            // If no data for a day, add empty entry
            data.push({
              date: date.toISOString().split('T')[0],
              totalSeconds: 0,
              targetSeconds,
              progressPercentage: 0,
              isOverTarget: false,
              taskCount: 0,
              sessionCount: 0,
            });
          }
        }

        setHistoricalData(data);
      } catch (error) {
        console.error('Failed to load historical data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadHistoricalData();
  }, [days]);

  // Calculate analytics
  const analytics = useMemo(() => {
    if (historicalData.length === 0) {
      return {
        averageDaily: 0,
        totalTime: 0,
        targetHitRate: 0,
        bestDay: null,
        worstDay: null,
        trend: { direction: 'stable' as const, percentage: 0, description: 'No data available' },
        consistency: 0,
        productivity: 'low' as const,
      };
    }

    const totalTime = historicalData.reduce((sum, day) => sum + day.totalSeconds, 0);
    const averageDaily = totalTime / historicalData.length;
    const targetHits = historicalData.filter(day => day.isOverTarget).length;
    const targetHitRate = (targetHits / historicalData.length) * 100;

    const bestDay = historicalData.reduce((best, day) => 
      day.totalSeconds > (best?.totalSeconds || 0) ? day : best, null as DayProgress | null);
    
    const worstDay = historicalData.reduce((worst, day) => 
      day.totalSeconds < (worst?.totalSeconds || Infinity) ? day : worst, null as DayProgress | null);

    // Calculate trend (comparing first half vs second half)
    const midPoint = Math.floor(historicalData.length / 2);
    const firstHalf = historicalData.slice(0, midPoint);
    const secondHalf = historicalData.slice(midPoint);
    
    const firstHalfAvg = firstHalf.reduce((sum, day) => sum + day.totalSeconds, 0) / firstHalf.length;
    const secondHalfAvg = secondHalf.reduce((sum, day) => sum + day.totalSeconds, 0) / secondHalf.length;
    
    const trendPercentage = firstHalfAvg > 0 ? ((secondHalfAvg - firstHalfAvg) / firstHalfAvg) * 100 : 0;
    
    const trend: ProgressTrend = {
      direction: Math.abs(trendPercentage) < 5 ? 'stable' : trendPercentage > 0 ? 'up' : 'down',
      percentage: Math.abs(trendPercentage),
      description: Math.abs(trendPercentage) < 5 
        ? 'Consistent performance'
        : trendPercentage > 0 
        ? `Improving by ${Math.round(trendPercentage)}%`
        : `Declining by ${Math.round(Math.abs(trendPercentage))}%`
    };

    // Calculate consistency (lower standard deviation = higher consistency)
    const variance = historicalData.reduce((sum, day) => 
      sum + Math.pow(day.totalSeconds - averageDaily, 2), 0) / historicalData.length;
    const standardDeviation = Math.sqrt(variance);
    const consistency = Math.max(0, 100 - (standardDeviation / averageDaily) * 100);

    // Determine productivity level
    const productivity = averageDaily >= 8 * 60 * 60 ? 'high' : 
                        averageDaily >= 6 * 60 * 60 ? 'medium' : 'low';

    return {
      averageDaily,
      totalTime,
      targetHitRate,
      bestDay,
      worstDay,
      trend,
      consistency: Math.round(consistency),
      productivity,
    };
  }, [historicalData]);

  // Get week-by-week breakdown
  const weeklyBreakdown = useMemo(() => {
    const weeks: WeekProgress[] = [];
    const weeksToShow = Math.ceil(days / 7);

    for (let w = 0; w < weeksToShow; w++) {
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - (w * 7) - 6);
      const weekEnd = new Date();
      weekEnd.setDate(weekEnd.getDate() - (w * 7));

      const weekDays = historicalData.filter(day => {
        const dayDate = new Date(day.date);
        return dayDate >= weekStart && dayDate <= weekEnd;
      });

      if (weekDays.length > 0) {
        const totalSeconds = weekDays.reduce((sum, day) => sum + day.totalSeconds, 0);
        const targetHit = weekDays.filter(day => day.isOverTarget).length;
        const bestDay = weekDays.reduce((best, day) => 
          day.totalSeconds > (best?.totalSeconds || 0) ? day : best, null as DayProgress | null);
        const worstDay = weekDays.reduce((worst, day) => 
          day.totalSeconds < (worst?.totalSeconds || Infinity) ? day : worst, null as DayProgress | null);

        weeks.push({
          weekStart,
          weekEnd,
          days: weekDays,
          totalSeconds,
          averageDaily: totalSeconds / weekDays.length,
          targetHit,
          bestDay,
          worstDay,
        });
      }
    }

    return weeks.reverse(); // Most recent first
  }, [historicalData, days]);

  return {
    historicalData,
    analytics,
    weeklyBreakdown,
    isLoading,
  };
}

/**
 * Hook for real-time progress tracking
 */
export function useRealTimeProgress() {
  const todayStats = useDailyTimerStats();
  const [milestones, setMilestones] = useState<Array<{
    id: string;
    threshold: number;
    label: string;
    achieved: boolean;
    achievedAt?: Date;
  }>>([
    { id: '2h', threshold: 2 * 60 * 60, label: '2 hours', achieved: false },
    { id: '4h', threshold: 4 * 60 * 60, label: '4 hours', achieved: false },
    { id: '6h', threshold: 6 * 60 * 60, label: '6 hours', achieved: false },
    { id: '8h', threshold: 8 * 60 * 60, label: '8 hours (Target!)', achieved: false },
    { id: '10h', threshold: 10 * 60 * 60, label: '10 hours', achieved: false },
  ]);

  // Update milestones based on current progress
  useEffect(() => {
    setMilestones(prev => prev.map(milestone => ({
      ...milestone,
      achieved: todayStats.totalSeconds >= milestone.threshold,
      achievedAt: todayStats.totalSeconds >= milestone.threshold && !milestone.achieved 
        ? new Date() 
        : milestone.achievedAt,
    })));
  }, [todayStats.totalSeconds]);

  const nextMilestone = milestones.find(m => !m.achieved);
  const lastAchievedMilestone = milestones.filter(m => m.achieved).pop();

  const getMotivationalMessage = () => {
    const { totalSeconds, progressPercentage, isOverTarget } = todayStats;

    if (isOverTarget) {
      return "🎉 Fantastic! You've exceeded your daily target!";
    } else if (progressPercentage >= 90) {
      return "🔥 So close! Just a little more to reach your goal!";
    } else if (progressPercentage >= 75) {
      return "💪 Great progress! You're in the home stretch!";
    } else if (progressPercentage >= 50) {
      return "⚡ Halfway there! Keep up the momentum!";
    } else if (progressPercentage >= 25) {
      return "🚀 Good start! You're building momentum!";
    } else if (totalSeconds > 0) {
      return "✨ Every minute counts! Keep going!";
    } else {
      return "🌟 Ready to start your productive day?";
    }
  };

  return {
    ...todayStats,
    milestones,
    nextMilestone,
    lastAchievedMilestone,
    motivationalMessage: getMotivationalMessage(),
  };
}

/**
 * Hook for productivity insights
 */
export function useProductivityInsights() {
  const { analytics, historicalData } = useProgressAnalytics(30); // 30 days
  
  const insights = useMemo(() => {
    if (historicalData.length === 0) return [];

    const insights: Array<{
      type: 'positive' | 'negative' | 'neutral';
      title: string;
      description: string;
      action?: string;
    }> = [];

    // Consistency insight
    if (analytics.consistency > 80) {
      insights.push({
        type: 'positive',
        title: 'Excellent Consistency',
        description: `You've maintained consistent work patterns with ${analytics.consistency}% consistency.`,
      });
    } else if (analytics.consistency < 50) {
      insights.push({
        type: 'negative',
        title: 'Inconsistent Schedule',
        description: 'Your work hours vary significantly day to day.',
        action: 'Try setting a regular work schedule to improve consistency.',
      });
    }

    // Target achievement insight
    if (analytics.targetHitRate > 70) {
      insights.push({
        type: 'positive',
        title: 'Target Achiever',
        description: `You've hit your daily target ${Math.round(analytics.targetHitRate)}% of the time.`,
      });
    } else if (analytics.targetHitRate < 30) {
      insights.push({
        type: 'negative',
        title: 'Target Challenges',
        description: 'You\'re missing your daily targets frequently.',
        action: 'Consider adjusting your target or improving time management.',
      });
    }

    // Trend insight
    if (analytics.trend.direction === 'up' && analytics.trend.percentage > 10) {
      insights.push({
        type: 'positive',
        title: 'Improving Trend',
        description: analytics.trend.description,
      });
    } else if (analytics.trend.direction === 'down' && analytics.trend.percentage > 10) {
      insights.push({
        type: 'negative',
        title: 'Declining Trend',
        description: analytics.trend.description,
        action: 'Consider what might be affecting your productivity recently.',
      });
    }

    // Best day insight
    if (analytics.bestDay && analytics.bestDay.totalSeconds > 10 * 60 * 60) {
      const bestDayDate = new Date(analytics.bestDay.date);
      const dayName = bestDayDate.toLocaleDateString('en-US', { weekday: 'long' });
      insights.push({
        type: 'positive',
        title: 'Peak Performance Day',
        description: `Your best day was ${dayName} with ${Math.floor(analytics.bestDay.totalSeconds / 3600)} hours logged.`,
      });
    }

    return insights;
  }, [analytics, historicalData]);

  return {
    insights,
    analytics,
  };
}