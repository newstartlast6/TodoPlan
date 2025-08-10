import React from 'react';
import { TrendingUp, TrendingDown, Minus, Lightbulb, CheckCircle, AlertCircle, Info } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useProductivityInsights, useProgressAnalytics } from '@/hooks/use-progress-analytics';
import { cn } from '@/lib/utils';

interface ProgressInsightsProps {
  className?: string;
  days?: number;
}

export function ProgressInsights({ className, days = 7 }: ProgressInsightsProps) {
  const { insights, analytics } = useProductivityInsights();
  const { weeklyBreakdown } = useProgressAnalytics(days);

  const getTrendIcon = (direction: string) => {
    switch (direction) {
      case 'up':
        return <TrendingUp className="w-4 h-4 text-green-600" />;
      case 'down':
        return <TrendingDown className="w-4 h-4 text-red-600" />;
      default:
        return <Minus className="w-4 h-4 text-gray-600" />;
    }
  };

  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'positive':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'negative':
        return <AlertCircle className="w-4 h-4 text-red-600" />;
      default:
        return <Info className="w-4 h-4 text-blue-600" />;
    }
  };

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  return (
    <div className={cn("space-y-6", className)}>
      {/* Analytics Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-blue-600" />
            Performance Analytics
          </CardTitle>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Key Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <div className="text-lg font-bold text-blue-900">
                {formatTime(analytics.averageDaily)}
              </div>
              <div className="text-xs text-blue-700">Daily Average</div>
            </div>
            
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <div className="text-lg font-bold text-green-900">
                {Math.round(analytics.targetHitRate)}%
              </div>
              <div className="text-xs text-green-700">Target Hit Rate</div>
            </div>
            
            <div className="text-center p-3 bg-purple-50 rounded-lg">
              <div className="text-lg font-bold text-purple-900">
                {analytics.consistency}%
              </div>
              <div className="text-xs text-purple-700">Consistency</div>
            </div>
            
            <div className="text-center p-3 bg-orange-50 rounded-lg">
              <div className="flex items-center justify-center gap-1">
                {getTrendIcon(analytics.trend.direction)}
                <span className="text-lg font-bold text-orange-900">
                  {Math.round(analytics.trend.percentage)}%
                </span>
              </div>
              <div className="text-xs text-orange-700">Trend</div>
            </div>
          </div>

          {/* Trend Description */}
          <div className={cn(
            "flex items-center gap-3 p-3 rounded-lg",
            analytics.trend.direction === 'up' ? "bg-green-50 border border-green-200" :
            analytics.trend.direction === 'down' ? "bg-red-50 border border-red-200" :
            "bg-gray-50 border border-gray-200"
          )}>
            {getTrendIcon(analytics.trend.direction)}
            <span className="text-sm font-medium">
              {analytics.trend.description}
            </span>
          </div>

          {/* Best/Worst Days */}
          {(analytics.bestDay || analytics.worstDay) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {analytics.bestDay && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <div className="text-sm font-medium text-green-800 mb-1">
                    Best Day
                  </div>
                  <div className="text-xs text-green-700">
                    {new Date(analytics.bestDay.date).toLocaleDateString('en-US', { 
                      weekday: 'long', 
                      month: 'short', 
                      day: 'numeric' 
                    })}
                  </div>
                  <div className="text-sm font-bold text-green-900">
                    {formatTime(analytics.bestDay.totalSeconds)}
                  </div>
                </div>
              )}
              
              {analytics.worstDay && analytics.worstDay.totalSeconds > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <div className="text-sm font-medium text-red-800 mb-1">
                    Lowest Day
                  </div>
                  <div className="text-xs text-red-700">
                    {new Date(analytics.worstDay.date).toLocaleDateString('en-US', { 
                      weekday: 'long', 
                      month: 'short', 
                      day: 'numeric' 
                    })}
                  </div>
                  <div className="text-sm font-bold text-red-900">
                    {formatTime(analytics.worstDay.totalSeconds)}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Insights */}
      {insights.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-yellow-600" />
              Productivity Insights
            </CardTitle>
          </CardHeader>
          
          <CardContent className="space-y-3">
            {insights.map((insight, index) => (
              <div
                key={index}
                className={cn(
                  "flex items-start gap-3 p-3 rounded-lg border",
                  insight.type === 'positive' ? "bg-green-50 border-green-200" :
                  insight.type === 'negative' ? "bg-red-50 border-red-200" :
                  "bg-blue-50 border-blue-200"
                )}
              >
                {getInsightIcon(insight.type)}
                <div className="flex-1">
                  <div className={cn(
                    "font-medium text-sm",
                    insight.type === 'positive' ? "text-green-800" :
                    insight.type === 'negative' ? "text-red-800" :
                    "text-blue-800"
                  )}>
                    {insight.title}
                  </div>
                  <div className={cn(
                    "text-xs mt-1",
                    insight.type === 'positive' ? "text-green-700" :
                    insight.type === 'negative' ? "text-red-700" :
                    "text-blue-700"
                  )}>
                    {insight.description}
                  </div>
                  {insight.action && (
                    <div className="text-xs mt-2 font-medium text-gray-800">
                      💡 {insight.action}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Weekly Breakdown */}
      {weeklyBreakdown.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Weekly Breakdown</CardTitle>
          </CardHeader>
          
          <CardContent className="space-y-4">
            {weeklyBreakdown.map((week, index) => (
              <div key={index} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">
                    {week.weekStart.toLocaleDateString('en-US', { 
                      month: 'short', 
                      day: 'numeric' 
                    })} - {week.weekEnd.toLocaleDateString('en-US', { 
                      month: 'short', 
                      day: 'numeric' 
                    })}
                  </span>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">
                      {week.targetHit}/{week.days.length} targets
                    </Badge>
                    <span className="text-sm font-mono">
                      {formatTime(week.totalSeconds)}
                    </span>
                  </div>
                </div>
                
                <div className="grid grid-cols-7 gap-1">
                  {week.days.map((day, dayIndex) => (
                    <div
                      key={dayIndex}
                      className={cn(
                        "h-8 rounded text-xs flex items-center justify-center font-mono",
                        day.isOverTarget ? "bg-green-100 text-green-800" :
                        day.progressPercentage > 50 ? "bg-blue-100 text-blue-800" :
                        day.totalSeconds > 0 ? "bg-yellow-100 text-yellow-800" :
                        "bg-gray-100 text-gray-500"
                      )}
                      title={`${new Date(day.date).toLocaleDateString()}: ${formatTime(day.totalSeconds)}`}
                    >
                      {Math.floor(day.totalSeconds / 3600)}h
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}