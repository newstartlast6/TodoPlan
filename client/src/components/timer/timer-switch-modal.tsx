import React from 'react';
import { AlertTriangle, Clock, ArrowRight } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useTaskTimer } from '@/hooks/use-timer-state';
import { useTimerActions } from '@/hooks/use-timer-state';

interface TimerSwitchModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  fromTaskId: string;
  toTaskId: string;
  toTaskTitle?: string;
}

export function TimerSwitchModal({
  isOpen,
  onConfirm,
  onCancel,
  fromTaskId,
  toTaskId,
  toTaskTitle,
}: TimerSwitchModalProps) {
  const fromTaskTimer = useTaskTimer(fromTaskId);
  const { confirmTimerSwitch, cancelTimerSwitch } = useTimerActions();

  const handleConfirm = async () => {
    await confirmTimerSwitch(toTaskId);
    onConfirm();
  };

  const handleCancel = () => {
    cancelTimerSwitch();
    onCancel();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleCancel}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            Switch Timer?
          </DialogTitle>
          <DialogDescription>
            You have an active timer running. Switching will stop the current timer and start a new one.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Current Timer Info */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-amber-600" />
              <span className="text-sm font-medium text-amber-800">
                Current Timer
              </span>
            </div>
            <div className="text-sm text-amber-700">
              <div className="font-medium">Task: {fromTaskId}</div>
              <div className="font-mono">
                Current session: {fromTaskTimer.formattedCurrentSession}
              </div>
              <div className="font-mono">
                Total today: {fromTaskTimer.formattedTotalTime}
              </div>
            </div>
          </div>

          {/* Switch Arrow */}
          <div className="flex justify-center">
            <ArrowRight className="w-5 h-5 text-gray-400" />
          </div>

          {/* New Timer Info */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-green-600" />
              <span className="text-sm font-medium text-green-800">
                New Timer
              </span>
            </div>
            <div className="text-sm text-green-700">
              <div className="font-medium">
                Task: {toTaskTitle || toTaskId}
              </div>
              <div className="text-xs text-green-600">
                Timer will start immediately
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleCancel}
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            className="bg-green-600 hover:bg-green-700"
          >
            Switch Timer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}