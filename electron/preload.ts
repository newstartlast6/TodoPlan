// Use CommonJS-compatible imports for Electron preload runtime
import { contextBridge, ipcRenderer } from 'electron';
import path from 'path';
import { pathToFileURL, fileURLToPath } from 'url';

// Must match the port used by electron main process
const API_PORT = parseInt(process.env.ELECTRON_API_PORT || '5002', 10);
const API_BASE_URL = `http://localhost:${API_PORT}/api`;

contextBridge.exposeInMainWorld('electronAPI', {
  getApiBaseUrl: (): string => API_BASE_URL,
  getPublicAssetUrl: (relativePath: string): string => {
    const base = process.env.NODE_ENV === 'development'
      ? path.resolve(process.cwd(), 'client', 'public')
      : path.resolve(process.cwd(), 'dist', 'public');
    const fullPath = path.resolve(base, relativePath);
    return pathToFileURL(fullPath).toString();
  },
  onTimerTick: (callback: (elapsedSeconds: number) => void) => {
    // Not used by renderer in current design; renderer sends ticks to main.
    const handler = (_event: any, payload: { elapsedSeconds: number }) => callback(payload.elapsedSeconds);
    ipcRenderer.on('timer:tick', handler);
    return () => ipcRenderer.off('timer:tick', handler);
  },
  sendTimerTick: (elapsedSeconds: number) => {
    ipcRenderer.send('timer:tick', { elapsedSeconds });
  },
  notifyTimerState: (status: 'RUNNING' | 'PAUSED' | 'STOPPED' | 'IDLE') => {
    ipcRenderer.send('timer:stateChanged', { status });
  },
  onTrayAction: (callback: (action: 'show' | 'hide' | 'pause' | 'resume' | 'stop') => void) => {
    const handler = (_event: any, action: any) => callback(action);
    ipcRenderer.on('tray:action', handler);
    return () => ipcRenderer.off('tray:action', handler);
  },
    setTrayTitle: (title: string) => {
      ipcRenderer.send('tray:setTitle', { title });
    },
  getOpenAtLogin: async (): Promise<boolean> => ipcRenderer.invoke('app:getOpenAtLogin'),
  setOpenAtLogin: async (value: boolean): Promise<boolean> => ipcRenderer.invoke('app:setOpenAtLogin', value),
  quit: (): void => ipcRenderer.send('app:quit'),
});

export {};


