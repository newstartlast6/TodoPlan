// electron/preload.ts - Convert to CommonJS for Electron compatibility
const { contextBridge, ipcRenderer } = require('electron');

// Must match the port used by electron main process
const API_PORT = parseInt(process.env.ELECTRON_API_PORT || '5002', 10);

contextBridge.exposeInMainWorld('electronAPI', {
  // Always use relative path '/api' for both dev and prod
  getApiBaseUrl: () => {
    return '/api';
  },
  
  getPublicAssetUrl: (relativePath) => {
    try {
      const url = new URL(relativePath, globalThis.location?.href || '');
      return url.toString();
    } catch {
      return `/${relativePath}`;
    }
  },
  
  onTimerTick: (callback) => {
    // Not used by renderer in current design; renderer sends ticks to main.
    const handler = (_event, payload) => callback(payload.elapsedSeconds);
    ipcRenderer.on('timer:tick', handler);
    return () => ipcRenderer.off('timer:tick', handler);
  },
  
  sendTimerTick: (elapsedSeconds) => {
    ipcRenderer.send('timer:tick', { elapsedSeconds });
  },
  
  notifyTimerState: (status) => {
    ipcRenderer.send('timer:stateChanged', { status });
  },
  
  sendTimerStateWithSession: (data) => {
    ipcRenderer.send('timer:stateChanged', data);
  },
  
  onTrayAction: (callback) => {
    const handler = (_event, action) => callback(action);
    ipcRenderer.on('tray:action', handler);
    return () => ipcRenderer.off('tray:action', handler);
  },
  
  onTrayStartTask: (callback) => {
    const handler = (_event, taskData) => callback(taskData);
    ipcRenderer.on('tray:startTask', handler);
    return () => ipcRenderer.off('tray:startTask', handler);
  },
  
  notifyTasksUpdated: (tasks) => {
    ipcRenderer.send('tasks:updated', tasks || []);
  },
  
  setTrayTitle: (title) => {
    ipcRenderer.send('tray:setTitle', { title });
  },
  
  getOpenAtLogin: async () => ipcRenderer.invoke('app:getOpenAtLogin'),
  
  setOpenAtLogin: async (value) => ipcRenderer.invoke('app:setOpenAtLogin', value),
  
  quit: () => ipcRenderer.send('app:quit'),
});