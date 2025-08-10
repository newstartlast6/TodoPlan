import React, { useState, useEffect } from 'react';
import { 
  Wifi, 
  WifiOff, 
  RefreshCw, 
  CheckCircle, 
  AlertCircle, 
  Clock,
  Server,
  Smartphone
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Progress } from '@/components/ui/progress';
import { useTimer } from '@/contexts/timer-context';
import { cn } from '@/lib/utils';

interface SyncStatus {
  isOnline: boolean;
  isSyncing: boolean;
  lastSyncTime: Date | null;
  pendingEvents: number;
  syncProgress?: number;
  error?: string;
}

interface SyncStatusIndicatorProps {
  className?: string;
  variant?: 'full' | 'compact' | 'icon-only';
}

export function SyncStatusIndicator({ 
  className, 
  variant = 'compact' 
}: SyncStatusIndicatorProps) {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    isOnline: navigator.onLine,
    isSyncing: false,
    lastSyncTime: null,
    pendingEvents: 0,
  });
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);

  // Mock sync status - in real implementation, this would come from sync service
  useEffect(() => {
    const updateSyncStatus = () => {
      setSyncStatus(prev => ({
        ...prev,
        isOnline: navigator.onLine,
        // Mock data - replace with actual sync service data
        pendingEvents: Math.floor(Math.random() * 5),
        lastSyncTime: new Date(Date.now() - Math.random() * 300000), // Random time in last 5 minutes
      }));
    };

    // Listen for online/offline events
    window.addEventListener('online', updateSyncStatus);
    window.addEventListener('offline', updateSyncStatus);

    // Update status periodically
    const interval = setInterval(updateSyncStatus, 30000); // Every 30 seconds

    return () => {
      window.removeEventListener('online', updateSyncStatus);
      window.removeEventListener('offline', updateSyncStatus);
      clearInterval(interval);
    };
  }, []);

  const getSyncStatusInfo = () => {
    if (!syncStatus.isOnline) {
      return {
        icon: WifiOff,
        color: 'text-red-600',
        bgColor: 'bg-red-100',
        status: 'Offline',
        description: 'Timer data will sync when connection is restored',
      };
    }

    if (syncStatus.isSyncing) {
      return {
        icon: RefreshCw,
        color: 'text-blue-600',
        bgColor: 'bg-blue-100',
        status: 'Syncing',
        description: 'Synchronizing timer data...',
        animate: true,
      };
    }

    if (syncStatus.error) {
      return {
        icon: AlertCircle,
        color: 'text-red-600',
        bgColor: 'bg-red-100',
        status: 'Sync Error',
        description: syncStatus.error,
      };
    }

    if (syncStatus.pendingEvents > 0) {
      return {
        icon: Clock,
        color: 'text-yellow-600',
        bgColor: 'bg-yellow-100',
        status: 'Pending',
        description: `${syncStatus.pendingEvents} events waiting to sync`,
      };
    }

    return {
      icon: CheckCircle,
      color: 'text-green-600',
      bgColor: 'bg-green-100',
      status: 'Synced',
      description: 'All timer data is synchronized',
    };
  };

  const handleManualSync = async () => {
    setSyncStatus(prev => ({ ...prev, isSyncing: true }));
    
    // Mock sync process
    setTimeout(() => {
      setSyncStatus(prev => ({
        ...prev,
        isSyncing: false,
        lastSyncTime: new Date(),
        pendingEvents: 0,
      }));
    }, 2000);
  };

  const statusInfo = getSyncStatusInfo();
  const StatusIcon = statusInfo.icon;

  // Icon-only variant
  if (variant === 'icon-only') {
    return (
      <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={cn("h-8 w-8 p-0", className)}
          >
            <StatusIcon 
              className={cn(
                "w-4 h-4",
                statusInfo.color,
                statusInfo.animate && "animate-spin"
              )} 
            />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80" align="end">
          <SyncStatusDetails 
            syncStatus={syncStatus}
            statusInfo={statusInfo}
            onManualSync={handleManualSync}
          />
        </PopoverContent>
      </Popover>
    );
  }

  // Compact variant
  if (variant === 'compact') {
    return (
      <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "flex items-center gap-2 h-8 px-2",
              statusInfo.bgColor,
              className
            )}
          >
            <StatusIcon 
              className={cn(
                "w-3 h-3",
                statusInfo.color,
                statusInfo.animate && "animate-spin"
              )} 
            />
            <span className={cn("text-xs font-medium", statusInfo.color)}>
              {statusInfo.status}
            </span>
            {syncStatus.pendingEvents > 0 && (
              <Badge variant="secondary" className="text-xs h-4 px-1">
                {syncStatus.pendingEvents}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80" align="end">
          <SyncStatusDetails 
            syncStatus={syncStatus}
            statusInfo={statusInfo}
            onManualSync={handleManualSync}
          />
        </PopoverContent>
      </Popover>
    );
  }

  // Full variant
  return (
    <div className={cn("bg-white rounded-lg border p-3", className)}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <StatusIcon 
            className={cn(
              "w-4 h-4",
              statusInfo.color,
              statusInfo.animate && "animate-spin"
            )} 
          />
          <span className="text-sm font-medium">{statusInfo.status}</span>
        </div>
        
        {syncStatus.pendingEvents > 0 && (
          <Badge variant="secondary" className="text-xs">
            {syncStatus.pendingEvents} pending
          </Badge>
        )}
      </div>

      <div className="text-xs text-gray-600 mb-3">
        {statusInfo.description}
      </div>

      {syncStatus.isSyncing && syncStatus.syncProgress && (
        <div className="mb-3">
          <Progress value={syncStatus.syncProgress} className="h-1" />
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="text-xs text-gray-500">
          {syncStatus.lastSyncTime ? (
            `Last sync: ${syncStatus.lastSyncTime.toLocaleTimeString()}`
          ) : (
            'Never synced'
          )}
        </div>
        
        <Button
          variant="outline"
          size="sm"
          onClick={handleManualSync}
          disabled={syncStatus.isSyncing || !syncStatus.isOnline}
          className="h-6 px-2 text-xs"
        >
          <RefreshCw className={cn(
            "w-3 h-3 mr-1",
            syncStatus.isSyncing && "animate-spin"
          )} />
          Sync
        </Button>
      </div>
    </div>
  );
}

/**
 * Detailed sync status component for popover
 */
function SyncStatusDetails({ 
  syncStatus, 
  statusInfo, 
  onManualSync 
}: {
  syncStatus: SyncStatus;
  statusInfo: any;
  onManualSync: () => void;
}) {
  const StatusIcon = statusInfo.icon;

  return (
    <div className="space-y-4">
      {/* Status Header */}
      <div className="flex items-center gap-3">
        <div className={cn("p-2 rounded-full", statusInfo.bgColor)}>
          <StatusIcon 
            className={cn(
              "w-4 h-4",
              statusInfo.color,
              statusInfo.animate && "animate-spin"
            )} 
          />
        </div>
        <div>
          <div className="font-medium">{statusInfo.status}</div>
          <div className="text-sm text-gray-600">{statusInfo.description}</div>
        </div>
      </div>

      {/* Connection Status */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">Connection</span>
          <div className="flex items-center gap-1">
            {syncStatus.isOnline ? (
              <Wifi className="w-3 h-3 text-green-600" />
            ) : (
              <WifiOff className="w-3 h-3 text-red-600" />
            )}
            <span className="text-xs">
              {syncStatus.isOnline ? 'Online' : 'Offline'}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">Pending Events</span>
          <Badge variant={syncStatus.pendingEvents > 0 ? "secondary" : "outline"} className="text-xs">
            {syncStatus.pendingEvents}
          </Badge>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">Last Sync</span>
          <span className="text-xs text-gray-500">
            {syncStatus.lastSyncTime ? (
              syncStatus.lastSyncTime.toLocaleString()
            ) : (
              'Never'
            )}
          </span>
        </div>
      </div>

      {/* Sync Progress */}
      {syncStatus.isSyncing && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Progress</span>
            <span className="text-xs text-gray-500">
              {syncStatus.syncProgress || 0}%
            </span>
          </div>
          <Progress value={syncStatus.syncProgress || 0} className="h-2" />
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onManualSync}
          disabled={syncStatus.isSyncing || !syncStatus.isOnline}
          className="flex-1"
        >
          <RefreshCw className={cn(
            "w-3 h-3 mr-1",
            syncStatus.isSyncing && "animate-spin"
          )} />
          {syncStatus.isSyncing ? 'Syncing...' : 'Sync Now'}
        </Button>
      </div>

      {/* Sync Strategy Info */}
      <div className="bg-gray-50 rounded-lg p-3">
        <div className="text-xs font-medium text-gray-700 mb-2">
          Sync Strategy
        </div>
        <div className="space-y-1 text-xs text-gray-600">
          <div className="flex items-center gap-2">
            <Server className="w-3 h-3" />
            <span>Server-first conflict resolution</span>
          </div>
          <div className="flex items-center gap-2">
            <Smartphone className="w-3 h-3" />
            <span>Local data preserved offline</span>
          </div>
          <div className="flex items-center gap-2">
            <RefreshCw className="w-3 h-3" />
            <span>Auto-sync every 60 seconds</span>
          </div>
        </div>
      </div>
    </div>
  );
}