import React, { useState } from 'react';
import { AlertTriangle, Clock, Play, Pause, ArrowRight, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useTaskTimer, useTimerActions } from '@/hooks/use-timer-state';
import { cn } from '@/lib/utils';

interface TimerSwitchConfirmationProps {
  fromTaskId: string;
  toTaskId: string;
  toTaskTitle?: string;
  onConfirm: () => void;
  onCancel: () => void;
  className?: string;
}

export function TimerSwitchConfirmation({
  fromTaskId,
  toTaskId,
  toTaskTitle,
  onConfirm,
  onCancel,
  className,
}: TimerSwitchConfirmationProps) {
  const [isConfirming, setIsConfirming] = useState(false);
  const fromTaskTimer = useTaskTimer(fromTaskId);
  const toTaskTimer = useTaskTimer(toTaskId);
  const { confirmTimerSwitch } = useTimerActions();

  const handleConfirm = async () => {
    setIsConfirming(true);
    try {
      await confirmTimerSwitch(toTaskId);
      onConfirm();
    } catch (error) {
      console.error('Failed to switch timer:', error);
    } finally {
      setIsConfirming(false);
    }
  };

  return (
    <Card className={cn("border-amber-200 bg-amber-50", className)}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-amber-800">
          <AlertTriangle className="w-5 h-5" />
          Switch Timer Confirmation
          <Button
            variant="ghost"
            size="sm"
            onClick={onCancel}
            className="ml-auto h-6 w-6 p-0 text-amber-600 hover:text-amber-800"
          >
            <X className="w-4 h-4" />
          </Button>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        <p className="text-sm text-amber-700">
          You have an active timer running. Switching will stop the current timer and start a new one for the selected task.
        </p>

        {/* Current Timer */}
        <div className="bg-white rounded-lg border border-amber-200 p-3">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-sm font-medium text-gray-700">
              Current Timer
            </span>
          </div>
          
          <div className="space-y-1">
            <div className="text-sm font-medium text-gray-900">
              Task: {fromTaskId}
            </div>
            <div className="flex items-center gap-4 text-xs text-gray-600">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Current: {fromTaskTimer.formattedCurrentSession}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Today: {fromTaskTimer.formattedTotalTime}
              </span>
            </div>
          </div>
        </div>

        {/* Arrow */}
        <div className="flex justify-center">
          <div className="bg-white rounded-full p-2 border border-amber-200">
            <ArrowRight className="w-4 h-4 text-amber-600" />
          </div>
        </div>

        {/* New Timer */}
        <div className="bg-white rounded-lg border border-green-200 p-3">
          <div className="flex items-center gap-2 mb-2">
            <Play className="w-4 h-4 text-green-600" />
            <span className="text-sm font-medium text-gray-700">
              New Timer
            </span>
          </div>
          
          <div className="space-y-1">
            <div className="text-sm font-medium text-gray-900">
              Task: {toTaskTitle || toTaskId}
            </div>
            {toTaskTimer.totalTimeSeconds > 0 && (
              <div className="text-xs text-gray-600">
                Previous time today: {toTaskTimer.formattedTotalTime}
              </div>
            )}
            <div className="text-xs text-green-600 font-medium">
              Timer will start immediately
            </div>
          </div>
        </div>

        {/* Impact Summary */}
        <div className="bg-blue-50 rounded-lg border border-blue-200 p-3">
          <div className="text-xs font-medium text-blue-800 mb-1">
            What will happen:
          </div>
          <ul className="text-xs text-blue-700 space-y-1">
            <li>• Current timer will be paused and time saved</li>
            <li>• New timer will start for "{toTaskTitle || toTaskId}"</li>
            <li>• All time tracking data will be preserved</li>
            <li>• You can switch back anytime</li>
          </ul>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 pt-2">
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={isConfirming}
            className="flex-1"
          >
            <Pause className="w-4 h-4 mr-2" />
            Keep Current Timer
          </Button>
          
          <Button
            onClick={handleConfirm}
            disabled={isConfirming}
            className="flex-1 bg-green-600 hover:bg-green-700"
          >
            <Play className="w-4 h-4 mr-2" />
            {isConfirming ? 'Switching...' : 'Switch Timer'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Hook for managing timer switch confirmation state
 */
export function useTimerSwitchConfirmation() {
  const [confirmationState, setConfirmationState] = useState<{
    isOpen: boolean;
    fromTaskId: string;
    toTaskId: string;
    toTaskTitle?: string;
  } | null>(null);

  const showConfirmation = (fromTaskId: string, toTaskId: string, toTaskTitle?: string) => {
    setConfirmationState({
      isOpen: true,
      fromTaskId,
      toTaskId,
      toTaskTitle,
    });
  };

  const hideConfirmation = () => {
    setConfirmationState(null);
  };

  const handleConfirm = () => {
    hideConfirmation();
  };

  const handleCancel = () => {
    hideConfirmation();
  };

  return {
    confirmationState,
    showConfirmation,
    hideConfirmation,
    handleConfirm,
    handleCancel,
  };
}