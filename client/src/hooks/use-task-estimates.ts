import { useState, useEffect, useCallback } from 'react';
// Legacy TimerApiClient removed; use direct fetches
import { useToast } from './use-toast';

interface TaskEstimate {
  id: string;
  taskId: string;
  estimatedDurationMinutes: number;
  createdAt: Date;
}

interface UseTaskEstimatesReturn {
  estimates: Map<string, TaskEstimate>;
  isLoading: boolean;
  error: string | null;
  getEstimate: (taskId: string) => TaskEstimate | undefined;
  setEstimate: (taskId: string, minutes: number) => Promise<boolean>;
  removeEstimate: (taskId: string) => Promise<boolean>;
  refreshEstimate: (taskId: string) => Promise<void>;
  refreshAllEstimates: () => Promise<void>;
}

/**
 * Hook for managing task time estimates
 */
export function useTaskEstimates(taskIds?: string[]): UseTaskEstimatesReturn {
  const [estimates, setEstimates] = useState<Map<string, TaskEstimate>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  
  const { toast } = useToast();

  /**
   * Load estimates for specific tasks
   */
  const loadEstimates = useCallback(async (taskIdsToLoad: string[]) => {
    if (taskIdsToLoad.length === 0) return;

    setIsLoading(true);
    setError(null);

    try {
      const estimatePromises = taskIdsToLoad.map(async (taskId) => {
        try {
          const res = await fetch(`/api/tasks/${taskId}/estimate`);
          if (!res.ok) throw new Error('Failed');
          const data = await res.json();
          return { taskId, estimate: data?.estimate as any };
        } catch (error) {
          console.warn(`Failed to load estimate for task ${taskId}:`, error);
          return { taskId, estimate: null };
        }
      });

      const results = await Promise.all(estimatePromises);
      
      setEstimates(prev => {
        const newEstimates = new Map(prev);
        results.forEach(({ taskId, estimate }) => {
          if (estimate) {
            newEstimates.set(taskId, estimate);
          } else {
            newEstimates.delete(taskId);
          }
        });
        return newEstimates;
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load estimates';
      setError(errorMessage);
      console.error('Failed to load task estimates:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Load estimates on mount and when taskIds change
   */
  useEffect(() => {
    if (taskIds && taskIds.length > 0) {
      loadEstimates(taskIds);
    }
  }, [taskIds, loadEstimates]);

  /**
   * Get estimate for a specific task
   */
  const getEstimate = useCallback((taskId: string): TaskEstimate | undefined => {
    return estimates.get(taskId);
  }, [estimates]);

  /**
   * Set or update estimate for a task
   */
  const setEstimate = useCallback(async (taskId: string, minutes: number): Promise<boolean> => {
    try {
      setError(null);
      const res = await fetch(`/api/tasks/${taskId}/estimate`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ estimatedDurationMinutes: minutes }) });
      if (!res.ok) throw new Error('Failed to save estimate');
      const estimate = (await res.json()) as any;
      
      setEstimates(prev => {
        const newEstimates = new Map(prev);
        newEstimates.set(taskId, estimate);
        return newEstimates;
      });

      toast({
        title: "Estimate saved",
        description: `Task estimated at ${Math.floor(minutes / 60)}h ${minutes % 60}m`,
      });

      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to save estimate';
      setError(errorMessage);
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });

      return false;
    }
  }, [toast]);

  /**
   * Remove estimate for a task
   */
  const removeEstimate = useCallback(async (taskId: string): Promise<boolean> => {
    try {
      setError(null);
      await fetch(`/api/tasks/${taskId}/estimate`, { method: 'DELETE' });
      
      setEstimates(prev => {
        const newEstimates = new Map(prev);
        newEstimates.delete(taskId);
        return newEstimates;
      });

      toast({
        title: "Estimate removed",
        description: "Task estimate has been removed",
      });

      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to remove estimate';
      setError(errorMessage);
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });

      return false;
    }
  }, [toast]);

  /**
   * Refresh estimate for a specific task
   */
  const refreshEstimate = useCallback(async (taskId: string): Promise<void> => {
    await loadEstimates([taskId]);
  }, [loadEstimates]);

  /**
   * Refresh all loaded estimates
   */
  const refreshAllEstimates = useCallback(async (): Promise<void> => {
    const taskIdsToRefresh = Array.from(estimates.keys());
    if (taskIdsToRefresh.length > 0) {
      await loadEstimates(taskIdsToRefresh);
    }
  }, [estimates, loadEstimates]);

  return {
    estimates,
    isLoading,
    error,
    getEstimate,
    setEstimate,
    removeEstimate,
    refreshEstimate,
    refreshAllEstimates,
  };
}

/**
 * Hook for managing a single task estimate
 */
export function useTaskEstimate(taskId: string) {
  const [estimate, setEstimateState] = useState<TaskEstimate | undefined>();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  
  const { toast } = useToast();

  /**
   * Load estimate for the task
   */
  const loadEstimate = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/tasks/${taskId}/estimate`);
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      const estimate = data?.estimate as any;
      setEstimateState(estimate || undefined);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load estimate';
      setError(errorMessage);
      console.error('Failed to load task estimate:', error);
    } finally {
      setIsLoading(false);
    }
  }, [taskId]);

  /**
   * Load estimate on mount and when taskId changes
   */
  useEffect(() => {
    if (taskId) {
      loadEstimate();
    }
  }, [taskId, loadEstimate]);

  /**
   * Set or update estimate
   */
  const setEstimate = useCallback(async (minutes: number): Promise<boolean> => {
    try {
      setError(null);
      const res = await fetch(`/api/tasks/${taskId}/estimate`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ estimatedDurationMinutes: minutes }) });
      if (!res.ok) throw new Error('Failed');
      const newEstimate = await res.json();
      setEstimateState(newEstimate);

      toast({
        title: "Estimate saved",
        description: `Task estimated at ${Math.floor(minutes / 60)}h ${minutes % 60}m`,
      });

      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to save estimate';
      setError(errorMessage);
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });

      return false;
    }
  }, [taskId, toast]);

  /**
   * Remove estimate
   */
  const removeEstimate = useCallback(async (): Promise<boolean> => {
    try {
      setError(null);
      await fetch(`/api/tasks/${taskId}/estimate`, { method: 'DELETE' });
      setEstimateState(undefined);

      toast({
        title: "Estimate removed",
        description: "Task estimate has been removed",
      });

      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to remove estimate';
      setError(errorMessage);
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });

      return false;
    }
  }, [taskId, toast]);

  /**
   * Refresh estimate
   */
  const refreshEstimate = useCallback(async (): Promise<void> => {
    await loadEstimate();
  }, [loadEstimate]);

  return {
    estimate,
    isLoading,
    error,
    setEstimate,
    removeEstimate,
    refreshEstimate,
    hasEstimate: !!estimate,
    estimatedMinutes: estimate?.estimatedDurationMinutes,
  };
}

/**
 * Hook for estimate statistics and analytics
 */
export function useEstimateAnalytics(taskIds: string[]) {
  const { estimates } = useTaskEstimates(taskIds);
  
  const stats = {
    totalTasks: taskIds.length,
    estimatedTasks: estimates.size,
    estimationRate: estimates.size / Math.max(taskIds.length, 1) * 100,
    totalEstimatedMinutes: Array.from(estimates.values())
      .reduce((sum, est) => sum + est.estimatedDurationMinutes, 0),
    averageEstimate: estimates.size > 0 
      ? Array.from(estimates.values())
          .reduce((sum, est) => sum + est.estimatedDurationMinutes, 0) / estimates.size
      : 0,
  };

  const formatTotalEstimate = () => {
    const hours = Math.floor(stats.totalEstimatedMinutes / 60);
    const minutes = stats.totalEstimatedMinutes % 60;
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  };

  return {
    ...stats,
    formatTotalEstimate,
    estimates: Array.from(estimates.values()),
  };
}