// Plain CommonJS preload for Electron (dev runtime)
// Matches the API exposed by electron/preload.ts

const { contextBridge, ipcRenderer } = require('electron');
const path = require('path');
const { pathToFileURL } = require('url');

const API_PORT = parseInt(process.env.ELECTRON_API_PORT || '5002', 10);
const API_BASE_URL = `http://localhost:${API_PORT}/api`;

contextBridge.exposeInMainWorld('electronAPI', {
  getApiBaseUrl: () => API_BASE_URL,
  getPublicAssetUrl: (relativePath) => {
    const base = process.env.NODE_ENV === 'development'
      ? path.resolve(process.cwd(), 'client', 'public')
      : path.resolve(process.cwd(), 'dist', 'public');
    const fullPath = path.resolve(base, relativePath);
    return pathToFileURL(fullPath).toString();
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


