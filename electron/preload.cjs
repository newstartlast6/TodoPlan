// Plain CommonJS preload for Electron (dev runtime)
// Matches the API exposed by electron/preload.ts

const { contextBridge, ipcRenderer } = require('electron');

const API_PORT = parseInt(process.env.ELECTRON_API_PORT || '5002', 10);
const API_BASE_URL = `http://localhost:${API_PORT}/api`;

contextBridge.exposeInMainWorld('electronAPI', {
  // Prefer dev proxy by returning '/api' in development to avoid CORS
  getApiBaseUrl: () => {
    if (process.env.NODE_ENV === 'development') return '/api';
    return API_BASE_URL;
  },
  getPublicAssetUrl: (relativePath) => {
    try {
      // Works in both dev (http) and prod (file) by resolving relative to current document URL
      const url = new URL(relativePath, globalThis.location?.href || '');
      return url.toString();
    } catch {
      // Fallback to root-relative path (works in dev server)
      return `/${relativePath}`;
    }
  },
  onTimerTick: (callback) => {
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
  setTrayTitle: (title) => {
    ipcRenderer.send('tray:setTitle', { title });
  },
  getOpenAtLogin: async () => ipcRenderer.invoke('app:getOpenAtLogin'),
  setOpenAtLogin: async (value) => ipcRenderer.invoke('app:setOpenAtLogin', value),
  quit: () => ipcRenderer.send('app:quit'),
});


