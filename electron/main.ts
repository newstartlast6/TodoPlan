import 'dotenv/config';
import { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain, dialog } from 'electron';
import path from 'path';
import { pathToFileURL, fileURLToPath } from 'url';
import express from 'express';
import type { Express, Request, Response, NextFunction } from 'express';
import { registerRoutes } from '../server/routes';
import type { Server } from 'http';
import fs from 'fs';

// Basic time formatter for tray title
function formatDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

// Keep the tray title compact; allow override via env if desired
const TRAY_TITLE_MAX_CHARS = parseInt(process.env.TRAY_TITLE_MAX_CHARS || '20', 10);
function truncateTrayTitle(raw: string): string {
  if (!raw) return '';
  const normalized = String(raw).replace(/\s+/g, ' ').trim();
  if (normalized.length <= TRAY_TITLE_MAX_CHARS) return normalized;
  return normalized.slice(0, Math.max(1, TRAY_TITLE_MAX_CHARS - 1)) + '…';
}

const isMac = process.platform === 'darwin';
const isDev = !app.isPackaged;
// Use a dedicated env var for API port to avoid conflicts with Vite dev server port
const API_PORT = parseInt(process.env.ELECTRON_API_PORT || '5002', 10);

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isRunning = false;
let hasActiveSession = false;
let sessionSeconds = 0;
let httpServerRef: Server | null = null;
let isQuitting = false;
let isQuitConfirmed = false;
let openAtLoginEnabled = false;
let preferRendererTrayTitle = false;

async function startExpressServer(port: number): Promise<Server> {
  const exp: Express = express();
  exp.use(express.json());
  exp.use(express.urlencoded({ extended: false }));

  // In production, serve the built frontend from the embedded Express server
  if (!isDev) {
    try {
      const staticDir = path.resolve(app.getAppPath(), 'dist', 'public');
      exp.use(express.static(staticDir));
      exp.get(/^(?!\/api\/).*/, (_req, res) => {
        res.sendFile(path.join(staticDir, 'index.html'));
      });
    } catch { }
  }

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
    const base = path.join(process.resourcesPath, 'dist-electron');
    const cjs = path.join(base, 'preload.cjs');
    const js = path.join(base, 'preload.js');
    return fs.existsSync(cjs) ? cjs : js;
  }
  // In dev, prefer a plain CJS preload for maximum compatibility
  const devCjs = path.join(process.cwd(), 'electron', 'preload.cjs');
  if (fs.existsSync(devCjs)) return devCjs;
  const distCjs = path.join(process.cwd(), 'dist-electron', 'preload.cjs');
  if (fs.existsSync(distCjs)) return distCjs;
  return path.join(process.cwd(), 'dist-electron', 'preload.js');
}

async function waitForFile(filePath: string, timeoutMs = 5000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      fs.accessSync(filePath);
      return;
    } catch { }
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
    // Load the app from the embedded Express server so relative /api requests work
    const appUrl = `http://localhost:${API_PORT}`;
    await mainWindow.loadURL(appUrl);
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
  tray.setTitle(truncateTrayTitle('00:00'));
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
      {
        label: 'Discard Session',
        enabled: hasActiveSession,
        click: () => {
          if (!mainWindow) return;
          mainWindow.webContents.send('tray:action', 'discardLastSession');
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
    mainWindow.show();
    mainWindow.focus();
    mainWindow.webContents.send('tray:action', 'show');
    setTimeout(() => tray?.setContextMenu(Menu.buildFromTemplate(buildMenu())), 0);
  });
}

function registerIpc() {
  ipcMain.on('timer:tick', (_event, payload: { elapsedSeconds: number }) => {
    if (!tray) return;
    if (preferRendererTrayTitle) return;
    const text = formatDuration(payload?.elapsedSeconds ?? 0);
    tray.setTitle(truncateTrayTitle(text));
  });

  ipcMain.on('timer:stateChanged', (_event, payload: { status: 'RUNNING' | 'PAUSED' | 'STOPPED' | 'IDLE'; sessionSeconds?: number; hasActiveSession?: boolean }) => {
    isRunning = payload?.status === 'RUNNING';
    hasActiveSession = payload?.hasActiveSession ?? (payload?.status === 'RUNNING' || payload?.status === 'PAUSED');
    sessionSeconds = payload?.sessionSeconds || 0;
    // Prefer renderer-provided combined title whenever not IDLE
    preferRendererTrayTitle = payload?.status !== 'IDLE';

    // When status becomes IDLE, reset tray title to show current time
    if (payload?.status === 'IDLE' && tray) {
      // Reset to basic time display when idle
      preferRendererTrayTitle = false;
    }
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
          { label: 'Discard Session', enabled: hasActiveSession, click: () => { if (!mainWindow) return; mainWindow.webContents.send('tray:action', 'discardLastSession'); } },
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

  ipcMain.on('tray:setTitle', (_event, payload: { title?: string }) => {
    try {
      if (!tray) return;
      const nextTitle = (payload && typeof payload.title === 'string') ? payload.title : '';
      // macOS supports text titles in the menu bar; set directly
      tray.setTitle(truncateTrayTitle(nextTitle));
      // Keep full value visible on hover
      try { tray.setToolTip(nextTitle); } catch { }
      preferRendererTrayTitle = true;
    } catch { }
  });

  ipcMain.on('app:quit', () => {
    // Trigger standard quit flow; confirmation is handled in app.before-quit
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
    try { await waitForFile(resolvePreloadPath(), 5000); } catch { }
  }
  await createWindow();
  if (isMac) createTray();
  registerIpc();

  // Optional: hide Dock icon when configured
  if (isMac && process.env.HIDE_DOCK === '1' && app.dock) {
    try { app.dock.hide(); } catch { }
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

app.on('before-quit', async (event) => {
  // Ask for confirmation once unless already confirmed
  if (!isQuitConfirmed) {
    event.preventDefault();
    try {
      const options = {
        type: 'question' as const,
        buttons: ['Quit', 'Cancel'],
        defaultId: 0,
        cancelId: 1,
        title: 'Quit TodoPlan',
        message: 'Do you want to quit?',
        detail: 'Any active timers will stop after you quit.',
        normalizeAccessKeys: true,
      };
      const result = mainWindow
        ? await dialog.showMessageBox(mainWindow, options)
        : await dialog.showMessageBox(options);
      const { response } = result;
      if (response === 0) {
        isQuitConfirmed = true;
        isQuitting = true;
        app.quit();
      }
    } catch { }
    return;
  }

  // Perform shutdown cleanup only when confirmed
  isQuitting = true;
  if (httpServerRef) {
    try { httpServerRef.close(); } catch { }
    httpServerRef = null;
  }
});


