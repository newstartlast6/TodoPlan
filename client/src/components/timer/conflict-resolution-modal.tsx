import React, { useState } from 'react';
import { AlertTriangle, Clock, Server, Smartphone, Merge, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TimerSession } from '@shared/timer-types';
import { TimerCalculator } from '@shared/services/timer-store';
import { cn } from '@/lib/utils';

interface ConflictResolutionModalProps {
  isOpen: boolean;
  onClose: () => void;
  serverSession: TimerSession;
  localSession: TimerSession;
  onResolve: (resolution: 'server' | 'local' | 'merge') => Promise<void>;
}

export function ConflictResolutionModal({
  isOpen,
  onClose,
  serverSession,
  localSession,
  onResolve,
}: ConflictResolutionModalProps) {
  const [isResolving, setIsResolving] = useState(false);
  const [selectedResolution, setSelectedResolution] = useState<'server' | 'local' | 'merge' | null>(null);

  const handleResolve = async (resolution: 'server' | 'local' | 'merge') => {
    setIsResolving(true);
    setSelectedResolution(resolution);
    
    try {
      await onResolve(resolution);
      onClose();
    } catch (error) {
      console.error('Failed to resolve conflict:', error);
    } finally {
      setIsResolving(false);
      setSelectedResolution(null);
    }
  };

  const formatDuration = (seconds: number) => TimerCalculator.formatDuration(seconds);
  const formatTime = (date: Date) => date.toLocaleTimeString();

  const isSameTask = serverSession.taskId === localSession.taskId;
  const serverTime = new Date(serverSession.updatedAt);
  const localTime = new Date(localSession.updatedAt);
  const timeDiff = Math.abs(serverTime.getTime() - localTime.getTime());
  const isRecentConflict = timeDiff < 5 * 60 * 1000; // 5 minutes

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            Timer Conflict Detected
          </DialogTitle>
          <DialogDescription>
            Multiple timer sessions are active. Please choose how to resolve this conflict.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Conflict Summary */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <span className="text-sm font-medium text-amber-800">
                Conflict Details
              </span>
            </div>
            <div className="text-sm text-amber-700 space-y-1">
              <div>• {isSameTask ? 'Same task' : 'Different tasks'} being tracked</div>
              <div>• Time difference: {Math.round(timeDiff / 1000 / 60)} minutes</div>
              <div>• {isRecentConflict ? 'Recent conflict' : 'Significant time gap'}</div>
            </div>
          </div>

          {/* Session Comparison */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Server Session */}
            <Card className="border-blue-200">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Server className="w-4 h-4 text-blue-600" />
                  <span className="font-medium text-blue-800">Server Session</span>
                  <Badge variant="outline" className="text-xs">
                    {serverSession.isActive ? 'Active' : 'Paused'}
                  </Badge>
                </div>
                
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-gray-600">Task:</span>
                    <span className="ml-2 font-medium">{serverSession.taskId}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Duration:</span>
                    <span className="ml-2 font-mono font-medium">
                      {formatDuration(serverSession.durationSeconds)}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600">Last Updated:</span>
                    <span className="ml-2">{formatTime(serverTime)}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Started:</span>
                    <span className="ml-2">{formatTime(new Date(serverSession.startTime))}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Local Session */}
            <Card className="border-green-200">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Smartphone className="w-4 h-4 text-green-600" />
                  <span className="font-medium text-green-800">Local Session</span>
                  <Badge variant="outline" className="text-xs">
                    {localSession.isActive ? 'Active' : 'Paused'}
                  </Badge>
                </div>
                
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-gray-600">Task:</span>
                    <span className="ml-2 font-medium">{localSession.taskId}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Duration:</span>
                    <span className="ml-2 font-mono font-medium">
                      {formatDuration(localSession.durationSeconds)}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600">Last Updated:</span>
                    <span className="ml-2">{formatTime(localTime)}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Started:</span>
                    <span className="ml-2">{formatTime(new Date(localSession.startTime))}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Resolution Options */}
          <div className="space-y-3">
            <h4 className="font-medium text-gray-900">Choose Resolution:</h4>
            
            {/* Use Server Session */}
            <Card 
              className={cn(
                "cursor-pointer transition-colors border-2",
                "hover:bg-blue-50 hover:border-blue-300"
              )}
              onClick={() => !isResolving && handleResolve('server')}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Server className="w-5 h-5 text-blue-600" />
                  <div className="flex-1">
                    <div className="font-medium text-blue-900">Use Server Session</div>
                    <div className="text-sm text-blue-700">
                      Keep the server version and discard local changes
                    </div>
                  </div>
                  {serverTime > localTime && (
                    <Badge className="bg-blue-100 text-blue-800">Recommended</Badge>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Use Local Session */}
            <Card 
              className={cn(
                "cursor-pointer transition-colors border-2",
                "hover:bg-green-50 hover:border-green-300"
              )}
              onClick={() => !isResolving && handleResolve('local')}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Smartphone className="w-5 h-5 text-green-600" />
                  <div className="flex-1">
                    <div className="font-medium text-green-900">Use Local Session</div>
                    <div className="text-sm text-green-700">
                      Keep your local version and sync to server
                    </div>
                  </div>
                  {localTime > serverTime && (
                    <Badge className="bg-green-100 text-green-800">Recommended</Badge>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Merge Sessions (only for same task) */}
            {isSameTask && isRecentConflict && (
              <Card 
                className={cn(
                  "cursor-pointer transition-colors border-2",
                  "hover:bg-purple-50 hover:border-purple-300"
                )}
                onClick={() => !isResolving && handleResolve('merge')}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <Merge className="w-5 h-5 text-purple-600" />
                    <div className="flex-1">
                      <div className="font-medium text-purple-900">Merge Sessions</div>
                      <div className="text-sm text-purple-700">
                        Combine both sessions (use maximum duration)
                      </div>
                    </div>
                    <Badge className="bg-purple-100 text-purple-800">Smart Merge</Badge>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Warning for data loss */}
          {!isSameTask && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-600" />
                <span className="text-sm font-medium text-red-800">
                  Warning: Different Tasks
                </span>
              </div>
              <div className="text-sm text-red-700 mt-1">
                Choosing one session will stop tracking the other task. 
                Consider completing both tasks separately.
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isResolving}
          >
            <X className="w-4 h-4 mr-2" />
            Cancel
          </Button>
          
          {isResolving && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
              Resolving {selectedResolution} conflict...
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Hook for managing conflict resolution
 */
export function useConflictResolution() {
  const [conflictState, setConflictState] = useState<{
    isOpen: boolean;
    serverSession?: TimerSession;
    localSession?: TimerSession;
    onResolve?: (resolution: 'server' | 'local' | 'merge') => Promise<void>;
  }>({ isOpen: false });

  const showConflictResolution = (
    serverSession: TimerSession,
    localSession: TimerSession,
    onResolve: (resolution: 'server' | 'local' | 'merge') => Promise<void>
  ) => {
    setConflictState({
      isOpen: true,
      serverSession,
      localSession,
      onResolve,
    });
  };

  const hideConflictResolution = () => {
    setConflictState({ isOpen: false });
  };

  return {
    conflictState,
    showConflictResolution,
    hideConflictResolution,
  };
}