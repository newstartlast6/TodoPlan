### TodoPlan → Electron migration plan

This plan converts the existing Vite + Express app into a desktop app using Electron, while keeping the current code structure. It includes a macOS menubar timer.

---

## High-level decisions

- **Keep Express server** initially and run it inside Electron main process, so renderer fetches the same `/api` routes. This minimizes refactors.
- **Use Vite for the renderer** (keep `client/` as-is), add an Electron main + preload bundle.
- **Use `vite-plugin-electron` + `electron-builder`** for dev and packaging.
- **Menubar timer (macOS)**: Start with renderer-driven updates via IPC to main (fastest path). Optionally evolve to main-owned timer service for windowless operation.
- **Security**: Use `contextIsolation: true`, `preload` to expose a minimal IPC surface. Disable `nodeIntegration` in renderer.

---

## Directory layout (proposed additions)

- `electron/`
  - `main.ts` (Electron main process: create window, start Express, Tray/menubar)
  - `preload.ts` (contextBridge API: timer IPC, app controls)
  - `icons/` (tray/app icons)

---

## Phase 0 – Prerequisites and environment

- [x] Confirm Node 18+ and pnpm/npm available
- [x] Confirm macOS dev machine for menu bar testing
- [x] Ensure current app builds: `npm run build`

---

## Phase 1 – Dependencies and scripts

- [x] Add dev/runtime deps

```bash
npm i -D electron vite-plugin-electron electron-builder @types/electron cross-env
```

- [x] Add Electron scripts in `package.json`
  - `dev:electron` – start Vite + Electron
  - `build:renderer` – Vite build (already present)
  - `build:electron` – bundle main/preload
  - `dist` – package with electron-builder

- [x] Add `build` config (electron-builder) in `package.json` with appId, mac target, icons

---

## Phase 2 – Main + Preload setup

- [x] Create `electron/main.ts`
  - [x] App lifecycle: `app.requestSingleInstanceLock()`, `app.whenReady()`
  - [x] Create `BrowserWindow` with `contextIsolation: true`, `preload: pathToPreload`
  - [x] Load renderer: dev → Vite URL, prod → `dist/public/index.html`
  - [x] Start Express server (import from `server/index.ts` or compose a small bootstrap that calls `registerRoutes(app)` and `server.listen`)
  - [x] Configure graceful shutdown

- [x] Create `electron/preload.ts`
  - [x] Expose minimal APIs with `contextBridge.exposeInMainWorld('electronAPI', { ... })`
  - [x] Timer IPC: `onTimerTick`, `setMenubarText`, `getApiBaseUrl`
  - [x] App controls: `showMainWindow`, `quit`, `openAtLogin:get/set`

- [x] Update `vite.config.ts`
  - [x] Add `vite-plugin-electron` to build `electron/main.ts` and `electron/preload.ts`
  - [x] Keep existing aliases and `root: client/`
  - [x] Ensure assets (e.g., `public/timer-worker.js`) are included

---

## Phase 3 – Express server integration

- [x] Decide port strategy
  - Dev: Vite uses 5173; let Express use 5002 (existing) or 1212
  - Prod: Keep Express listening on 5002 (inside app only)

- [x] Start server from Electron main
  - [x] Import `registerRoutes` and create server (like `server/index.ts` does)
  - [x] Disable Vite middleware in production
  - [x] Ensure `serveStatic` serves from `dist/public` only in non-Electron web mode (Electron window loads file directly)

- [x] Environment
  - [x] Provide `process.env.PORT` for server
  - [x] Provide `process.env.STORAGE_BACKEND` and `DATABASE_URL` if using Postgres; otherwise `MemStorage` is fine locally

---

## Phase 4 – Renderer wiring to API in Electron

- [x] Update `TimerApiClient` to resolve base URL dynamically
  - [x] Use `window.electronAPI?.getApiBaseUrl()` → `http://localhost:<PORT>/api`
  - [x] Fallback to `/api` for web

- [x] Validate `public/timer-worker.js` URL resolution in Electron
  - [x] Load via `new Worker(new URL('...', import.meta.url))` or absolute path from preload if needed

---

## Phase 5 – macOS menubar timer (Tray)

- [x] In `electron/main.ts`, create `Tray` after `app.whenReady()`
  - [x] macOS: use `tray.setTitle('00:00')` to show live time next to icon
  - [x] Provide context menu: Show/Hide window, Start/Pause/Stop, Quit
  - [x] Optional: Hide Dock icon while in menubar mode (`app.dock.hide()`) [via `HIDE_DOCK=1`]

- [x] IPC strategy: renderer-driven (Phase 5A: MVP)
  - [x] On each `timer:tick` in renderer, send `ipcRenderer.send('timer:tick', { elapsedSeconds })`
  - [x] In main, format elapsed and call `tray.setTitle(text)`
  - [x] Also update title on `start/pause/resume/stop`

- [ ] Optionally upgrade: main-owned timer service (Phase 5B: Robust)
  - [ ] Instantiate `shared/services/timer-service` in main
  - [ ] Renderer invokes timer actions via IPC; main updates tray independently of window
  - [ ] Main persists via existing `PersistenceService` or server routes

---

## Phase 6 – App UX details

- [x] Single-instance lock and deep links
- [x] Open at login (macOS): `app.setLoginItemSettings` exposed via preload
- [x] Minimize to tray/menubar: close-to-tray on macOS
- [ ] Notifications on timer stop/target reached
- [ ] Global shortcuts (optional): start/pause/stop

---

## Phase 7 – Packaging and notarization

- [x] `electron-builder` config
  - [x] `appId`, `mac` target `dmg`
  - [ ] Icons in `electron/icons` (icns, ico, png)
  - [ ] Hardened runtime entitlements for mac if distributing outside dev
  - [ ] Publish config (optional)

- [x] Build and test
  - [x] `npm run build` (renderer) then `npm run dist`
  - [x] Verify tray, timer, API calls, persistence

- [ ] macOS notarization (if distributing)
  - [ ] Apple ID and notarization config in `electron-builder`

---

## Detailed task checklist

- [x] Add Electron + plugins deps and scripts
- [x] Create `electron/main.ts` and `electron/preload.ts`
- [x] Integrate `vite-plugin-electron` into `vite.config.ts`
- [x] Start Express from main at fixed port; wire graceful shutdown
- [x] Expose `getApiBaseUrl` via preload; update `TimerApiClient`
- [x] Implement menubar Tray with live timer text (renderer-driven IPC)
- [x] Add context menu actions (Show/Hide, Start/Pause/Stop, Quit)
- [ ] Optionally hide Dock icon on mac
- [ ] Validate web worker asset paths
- [ ] Add `electron-builder` config and icons
- [x] Build, QA checklist, and smoke tests

---

## Example script additions (sketch)

Add to `package.json` scripts:

```json
{
  "scripts": {
    "dev:electron": "cross-env PORT=5002 vite",
    "dist": "npm run build && electron-builder"
  }
}
```

Note: `vite-plugin-electron` will spawn Electron during `vite` dev automatically when configured.

---

## IPC surface (initial)

- Renderer → Main
  - `timer:tick` { elapsedSeconds }
  - `timer:stateChanged` { status }

- Main → Renderer
  - `tray:action` (e.g., start/pause/stop clicked from menu)

---

## QA checklist

- [x] Timer runs and tray text updates every second on macOS
- [x] Start/Pause/Resume/Stop reflect immediately in tray and UI
- [x] App can be closed to tray and timer continues (current window hidden)
- [x] App relaunch recovers active session and tray shows correct time
- [x] API routes work locally (MemStorage) and with Postgres when configured
- [x] Build artifacts run on macOS

---

## Troubleshooting

- Preload “Cannot use import statement outside a module”
  - Ensure the preload bundle is built as CommonJS and that `BrowserWindow` points to a `.cjs` file.
  - We emit `dist-electron/preload.cjs` and `electron/main.ts` resolves to `preload.cjs` when present.
  - After rebuild, fully restart the Electron app so it loads the updated preload.

- Tray title not updating / tray actions do nothing
  - This happens if preload failed to load (no `window.electronAPI`). Fix preload first, then restart the app.
  - Verify in DevTools: `typeof window.electronAPI === 'object'`.

## Future improvements

- Migrate from renderer-driven timer to main-owned timer for robustness
- Replace HTTP calls with IPC to storage/services directly (remove Express)
- Add global shortcuts and notifications
- Add auto-updater (electron-updater)


