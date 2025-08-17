import React, { useState, useEffect } from 'react';
import { Clock, Target, TrendingUp, AlertTriangle, CheckCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { DurationPicker } from './duration-picker';
import { useTimerProgress } from '@/hooks/use-timer-state';
// Legacy TimerApiClient removed; use direct fetches
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface TaskEstimationProps {
  taskId: string;
  taskTitle?: string;
  className?: string;
  compact?: boolean;
}

export function TaskEstimation({
  taskId,
  taskTitle,
  className,
  compact = false,
}: TaskEstimationProps) {
  const [estimate, setEstimate] = useState<number | undefined>();
  const [isLoading, setIsLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  
  const apiBase = '';
  const { toast } = useToast();

  const {
    hasEstimate,
    estimatedSeconds,
    progressPercentage,
    isOverEstimate,
    remainingSeconds,
    formattedRemaining,
    formattedEstimate,
  } = useTimerProgress(taskId, estimate);

  // Load existing estimate
  useEffect(() => {
    const loadEstimate = async () => {
      try {
        const res = await fetch(`/api/tasks/${taskId}/estimate`);
        if (res.ok) {
          const data = await res.json();
          const existing = data?.estimate;
          if (existing) setEstimate(existing.estimatedDurationMinutes);
        }
      } catch (error) {
        console.error('Failed to load task estimate:', error);
      }
    };

    loadEstimate();
  }, [taskId]);

  const handleEstimateChange = async (minutes: number) => {
    if (minutes === 0) {
      // Remove estimate
      try {
        setIsLoading(true);
        await fetch(`/api/tasks/${taskId}/estimate`, { method: 'DELETE' });
        setEstimate(undefined);
        setIsEditing(false);
        
        toast({
          title: "Estimate removed",
          description: "Task estimate has been removed",
        });
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to remove estimate",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    } else {
      // Set/update estimate
      try {
        setIsLoading(true);
        await fetch(`/api/tasks/${taskId}/estimate`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ estimatedDurationMinutes: minutes }) });
        setEstimate(minutes);
        setIsEditing(false);
        
        toast({
          title: "Estimate saved",
          description: `Task estimated at ${Math.floor(minutes / 60)}h ${minutes % 60}m`,
        });
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to save estimate",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    }
  };

  if (compact) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        {hasEstimate && (
          <div
            className={cn(
              "flex items-center gap-1 px-2 py-1 rounded text-xs",
              isOverEstimate
                ? "bg-red-100 text-red-800"
                : progressPercentage > 75
                ? "bg-yellow-100 text-yellow-800"
                : "bg-green-100 text-green-800"
            )}
            aria-label={`Estimate progress ${Math.round(progressPercentage)}%`}
          >
            <Target className="w-3 h-3" /> 
            <span>{Math.round(progressPercentage)}%</span>
          </div>
        )}
        <span className='text-xs mx-1'>of</span>
        <DurationPicker
          value={estimate}
          onChange={handleEstimateChange}
          className="w-36"
          disabled={isLoading}
          placeholder={hasEstimate ? undefined : "Add estimate"}
          showEditIconOnHover
        />
      </div>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Target className="w-4 h-4 text-blue-600" />
          Time Estimate
          {taskTitle && (
            <span className="text-sm font-normal text-gray-500 ml-auto">
              {taskTitle}
            </span>
          )}
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {isEditing ? (
          <div className="space-y-3">
            <DurationPicker
              value={estimate}
              onChange={handleEstimateChange}
              disabled={isLoading}
              placeholder="Set estimated duration"
            />
            
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditing(false)}
                disabled={isLoading}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : hasEstimate ? (
          <div className="space-y-4">
            {/* Progress Overview */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Progress</span>
                <span className={cn(
                  "text-sm font-medium",
                  isOverEstimate ? "text-red-600" : "text-gray-600"
                )}>
                  {Math.round(progressPercentage)}%
                </span>
              </div>
              
              <Progress 
                value={Math.min(progressPercentage, 100)} 
                className={cn(
                  "h-2",
                  isOverEstimate && "bg-red-100"
                )}
              />
              
              <div className="flex justify-between text-xs text-gray-600">
                <span>0m</span>
                <span className="font-medium">
                  {formattedEstimate} estimated
                </span>
              </div>
            </div>

            {/* Status */}
            <div className={cn(
              "flex items-center gap-2 p-3 rounded-lg",
              isOverEstimate 
                ? "bg-red-50 border border-red-200" 
                : progressPercentage > 75
                ? "bg-yellow-50 border border-yellow-200"
                : "bg-green-50 border border-green-200"
            )}>
              {isOverEstimate ? (
                <>
                  <AlertTriangle className="w-4 h-4 text-red-600" />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-red-800">
                      Over Estimate
                    </div>
                    <div className="text-xs text-red-600">
                      {Math.abs(remainingSeconds / 60).toFixed(0)} minutes over
                    </div>
                  </div>
                </>
              ) : progressPercentage > 75 ? (
                <>
                  <TrendingUp className="w-4 h-4 text-yellow-600" />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-yellow-800">
                      Nearing Estimate
                    </div>
                    <div className="text-xs text-yellow-600">
                      {formattedRemaining} remaining
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-green-800">
                      On Track
                    </div>
                    <div className="text-xs text-green-600">
                      {formattedRemaining} remaining
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditing(true)}
                disabled={isLoading}
              >
                Edit Estimate
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-center py-6">
            <Clock className="w-8 h-8 mx-auto mb-3 text-gray-300" />
            <p className="text-sm text-gray-600 mb-3">
              No time estimate set for this task
            </p>
            <Button
              onClick={() => setIsEditing(true)}
              disabled={isLoading}
              size="sm"
            >
              <Target className="w-4 h-4 mr-2" />
              Add Estimate
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Simple progress indicator for task lists
 */
export function TaskEstimateIndicator({
  taskId,
  estimatedMinutes,
  className,
}: {
  taskId: string;
  estimatedMinutes?: number;
  className?: string;
}) {
  const {
    hasEstimate,
    progressPercentage,
    isOverEstimate,
  } = useTimerProgress(taskId, estimatedMinutes);

  if (!hasEstimate) {
    return null;
  }

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <div className={cn(
        "w-2 h-2 rounded-full",
        isOverEstimate 
          ? "bg-red-500" 
          : progressPercentage > 75
          ? "bg-yellow-500"
          : "bg-green-500"
      )} />
      <span className="text-xs text-gray-600">
        {Math.round(progressPercentage)}%
      </span>
    </div>
  );
}