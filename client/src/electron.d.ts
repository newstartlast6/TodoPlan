export {};

declare global {
  interface Window {
    electronAPI?: {
      getApiBaseUrl: () => string;
      sendTimerTick: (elapsedSeconds: number) => void;
      notifyTimerState: (status: 'RUNNING' | 'PAUSED' | 'STOPPED' | 'IDLE') => void;
      sendTimerStateWithSession: (data: { status: 'RUNNING' | 'PAUSED' | 'STOPPED' | 'IDLE'; sessionSeconds: number; hasActiveSession?: boolean }) => void;
      onTrayAction: (callback: (action: 'show' | 'hide' | 'pause' | 'resume' | 'stop' | 'discardLastSession') => void) => () => void;
      getPublicAssetUrl: (relativePath: string) => string;
      getOpenAtLogin: () => Promise<boolean>;
      setOpenAtLogin: (value: boolean) => Promise<boolean>;
      quit: () => void;
      setTrayTitle: (title: string) => void;
    };
  }
}


