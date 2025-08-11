import { contextBridge as s, ipcRenderer as t } from "electron";
import i from "path";
import { pathToFileURL as c } from "url";
const p = parseInt(process.env.ELECTRON_API_PORT || "5002", 10), a = `http://localhost:${p}/api`;
s.exposeInMainWorld("electronAPI", {
  getApiBaseUrl: () => a,
  getPublicAssetUrl: (e) => {
    const n = process.env.NODE_ENV === "development" ? i.resolve(process.cwd(), "client", "public") : i.resolve(process.cwd(), "dist", "public"), o = i.resolve(n, e);
    return c(o).toString();
  },
  onTimerTick: (e) => {
    const n = (o, r) => e(r.elapsedSeconds);
    return t.on("timer:tick", n), () => t.off("timer:tick", n);
  },
  sendTimerTick: (e) => {
    t.send("timer:tick", { elapsedSeconds: e });
  },
  notifyTimerState: (e) => {
    t.send("timer:stateChanged", { status: e });
  },
  onTrayAction: (e) => {
    const n = (o, r) => e(r);
    return t.on("tray:action", n), () => t.off("tray:action", n);
  },
  setTrayTitle: (e) => {
    t.send("tray:setTitle", { title: e });
  },
  getOpenAtLogin: async () => t.invoke("app:getOpenAtLogin"),
  setOpenAtLogin: async (e) => t.invoke("app:setOpenAtLogin", e),
  quit: () => t.send("app:quit")
});
