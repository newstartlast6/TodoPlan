import 'dotenv/config';
import { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain } from 'electron';
import path from 'path';
import { pathToFileURL, fileURLToPath } from 'url';
import express from 'express';
import type { Express, Request, Response, NextFunction } from 'express';
import { registerRoutes } from '../server/routes';
import type { Server } from 'http';

// Basic time formatter for tray title
function formatDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

const isMac = process.platform === 'darwin';
const isDev = !app.isPackaged;
// Use a dedicated env var for API port to avoid conflicts with Vite dev server port
const API_PORT = parseInt(process.env.ELECTRON_API_PORT || '5002', 10);

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isRunning = false;
let httpServerRef: Server | null = null;
let isQuitting = false;
let openAtLoginEnabled = false;

async function startExpressServer(port: number): Promise<Server> {
  const exp: Express = express();
  exp.use(express.json());
  exp.use(express.urlencoded({ extended: false }));

  const httpServer = await registerRoutes(exp);

  // Error middleware similar to server/index.ts
  exp.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err?.status || err?.statusCode || 500;
    const message = err?.message || 'Internal Server Error';
    res.status(status).json({ message });
    if (isDev) console.error(err);
  });

  await new Promise<void>((resolve) => {
    httpServer.listen({ port }, () => resolve());
  });
  return httpServer;
}

function resolvePreloadPath(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'dist-electron', 'preload.js');
  }
  return path.join(process.cwd(), 'dist-electron', 'preload.js');
}

async function waitForFile(filePath: string, timeoutMs = 5000): Promise<void> {
  const fs = require('fs');
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      fs.accessSync(filePath);
      return;
    } catch {}
    await new Promise(r => setTimeout(r, 100));
  }
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: resolvePreloadPath(),
    },
    title: 'TodoPlan',
    show: true,
  });

  if (isDev) {
    const devPort = process.env.VITE_PORT || '5173';
    const devServerUrl = process.env.VITE_DEV_SERVER_URL || `http://localhost:${devPort}`;
    await mainWindow.loadURL(devServerUrl);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    const indexPath = path.resolve(process.cwd(), 'dist', 'public', 'index.html');
    await mainWindow.loadURL(pathToFileURL(indexPath).toString());
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.on('close', (event) => {
    if (!isQuitting && isMac) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });
}

function createTray() {
  // Minimal 1x1 transparent PNG to satisfy Tray icon requirement
  const emptyIconDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVQYV2NgYAAAAAMAASsJTYQAAAAASUVORK5CYII=';
  const icon = nativeImage.createFromDataURL(emptyIconDataUrl);
  tray = new Tray(icon);
  tray.setTitle('00:00');
  tray.setToolTip('TodoPlan Timer');

  const buildMenu = () => {
    const template: Electron.MenuItemConstructorOptions[] = [
      {
        label: mainWindow?.isVisible() ? 'Hide' : 'Show',
        click: () => {
          if (!mainWindow) return;
          if (mainWindow.isVisible()) {
            mainWindow.hide();
            mainWindow.webContents.send('tray:action', 'hide');
          } else {
            mainWindow.show();
            mainWindow.focus();
            mainWindow.webContents.send('tray:action', 'show');
          }
          setTimeout(() => tray?.setContextMenu(Menu.buildFromTemplate(buildMenu())), 0);
        },
      },
      { type: 'separator' },
      {
        label: isRunning ? 'Pause' : 'Resume',
        click: () => {
          if (!mainWindow) return;
          mainWindow.webContents.send('tray:action', isRunning ? 'pause' : 'resume');
        },
      },
      {
        label: 'Stop',
        click: () => {
          if (!mainWindow) return;
          mainWindow.webContents.send('tray:action', 'stop');
        },
      },
      { type: 'separator' },
      {
        label: 'Open at Login',
        type: 'checkbox',
        checked: openAtLoginEnabled,
        click: (item) => {
          const enabled = Boolean((item as any).checked);
          app.setLoginItemSettings({ openAtLogin: enabled });
          openAtLoginEnabled = enabled;
          setTimeout(() => tray?.setContextMenu(Menu.buildFromTemplate(buildMenu())), 0);
        },
      },
      { type: 'separator' },
      { role: 'quit', label: 'Quit' },
    ];
    return template;
  };

  tray.setContextMenu(Menu.buildFromTemplate(buildMenu()));

  // Click toggles show/hide
  tray.on('click', () => {
    if (!mainWindow) return;
    if (mainWindow.isVisible()) {
      mainWindow.hide();
      mainWindow.webContents.send('tray:action', 'hide');
    } else {
      mainWindow.show();
      mainWindow.focus();
      mainWindow.webContents.send('tray:action', 'show');
    }
    setTimeout(() => tray?.setContextMenu(Menu.buildFromTemplate(buildMenu())), 0);
  });
}

function registerIpc() {
  ipcMain.on('timer:tick', (_event, payload: { elapsedSeconds: number }) => {
    if (!tray) return;
    const text = formatDuration(payload?.elapsedSeconds ?? 0);
    tray.setTitle(text);
  });

  ipcMain.on('timer:stateChanged', (_event, payload: { status: 'RUNNING' | 'PAUSED' | 'STOPPED' | 'IDLE' }) => {
    isRunning = payload?.status === 'RUNNING';
    // Refresh menu to reflect Pause/Resume toggle
    if (tray) {
      // Rebuild menu to update Pause/Resume label
      const template: Electron.MenuItemConstructorOptions[] = [];
      const cm = Menu.buildFromTemplate(template);
      tray.setContextMenu(cm);
      // Immediately rebuild with our builder to reflect new state
      tray.setContextMenu(Menu.buildFromTemplate((() => {
        const label = isRunning ? 'Pause' : 'Resume';
        return [
          { label: mainWindow?.isVisible() ? 'Hide' : 'Show', click: () => { if (!mainWindow) return; if (mainWindow.isVisible()) { mainWindow.hide(); mainWindow.webContents.send('tray:action', 'hide'); } else { mainWindow.show(); mainWindow.focus(); mainWindow.webContents.send('tray:action', 'show'); } } },
          { type: 'separator' },
          { label, click: () => { if (!mainWindow) return; mainWindow.webContents.send('tray:action', isRunning ? 'pause' : 'resume'); } },
          { label: 'Stop', click: () => { if (!mainWindow) return; mainWindow.webContents.send('tray:action', 'stop'); } },
          { type: 'separator' },
          { label: 'Open at Login', type: 'checkbox', checked: openAtLoginEnabled, click: (item) => { const enabled = Boolean((item as any).checked); app.setLoginItemSettings({ openAtLogin: enabled }); openAtLoginEnabled = enabled; } },
          { type: 'separator' },
          { role: 'quit', label: 'Quit' },
        ];
      })()));
    }
  });

  ipcMain.on('show:mainWindow', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  ipcMain.on('app:quit', () => {
    isQuitting = true;
    app.quit();
  });

  ipcMain.handle('app:getOpenAtLogin', () => {
    try {
      return app.getLoginItemSettings().openAtLogin;
    } catch {
      return false;
    }
  });

  ipcMain.handle('app:setOpenAtLogin', (_e, value: boolean) => {
    try {
      app.setLoginItemSettings({ openAtLogin: Boolean(value) });
      openAtLoginEnabled = Boolean(value);
      return true;
    } catch {
      return false;
    }
  });
}

// Single instance lock
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (!mainWindow.isVisible()) mainWindow.show();
      mainWindow.focus();
    }
  });
}

app.whenReady().then(async () => {
  // Help the renderer know dev server port for asset resolution if needed
  if (isDev && !process.env.VITE_DEV_SERVER_URL) {
    process.env.VITE_PORT = process.env.VITE_PORT || '5173';
    process.env.VITE_DEV_SERVER_URL = `http://localhost:${process.env.VITE_PORT}`;
  }

  httpServerRef = await startExpressServer(API_PORT);
  // Ensure preload exists in dev before creating window
  if (!app.isPackaged) {
    try { await waitForFile(resolvePreloadPath(), 5000); } catch {}
  }
  await createWindow();
  if (isMac) createTray();
  registerIpc();

  // Optional: hide Dock icon when configured
  if (isMac && process.env.HIDE_DOCK === '1' && app.dock) {
    try { app.dock.hide(); } catch {}
  }

  // Initialize "Open at Login" state for menu
  try { openAtLoginEnabled = app.getLoginItemSettings().openAtLogin; } catch { openAtLoginEnabled = false; }

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (!isMac) app.quit();
});

app.on('before-quit', () => {
  isQuitting = true;
  if (httpServerRef) {
    try { httpServerRef.close(); } catch {}
    httpServerRef = null;
  }
});


