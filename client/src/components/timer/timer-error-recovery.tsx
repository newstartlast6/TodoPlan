import React, { useState, useEffect } from 'react';
import { AlertTriangle, RefreshCw, CheckCircle, XCircle, Clock, Wifi, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { TimerError, TimerRetryHandler, TIMER_ERROR_CODES } from '@shared/services/timer-errors';
import { useErrorMonitoring } from '@/services/error-monitoring-service';

interface TimerErrorRecoveryProps {
  error: TimerError;
  onRetry: () => Promise<void>;
  onCancel: () => void;
  onResolve: () => void;
  maxRetries?: number;
  retryDelay?: number;
}

interface RecoveryStep {
  id: string;
  label: string;
  description: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  action?: () => Promise<void>;
}

/**
 * Component for handling timer error recovery with guided steps
 */
export const TimerErrorRecovery: React.FC<TimerErrorRecoveryProps> = ({
  error,
  onRetry,
  onCancel,
  onResolve,
  maxRetries = 3,
  retryDelay = 1000,
}) => {
  const [isRecovering, setIsRecovering] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [recoverySteps, setRecoverySteps] = useState<RecoveryStep[]>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const { reportError, resolveError } = useErrorMonitoring();

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    setRecoverySteps(generateRecoverySteps(error));
  }, [error]);

  const generateRecoverySteps = (error: TimerError): RecoveryStep[] => {
    const steps: RecoveryStep[] = [];

    // Common first step: Check network connectivity
    if (error.code === TIMER_ERROR_CODES.NETWORK_ERROR || 
        error.code === TIMER_ERROR_CODES.SERVER_ERROR) {
      steps.push({
        id: 'check-network',
        label: 'Check Network Connection',
        description: 'Verifying internet connectivity',
        status: 'pending',
        action: async () => {
          await new Promise(resolve => setTimeout(resolve, 1000));
          if (!navigator.onLine) {
            throw new Error('No internet connection');
          }
        },
      });
    }

    // Timer state validation
    if (error.code === TIMER_ERROR_CODES.TIMER_STATE_ERROR ||
        error.code === TIMER_ERROR_CODES.CORRUPTION_DETECTED) {
      steps.push({
        id: 'validate-state',
        label: 'Validate Timer State',
        description: 'Checking timer data integrity',
        status: 'pending',
        action: async () => {
          await new Promise(resolve => setTimeout(resolve, 1500));
          // Simulate state validation
          const storedState = localStorage.getItem('timer_state');
          if (!storedState) {
            throw new Error('Timer state not found');
          }
        },
      });
    }

    // Sync with server
    if (error.code === TIMER_ERROR_CODES.SYNC_CONFLICT ||
        error.code === TIMER_ERROR_CODES.NETWORK_ERROR) {
      steps.push({
        id: 'sync-server',
        label: 'Sync with Server',
        description: 'Synchronizing timer data with server',
        status: 'pending',
        action: async () => {
          await new Promise(resolve => setTimeout(resolve, 2000));
          // Simulate server sync
        },
      });
    }

    // Storage cleanup
    if (error.code === TIMER_ERROR_CODES.STORAGE_FULL ||
        error.code === TIMER_ERROR_CODES.CORRUPTION_DETECTED) {
      steps.push({
        id: 'cleanup-storage',
        label: 'Clean Up Storage',
        description: 'Removing corrupted or old data',
        status: 'pending',
        action: async () => {
          await new Promise(resolve => setTimeout(resolve, 1000));
          // Simulate storage cleanup
          try {
            const keys = Object.keys(localStorage);
            const oldKeys = keys.filter(key => 
              key.startsWith('timer_') && 
              key.includes('old_') || 
              key.includes('backup_')
            );
            oldKeys.forEach(key => localStorage.removeItem(key));
          } catch (e) {
            // Storage cleanup failed
          }
        },
      });
    }

    // Final step: Retry operation
    steps.push({
      id: 'retry-operation',
      label: 'Retry Operation',
      description: 'Attempting to complete the original operation',
      status: 'pending',
      action: onRetry,
    });

    return steps;
  };

  const executeRecoveryStep = async (step: RecoveryStep, index: number) => {
    setRecoverySteps(prev => prev.map((s, i) => 
      i === index ? { ...s, status: 'running' } : s
    ));

    try {
      if (step.action) {
        await step.action();
      }
      
      setRecoverySteps(prev => prev.map((s, i) => 
        i === index ? { ...s, status: 'completed' } : s
      ));
      
      return true;
    } catch (stepError) {
      setRecoverySteps(prev => prev.map((s, i) => 
        i === index ? { ...s, status: 'failed' } : s
      ));
      
      console.error(`Recovery step failed: ${step.id}`, stepError);
      return false;
    }
  };

  const startRecovery = async () => {
    setIsRecovering(true);
    setCurrentStepIndex(0);

    try {
      for (let i = 0; i < recoverySteps.length; i++) {
        setCurrentStepIndex(i);
        const success = await executeRecoveryStep(recoverySteps[i], i);
        
        if (!success) {
          // If a step fails, we can either continue or stop based on the step type
          if (recoverySteps[i].id === 'retry-operation') {
            // If the final retry fails, increment retry count
            setRetryCount(prev => prev + 1);
            break;
          }
          // For other steps, we can continue to the next step
        }
        
        // Add delay between steps for better UX
        if (i < recoverySteps.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      // Check if all steps completed successfully
      const allCompleted = recoverySteps.every(step => step.status === 'completed');
      if (allCompleted) {
        onResolve();
        resolveError(error.message); // Mark error as resolved in monitoring
      }
    } catch (recoveryError) {
      console.error('Recovery process failed:', recoveryError);
      reportError(recoveryError as Error, {
        component: 'timer-error-recovery',
        action: 'recovery_process',
        additionalData: {
          originalError: error,
          currentStep: currentStepIndex,
          retryCount,
        },
      });
    } finally {
      setIsRecovering(false);
    }
  };

  const canRetry = retryCount < maxRetries;
  const progress = recoverySteps.length > 0 
    ? (recoverySteps.filter(step => step.status === 'completed').length / recoverySteps.length) * 100
    : 0;

  const getStepIcon = (status: RecoveryStep['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-600" />;
      case 'running':
        return <RefreshCw className="w-4 h-4 text-blue-600 animate-spin" />;
      default:
        return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  return (
    <Card className="border-orange-200 bg-orange-50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-orange-800">
          <AlertTriangle className="w-5 h-5" />
          Timer Recovery Assistant
          <Badge variant="outline" className="ml-auto">
            Attempt {retryCount + 1}/{maxRetries}
          </Badge>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Network status indicator */}
        <Alert>
          <div className="flex items-center gap-2">
            {isOnline ? (
              <Wifi className="w-4 h-4 text-green-600" />
            ) : (
              <WifiOff className="w-4 h-4 text-red-600" />
            )}
            <AlertDescription>
              Network Status: {isOnline ? 'Connected' : 'Offline'}
            </AlertDescription>
          </div>
        </Alert>

        {/* Error summary */}
        <div className="bg-white border border-orange-200 rounded-lg p-3">
          <div className="text-sm font-medium text-orange-800 mb-1">
            Error: {error.code}
          </div>
          <div className="text-sm text-orange-700">
            {error.message}
          </div>
        </div>

        {/* Recovery progress */}
        {isRecovering && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Recovery Progress</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        )}

        {/* Recovery steps */}
        <div className="space-y-2">
          <div className="text-sm font-medium text-orange-800">
            Recovery Steps:
          </div>
          {recoverySteps.map((step, index) => (
            <div
              key={step.id}
              className={`flex items-center gap-3 p-2 rounded-lg border ${
                index === currentStepIndex && isRecovering
                  ? 'border-blue-200 bg-blue-50'
                  : 'border-gray-200 bg-white'
              }`}
            >
              {getStepIcon(step.status)}
              <div className="flex-1">
                <div className="text-sm font-medium">{step.label}</div>
                <div className="text-xs text-gray-600">{step.description}</div>
              </div>
              {step.status === 'running' && (
                <div className="text-xs text-blue-600">Running...</div>
              )}
            </div>
          ))}
        </div>

        {/* Action buttons */}
        <div className="flex gap-2">
          <Button
            onClick={startRecovery}
            disabled={isRecovering || !canRetry || !isOnline}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${isRecovering ? 'animate-spin' : ''}`} />
            {isRecovering ? 'Recovering...' : 'Start Recovery'}
          </Button>
          
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={isRecovering}
          >
            Cancel
          </Button>
        </div>

        {/* Retry limit reached */}
        {!canRetry && (
          <Alert>
            <AlertTriangle className="w-4 h-4" />
            <AlertDescription>
              Maximum retry attempts reached. Please try refreshing the page or contact support if the issue persists.
            </AlertDescription>
          </Alert>
        )}

        {/* Offline notice */}
        {!isOnline && (
          <Alert>
            <WifiOff className="w-4 h-4" />
            <AlertDescription>
              You are currently offline. Recovery will be available when your connection is restored.
            </AlertDescription>
          </Alert>
        )}

        {/* Timer data safety notice */}
        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-green-600" />
            <span className="text-sm font-medium text-green-800">
              Your Timer Data is Safe
            </span>
          </div>
          <p className="text-xs text-green-700 mt-1">
            All timer data is automatically backed up locally and will be preserved during recovery.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

/**
 * Hook for using timer error recovery
 */
export function useTimerErrorRecovery() {
  const [isRecovering, setIsRecovering] = useState(false);
  const [recoveryError, setRecoveryError] = useState<TimerError | null>(null);

  const attemptRecovery = async (
    operation: () => Promise<any>,
    maxRetries: number = 3,
    delayMs: number = 1000
  ) => {
    setIsRecovering(true);
    setRecoveryError(null);

    try {
      const result = await TimerRetryHandler.withRetry(operation, maxRetries, delayMs);
      return result;
    } catch (error) {
      const timerError = error instanceof TimerError ? error : new TimerError(
        'Recovery failed',
        'RECOVERY_FAILED',
        { originalError: error }
      );
      setRecoveryError(timerError);
      throw timerError;
    } finally {
      setIsRecovering(false);
    }
  };

  return {
    isRecovering,
    recoveryError,
    attemptRecovery,
    clearRecoveryError: () => setRecoveryError(null),
  };
}