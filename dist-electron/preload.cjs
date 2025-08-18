var __getOwnPropNames = Object.getOwnPropertyNames;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var require_preload = __commonJS({
  "preload.cjs"() {
    const { contextBridge, ipcRenderer } = require("electron");
    const API_PORT = parseInt(process.env.ELECTRON_API_PORT || "5002", 10);
    const API_BASE_URL = `http://localhost:${API_PORT}/api`;
    contextBridge.exposeInMainWorld("electronAPI", {
      // Prefer dev proxy by returning '/api' in development to avoid CORS
      getApiBaseUrl: () => {
        const isDev = process.env.NODE_ENV === "development";
        if (isDev) return "/api";
        return API_BASE_URL;
      },
      getPublicAssetUrl: (relativePath) => {
        try {
          const url = new URL(relativePath, globalThis.location?.href || "");
          return url.toString();
        } catch {
          return `/${relativePath}`;
        }
      },
      onTimerTick: (callback) => {
        const handler = (_event, payload) => callback(payload.elapsedSeconds);
        ipcRenderer.on("timer:tick", handler);
        return () => ipcRenderer.off("timer:tick", handler);
      },
      sendTimerTick: (elapsedSeconds) => {
        ipcRenderer.send("timer:tick", { elapsedSeconds });
      },
      notifyTimerState: (status) => {
        ipcRenderer.send("timer:stateChanged", { status });
      },
      sendTimerStateWithSession: (data) => {
        ipcRenderer.send("timer:stateChanged", data);
      },
      onTrayAction: (callback) => {
        const handler = (_event, action) => callback(action);
        ipcRenderer.on("tray:action", handler);
        return () => ipcRenderer.off("tray:action", handler);
      },
      onTrayStartTask: (callback) => {
        const handler = (_event, taskData) => callback(taskData);
        ipcRenderer.on("tray:startTask", handler);
        return () => ipcRenderer.off("tray:startTask", handler);
      },
      notifyTasksUpdated: (tasks) => {
        ipcRenderer.send("tasks:updated", tasks || []);
      },
      setTrayTitle: (title) => {
        ipcRenderer.send("tray:setTitle", { title });
      },
      getOpenAtLogin: async () => ipcRenderer.invoke("app:getOpenAtLogin"),
      setOpenAtLogin: async (value) => ipcRenderer.invoke("app:setOpenAtLogin", value),
      quit: () => ipcRenderer.send("app:quit")
    });
  }
});
export default require_preload();
