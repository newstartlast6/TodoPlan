export {};

declare global {
  interface Window {
    electronAPI?: {
      getApiBaseUrl: () => string;
      sendTimerTick: (elapsedSeconds: number) => void;
      notifyTimerState: (status: 'RUNNING' | 'PAUSED' | 'STOPPED' | 'IDLE') => void;
      onTrayAction: (callback: (action: 'show' | 'hide' | 'pause' | 'resume' | 'stop') => void) => () => void;
      getPublicAssetUrl: (relativePath: string) => string;
      getOpenAtLogin: () => Promise<boolean>;
      setOpenAtLogin: (value: boolean) => Promise<boolean>;
      quit: () => void;
    };
  }
}


