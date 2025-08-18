// Use CommonJS syntax for Electron preload runtime to avoid ES6 import issues in distribution
const { contextBridge, ipcRenderer } = require('electron');

// Must match the port used by electron main process
const API_PORT = parseInt(process.env.ELECTRON_API_PORT || '5002', 10);
const API_BASE_URL = `http://localhost:${API_PORT}/api`;

contextBridge.exposeInMainWorld('electronAPI', {
  // Prefer dev proxy by returning '/api' in development to avoid CORS
  getApiBaseUrl: (): string => {
    const isDev = (process.env.NODE_ENV === 'development');
    if (isDev) return '/api';
    return API_BASE_URL;
  },
  getPublicAssetUrl: (relativePath: string): string => {
    try {
      const url = new URL(relativePath, globalThis.location?.href || '');
      return url.toString();
    } catch {
      return `/${relativePath}`;
    }
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
  sendTimerStateWithSession: (data: { status: 'RUNNING' | 'PAUSED' | 'STOPPED' | 'IDLE'; sessionSeconds: number; hasActiveSession?: boolean }) => {
    ipcRenderer.send('timer:stateChanged', data);
  },
  onTrayAction: (callback: (action: 'show' | 'hide' | 'pause' | 'resume' | 'stop' | 'discardLastSession') => void) => {
    const handler = (_event: any, action: any) => callback(action);
    ipcRenderer.on('tray:action', handler);
    return () => ipcRenderer.off('tray:action', handler);
  },
  onTrayStartTask: (callback: (taskData: { taskId: string; taskTitle: string }) => void) => {
    const handler = (_event: any, taskData: any) => callback(taskData);
    ipcRenderer.on('tray:startTask', handler);
    return () => ipcRenderer.off('tray:startTask', handler);
  },
  notifyTasksUpdated: (tasks?: any[]): void => {
    ipcRenderer.send('tasks:updated', tasks || []);
  },
    setTrayTitle: (title: string) => {
      ipcRenderer.send('tray:setTitle', { title });
    },
  getOpenAtLogin: async (): Promise<boolean> => ipcRenderer.invoke('app:getOpenAtLogin'),
  setOpenAtLogin: async (value: boolean): Promise<boolean> => ipcRenderer.invoke('app:setOpenAtLogin', value),
  quit: (): void => ipcRenderer.send('app:quit'),
});




