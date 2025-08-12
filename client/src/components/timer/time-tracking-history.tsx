import React, { useState, useMemo } from 'react';
import { 
  Calendar, 
  Clock, 
  Download, 
  Filter, 
  Search, 
  TrendingUp,
  BarChart3,
  PieChart,
  List,
  Grid3X3
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { useProgressAnalytics } from '@/hooks/use-progress-analytics';
import { TimerCalculator } from '@shared/services/timer-store';
import { cn } from '@/lib/utils';

interface TimeEntry {
  id: string;
  taskId: string;
  taskTitle: string;
  date: Date;
  startTime: Date;
  endTime: Date;
  duration: number; // seconds
  sessionCount: number;
}

interface TimeTrackingHistoryProps {
  className?: string;
  initialDateRange?: { start: Date; end: Date };
}

export function TimeTrackingHistory({ 
  className,
  initialDateRange 
}: TimeTrackingHistoryProps) {
  const [dateRange, setDateRange] = useState(
    initialDateRange || {
      start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
      end: new Date(),
    }
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [filterBy, setFilterBy] = useState<'all' | 'completed' | 'in-progress'>('all');
  const [sortBy, setSortBy] = useState<'date' | 'duration' | 'task'>('date');
  const [viewMode, setViewMode] = useState<'list' | 'grid' | 'chart'>('list');

  const { historicalData, analytics, weeklyBreakdown } = useProgressAnalytics(30);

  // Mock time entries - in real implementation, this would come from API
  const mockTimeEntries: TimeEntry[] = useMemo(() => {
    const entries: TimeEntry[] = [];
    const tasks = ['Design Review', 'Code Implementation', 'Testing', 'Documentation', 'Meetings'];
    
    for (let i = 0; i < 50; i++) {
      const date = new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000);
      const duration = Math.floor(Math.random() * 4 * 60 * 60); // 0-4 hours
      const taskTitle = tasks[Math.floor(Math.random() * tasks.length)];
      
      entries.push({
        id: `entry-${i}`,
        taskId: `task-${i}`,
        taskTitle,
        date,
        startTime: new Date(date.getTime() + 9 * 60 * 60 * 1000), // 9 AM
        endTime: new Date(date.getTime() + 9 * 60 * 60 * 1000 + duration * 1000),
        duration,
        sessionCount: Math.floor(Math.random() * 3) + 1,
      });
    }
    
    return entries.sort((a, b) => b.date.getTime() - a.date.getTime());
  }, []);

  // Filter and search entries
  const filteredEntries = useMemo(() => {
    return mockTimeEntries.filter(entry => {
      // Date range filter
      if (entry.date < dateRange.start || entry.date > dateRange.end) {
        return false;
      }
      
      // Search filter
      if (searchQuery && !entry.taskTitle.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      
      return true;
    });
  }, [mockTimeEntries, dateRange, searchQuery, filterBy]);

  // Sort entries
  const sortedEntries = useMemo(() => {
    return [...filteredEntries].sort((a, b) => {
      switch (sortBy) {
        case 'date':
          return b.date.getTime() - a.date.getTime();
        case 'duration':
          return b.duration - a.duration;
        case 'task':
          return a.taskTitle.localeCompare(b.taskTitle);
        default:
          return 0;
      }
    });
  }, [filteredEntries, sortBy]);

  // Calculate summary statistics
  const summaryStats = useMemo(() => {
    const totalDuration = filteredEntries.reduce((sum, entry) => sum + entry.duration, 0);
    const totalSessions = filteredEntries.reduce((sum, entry) => sum + entry.sessionCount, 0);
    const uniqueTasks = new Set(filteredEntries.map(entry => entry.taskId)).size;
    const averageSessionDuration = totalSessions > 0 ? totalDuration / totalSessions : 0;
    
    return {
      totalDuration,
      totalSessions,
      uniqueTasks,
      averageSessionDuration,
      totalEntries: filteredEntries.length,
    };
  }, [filteredEntries]);

  const handleExport = () => {
    const csvContent = [
      ['Date', 'Task', 'Start Time', 'End Time', 'Duration', 'Sessions'].join(','),
      ...sortedEntries.map(entry => [
        entry.date.toLocaleDateString(),
        `"${entry.taskTitle}"`,
        entry.startTime.toLocaleTimeString(),
        entry.endTime.toLocaleTimeString(),
        TimerCalculator.formatDuration(entry.duration),
        entry.sessionCount.toString(),
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `time-tracking-${dateRange.start.toISOString().split('T')[0]}-to-${dateRange.end.toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Time Tracking History</h2>
          <p className="text-gray-600">View and analyze your time tracking data</p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            className="flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-blue-600">
              {TimerCalculator.formatDuration(summaryStats.totalDuration)}
            </div>
            <div className="text-sm text-gray-600">Total Time</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-600">
              {summaryStats.totalSessions}
            </div>
            <div className="text-sm text-gray-600">Sessions</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-purple-600">
              {summaryStats.uniqueTasks}
            </div>
            <div className="text-sm text-gray-600">Unique Tasks</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-orange-600">
              {TimerCalculator.formatDuration(summaryStats.averageSessionDuration)}
            </div>
            <div className="text-sm text-gray-600">Avg Session</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Controls */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            {/* Search */}
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Search tasks..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Date Range */}
            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={dateRange.start.toISOString().split('T')[0]}
                onChange={(e) => setDateRange(prev => ({ 
                  ...prev, 
                  start: new Date(e.target.value) 
                }))}
                className="w-40"
              />
              <span className="text-gray-500">to</span>
              <Input
                type="date"
                value={dateRange.end.toISOString().split('T')[0]}
                onChange={(e) => setDateRange(prev => ({ 
                  ...prev, 
                  end: new Date(e.target.value) 
                }))}
                className="w-40"
              />
            </div>

            {/* Sort */}
            <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date">Date</SelectItem>
                <SelectItem value="duration">Duration</SelectItem>
                <SelectItem value="task">Task</SelectItem>
              </SelectContent>
            </Select>

            {/* View Mode */}
            <div className="flex items-center border rounded-lg">
              <Button
                variant={viewMode === 'list' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('list')}
                className="rounded-r-none"
              >
                <List className="w-4 h-4" />
              </Button>
              <Button
                variant={viewMode === 'grid' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('grid')}
                className="rounded-none"
              >
                <Grid3X3 className="w-4 h-4" />
              </Button>
              <Button
                variant={viewMode === 'chart' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('chart')}
                className="rounded-l-none"
              >
                <BarChart3 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Content */}
      <Tabs value={viewMode} onValueChange={(value: any) => setViewMode(value)}>
        {/* List View */}
        <TabsContent value="list">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <List className="w-5 h-5" />
                Time Entries ({sortedEntries.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {sortedEntries.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50"
                  >
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">
                        {entry.taskTitle}
                      </div>
                      <div className="text-sm text-gray-600">
                        {entry.date.toLocaleDateString()} • {entry.startTime.toLocaleTimeString()} - {entry.endTime.toLocaleTimeString()}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4">
                      <Badge variant="secondary" className="text-xs">
                        {entry.sessionCount} sessions
                      </Badge>
                      <div className="text-right">
                        <div className="font-mono font-medium">
                          {TimerCalculator.formatDuration(entry.duration)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                
                {sortedEntries.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <Clock className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                    <p>No time entries found for the selected criteria</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Grid View */}
        <TabsContent value="grid">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sortedEntries.map((entry) => (
              <Card key={entry.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="space-y-3">
                    <div>
                      <div className="font-medium text-gray-900 truncate">
                        {entry.taskTitle}
                      </div>
                      <div className="text-sm text-gray-600">
                        {entry.date.toLocaleDateString()}
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="text-xs">
                        {entry.sessionCount} sessions
                      </Badge>
                      <div className="font-mono font-bold text-blue-600">
                        {TimerCalculator.formatDuration(entry.duration)}
                      </div>
                    </div>
                    
                    <div className="text-xs text-gray-500">
                      {entry.startTime.toLocaleTimeString()} - {entry.endTime.toLocaleTimeString()}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Chart View */}
        <TabsContent value="chart">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Daily Breakdown Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5" />
                  Daily Breakdown
                </CardTitle>
              </CardHeader>
              <CardContent>
                <DailyBreakdownChart entries={sortedEntries} />
              </CardContent>
            </Card>

            {/* Task Distribution Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PieChart className="w-5 h-5" />
                  Task Distribution
                </CardTitle>
              </CardHeader>
              <CardContent>
                <TaskDistributionChart entries={sortedEntries} />
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

/**
 * Daily breakdown chart component
 */
function DailyBreakdownChart({ entries }: { entries: TimeEntry[] }) {
  const dailyData = useMemo(() => {
    const data = new Map<string, number>();
    
    entries.forEach(entry => {
      const dateKey = entry.date.toISOString().split('T')[0];
      data.set(dateKey, (data.get(dateKey) || 0) + entry.duration);
    });
    
    return Array.from(data.entries())
      .map(([date, duration]) => ({ date, duration }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-14); // Last 14 days
  }, [entries]);

  const maxDuration = Math.max(...dailyData.map(d => d.duration), 1);

  return (
    <div className="space-y-4">
      {dailyData.map(({ date, duration }) => (
        <div key={date} className="space-y-1">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">
              {new Date(date).toLocaleDateString('en-US', { 
                month: 'short', 
                day: 'numeric' 
              })}
            </span>
            <span className="font-mono font-medium">
              {TimerCalculator.formatDuration(duration)}
            </span>
          </div>
          <Progress 
            value={(duration / maxDuration) * 100} 
            className="h-2"
          />
        </div>
      ))}
    </div>
  );
}

/**
 * Task distribution chart component
 */
function TaskDistributionChart({ entries }: { entries: TimeEntry[] }) {
  const taskData = useMemo(() => {
    const data = new Map<string, number>();
    
    entries.forEach(entry => {
      data.set(entry.taskTitle, (data.get(entry.taskTitle) || 0) + entry.duration);
    });
    
    const totalDuration = Array.from(data.values()).reduce((sum, duration) => sum + duration, 0);
    
    return Array.from(data.entries())
      .map(([task, duration]) => ({ 
        task, 
        duration, 
        percentage: (duration / totalDuration) * 100 
      }))
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 10); // Top 10 tasks
  }, [entries]);

  const colors = [
    'bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-orange-500', 'bg-red-500',
    'bg-yellow-500', 'bg-pink-500', 'bg-indigo-500', 'bg-teal-500', 'bg-gray-500'
  ];

  return (
    <div className="space-y-3">
      {taskData.map(({ task, duration, percentage }, index) => (
        <div key={task} className="space-y-1">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <div className={cn("w-3 h-3 rounded-full", colors[index % colors.length])} />
              <span className="text-gray-900 truncate">{task}</span>
            </div>
            <span className="font-mono font-medium">
              {TimerCalculator.formatDuration(duration)}
            </span>
          </div>
          <Progress value={percentage} className="h-2" />
          <div className="text-xs text-gray-500 text-right">
            {percentage.toFixed(1)}%
          </div>
        </div>
      ))}
    </div>
  );
}