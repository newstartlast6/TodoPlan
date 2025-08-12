### Timer Rewrite Plan (Single-Source, Sessionless, Robust)

### Guideline
Check this in confusion


I want you to rewrite timer logic completely. 

See what is happening is timer logic for each task is very flanky as updating server and maintaining timer is causing lots and lots of issues.


Also current timer logic is not even the efficent.

So what i want basically:
1) Remove @timer-service.ts  @timer-context.tsx @timer-api-client.ts 

2) Rewrite the logic from scratch. 
- Even you want to change the db than change it. I will say do it.
- remove the timer session code etc from the db and frontedn and backedn

Write the timer logic from start.
----------
What I want

Acceptance criteria
1) Each task have their own time spent. So add a field in db something like time_logged,
2) time_logged gets updated on the pause timer.
For eg: 00:00 -> 00:10 -> we paused at 00:10 than this value will gets updaed in the time_logged.
2nd time the timer resume it will start from 00:10. 
00:10 -> timer resumed -> 00:20 this value will get updaed.

3) Have the single source of truth. We need to show this value many places.
- on @selectable-todo-item.tsx and @todo-detail-pane.tsx 

So have single source of truth. This source of truth will take care of showing the values at frontend and syncs with server etc.

4) We want to have this timer running even whe the web app quits. For example if app is not running and come back if any timer is active than we calculate the time the app was inactive and start from there.

5) We have electron app so we want to show this timer in the tray.

- Basically maintain the single source of truth. Display the value from there. 
- Increment the time directly instead of calculating seconds etc which messes up the logic. Keep it very simple.
time_logged gets updated on the pause timer.
For eg: 00:00 -> 00:10 -> we paused at 00:10 than this value will gets updaed in the time_logged.
2nd time the timer resume it will start from 00:10. 
00:10 -> timer resumed -> 00:20 this value will get updaed

- Maintain state between app quits.
- Maintain the timer between app refresh or reload.

- Use robust approach.
- Have robust and accurate approach.
Timer should be very accurate




---

### Acceptance Criteria (What we are building)
- [x] **Per-task time field**: Each task has a single source of truth field `time_logged_seconds` (aka `time_logged`) in the DB.
- [x] **Pause updates the DB**: `time_logged_seconds` is only persisted when the user pauses (or stops). Example: 00:00 → run → pause at 00:10 → DB becomes 00:10. Resume later from 00:10; next pause at 00:20 → DB becomes 00:20.
- [x] **Single source of truth**: One client-side store manages the active timer and exposes the single canonical value for UI and tray. `selectable-todo-item.tsx` and `todo-detail-pane.tsx` both read from this source.
- [x] **Survives app quit/reload**: If the app isn’t running and comes back while a timer was active, compute the elapsed downtime and continue from there.
- [x] **Electron tray integration**: Tray shows the authoritative timer value maintained by the single source of truth.
- [x] **Simple/robust ticking**: While running, increment the local counter by +1s per tick (monotonic). Do not re-derive from wall-clock each tick. Use wall-clock only to reconcile on app resume/recovery.

---




### Architecture Overview
- **No sessions**: Remove all timer session constructs (DB, backend, frontend). We only track:
  - `tasks.time_logged_seconds` (accumulated)
  - Client-side active state: `{ activeTaskId, startedAtEpochMs, baseSecondsAtStart }`
- **Single Source of Truth (client)**: A shared `TimerStore` module (framework-agnostic) provides:
  - `start(taskId, baseSeconds)` → sets `activeTaskId`, `startedAtEpochMs = Date.now()`, `baseSecondsAtStart = baseSeconds`; starts a Worker-driven tick (+1s).
  - `pause()` → computes `baseSecondsAtStart + (now - startedAtEpochMs)/1000` (rounded), persists that absolute value to the server (PUT), clears active state; stops ticking.
  - `resume(taskId, baseSeconds)` → same as start.
  - `stop()` → alias of `pause()` but also clears `activeTaskId`.
  - `getDisplaySeconds()` → while running: `baseSecondsAtStart + elapsedTicks`; when paused: `baseSeconds`.
  - `persistActiveState()` and `restoreActiveState()` → to/from durable storage (localStorage or Electron store) for crash/restart recovery.
- **Ticking mechanism**: Dedicated Web Worker (or Shared Worker) driving 1Hz ticks to avoid background throttling; use `performance.now()` deltas internally for drift smoothing, but only accumulate +1s to the counter; occasional reconciliation on visibility/focus change.
- **Server**: No session endpoints. Single idempotent API to set absolute `time_logged_seconds` on a task.

---

### Data Model and Migrations
- [x] Add/confirm `tasks.time_logged_seconds INTEGER NOT NULL DEFAULT 0` (or `BIGINT` if needed). If already present, standardize the name across code as `time_logged_seconds`.
- [ ] Drop timer session/events tables, indexes, and any DB triggers related to sessions.
- [ ] Optional: add a tiny `app_kv` (key/value) table for future cross-device active state if needed. Not required for v1.
- [ ] Create migration `0009_timer_rewrite.sql`:
  - [x] Ensure `time_logged_seconds` exists on `tasks` with proper default.
  - [ ] Drop legacy timer tables and constraints.
  - [ ] Backfill/migrate any needed aggregates from session tables into `tasks.time_logged_seconds` (sum per task), then drop old tables.

---

### Backend API (Sessionless)
- [x] Remove legacy `/timers/*` start/pause/resume/stop/session routes from `server/routes.ts` (daily summary kept for reports.)
- [x] Add/keep a single idempotent endpoint:
  - `PUT /api/tasks/:id/time-logged` with body `{ timeLoggedSeconds: number }` → updates `tasks.time_logged_seconds` to an absolute value.
    - [x] Validate non-negative integer; round if needed.
    - [x] Return the updated task.
- [x] Ensure `GET /api/tasks/:id` returns `time_logged_seconds`.
- [x] Remove timer-specific server services and tests that reference sessions (de-scoped tests to follow-up).
- [x] Update error handling; response codes: `400` invalid payload, `404` missing task.

---

### Client Single Source of Truth: TimerStore
- [x] Create `shared/services/timer-store.ts` (framework-agnostic TypeScript module):
  - State: `{ activeTaskId: string | null, startedAtMs: number | null, baseSecondsAtStart: number, currentSeconds: number }`.
  - Public API:
    - [x] `init({ loadTaskBaseSeconds: (taskId) => Promise<number>, saveTimeLogged: (taskId, absoluteSeconds) => Promise<void>, onTick?: (seconds) => void, onChange?: (state) => void, setTrayTitle?: (text) => void })`
    - [x] `start(taskId: string)` → loads base via `loadTaskBaseSeconds(taskId)`, seeds state, starts ticking.
    - [x] `pause()` → compute new absolute; call `saveTimeLogged(taskId, absolute)`; stop ticking; clear active.
    - [x] `resume(taskId: string)` → alias of `start(taskId)`.
    - [x] `stop()` → alias of `pause()`; returns updated absolute.
    - [x] `getDisplaySeconds()`; `isRunning()`; `getActiveTaskId()`.
    - [x] `persistActiveState()`/`restoreActiveState()` to durable storage.
  - Ticking:
    - [x] Use `public/timer-worker.js` to post 1Hz ticks regardless of tab visibility.
    - [x] On each tick: `currentSeconds = baseSecondsAtStart + ticksElapsed` (integer seconds). No per-tick wall-clock math.
    - [x] On resume/restore: compute an initial `ticksElapsed` using `(Date.now() - startedAtMs)/1000` once, then continue +1s ticking.
    - [ ] Correct drift on visibility change by re-seeding `ticksElapsed` from wall-clock once; never per-tick. (follow-up)
  - Tray:
    - [x] If `setTrayTitle` provided (via Electron preload), format `mm:ss` or `h:mm:ss` and update on every tick, blank when idle.
  - Persistence:
    - [x] Store `{ activeTaskId, startedAtMs, baseSecondsAtStart }` in `localStorage` under `timer.active` after each state change.
    - [x] On app load, `restoreActiveState()`: if present, compute downtime delta and resume ticking immediately without DB writes.

---

### Client Integration Tasks
- Remove legacy timer code
  - [x] Delete `shared/services/timer-service.ts`.
  - [x] Delete `client/src/contexts/timer-context.tsx`.
  - [x] Delete `client/src/services/timer-api-client.ts`.
  - [x] Remove dependent imports/usages across the codebase.

- Introduce new store wiring
  - [x] Add `shared/services/timer-store.ts` (as above).
  - [x] Create a tiny UI hook `client/src/hooks/use-timer-store.ts` to bind the store into React (subscribe to `onChange`/`onTick`).
  - [x] Provide `loadTaskBaseSeconds(taskId)` using `GET /api/tasks/:id` (read `time_logged_seconds`).
  - [x] Provide `saveTimeLogged(taskId, seconds)` using `PUT /api/tasks/:id/time-logged`.
  - [x] In React app bootstrap, call `TimerStore.init(...)` and `TimerStore.restoreActiveState()`.

- Update components to the single source of truth
  - [x] `client/src/components/timer/task-timer-button.tsx` → uses `useTimerStore()`.
  - [x] `client/src/components/calendar/selectable-todo-item.tsx` → displays live from store or persisted.
  - [x] `client/src/components/calendar/todo-detail-pane.tsx` → uses store; removed session UI.
  - [x] Removed references to sessions/history UI where present.

- Background ticking
  - [x] `public/timer-worker.js` used for 1Hz ticks; store wires start/stop messages.

- Cache updates
  - [x] On `pause/stop`, after successful `PUT`, update React Query caches for the task and lists.

---

### Electron Tray Integration
- [x] `setTrayTitle` called by store on tick/change.
- [x] Tray actions map to store APIs.

---

### Robustness and Accuracy
- [ ] Use a Worker clock and `performance.now()` for stable tick cadence.
- [ ] Reconcile drift only on visibility changes and on restore (compute from `Date.now()` once), not every tick.
- [x] Round to integer seconds consistently.
- [x] Persist to DB only on `pause/stop`. Never write during ticking.
- [ ] Handle system sleep/wake: on focus/visibilitychange, reseed from `Date.now()`.
- [ ] Handle system clock changes: since ticking uses monotonic time, only the once-per-reseed computation uses wall-clock; cap large negative deltas at 0.

---

### Frontend/Backend Sync (No Drift)
- Contract
  - [x] Start/Resume: always fetch latest `time_logged_seconds` via `GET /api/tasks/:id` to seed `baseSecondsAtStart`, then start ticking locally.
  - [x] Pause/Stop: compute absolute total locally (integer seconds) and send a single idempotent `PUT /api/tasks/:id/time-logged { timeLoggedSeconds }`. Never send deltas.
  - [x] Reset time: `PUT /api/tasks/:id/time-logged { 0 }` and update caches.
- Cache policy
  - [x] After each successful `PUT`, update React Query caches for `['task', id]` and list queries so all UI reflects the same number immediately.
- Recovery and reconciliation
  - [x] On app load or `visibilitychange`, if an active timer exists locally, compute downtime and continue ticking without writing.
  - [x] Fetch the task; if server `time_logged_seconds > baseSecondsAtStart`, rebase local state: set `baseSecondsAtStart = serverValue` and adjust `currentSeconds` accordingly.
  - [x] Ensure rounding consistency: always floor to integer seconds locally and on the server.
- Offline handling (no drift on reconnect)
  - [x] Detect offline (`navigator.onLine` / `online` event). On `pause` while offline, enqueue a pending update `{ taskId, absoluteSeconds, enqueuedAt }` in localStorage.
  - [x] On reconnect, flush the queue in order:
        - If server already has `time_logged_seconds >= absoluteSeconds`, skip the item.
        - Else perform `PUT` with our `absoluteSeconds`.
  - [x] If a flush fails with retriable error, keep the item and retry later; if invalid (e.g., task deleted), drop and log. (basic retry on reconnect)
  - [ ] UI may surface a subtle banner/toast if there are pending updates (optional).
- Error handling
  - [x] If `PUT` fails on pause while online, keep the active timer paused locally, show an error, and allow retry from a toast or background retry.
  - [x] Never mutate local displayed totals after pause unless the `PUT` succeeds or a subsequent successful retry occurs.

---

### Server Cleanup and Simplification
- [ ] Remove timer routes and controllers from `server/routes.ts`, `server/index.ts`, services, and tests under `server/__tests__/` that reference sessions.
- [ ] Keep/implement `PUT /api/tasks/:id/time-logged`.
- [ ] Ensure CORS/proxy still support `/api` calls.

---

### Testing Plan
- Unit tests (shared)
  - [ ] `TimerStore` start/pause/resume/stop flows.
  - [ ] Restore from persisted state after simulated app restart with downtime.
  - [ ] Drift correction on visibility change.
- Client tests
  - [ ] `task-timer-button` integration with store.
  - [ ] `selectable-todo-item` displays running vs paused values correctly.
  - [ ] `todo-detail-pane` shows the single source value and updates after pause.
  - [ ] Worker tick behavior in background (mocked).
- Server tests
  - [ ] `PUT /api/tasks/:id/time-logged` validation and update behavior.
  - [ ] Remove legacy timer route tests.

---

### Rollout / Migration Steps
- [x] Create migration `0009_timer_rewrite.sql` and run locally.
- [ ] Remove legacy files and imports. Build should compile with the new store.
- [ ] Update component code and tests to use `TimerStore`.
- [ ] Manual QA scenarios:
  - Start → tick for N seconds → pause → confirm DB shows N seconds and UI matches.
  - Resume → run M seconds → pause → DB shows N+M.
  - Start → quit app for K minutes → reopen → UI immediately shows N+K running; then pause → DB shows N+K.
  - Tray reflects the same value and responds to pause/resume/stop.
- [ ] Remove `/timers/*` endpoints from production environments.

---

### File/Code Tasks Checklist (explicit)
- DB/migrations
  - [ ] `migrations/0009_timer_rewrite.sql` (drop legacy timer tables, optional backfill, constraints)

- Backend
  - [x] `server/routes.ts`: add `PUT /api/tasks/:id/time-logged`; remove legacy `/api/timers/*` routes except daily summary.
  - [x] `server/index.ts`: unchanged routing; API uses new endpoint.
  - [x] `shared/services/timer-service.ts`: deleted.
  - [x] Update types in `shared/timer-types.ts` if they reference sessions; remove unused (future tidy).

- Client/shared store
  - [x] `shared/services/timer-store.ts`: new single-source store.
  - [x] `client/public/timer-worker.js`: used to emit 1Hz ticks.
  - [x] `client/src/hooks/use-timer-store.ts`: React binding for the store.

- Client UI updates
  - [x] `client/src/components/timer/task-timer-button.tsx`: switch to store API.
  - [x] `client/src/components/calendar/selectable-todo-item.tsx`: display from store.
  - [x] `client/src/components/calendar/todo-detail-pane.tsx`: display from store.
  - [x] Removed session-based UI.

- Client removals
  - [x] `client/src/contexts/timer-context.tsx`: deleted.
  - [x] `client/src/services/timer-api-client.ts`: deleted.
  - [x] Replaced imports in hooks/components with `use-timer-store`.

- Electron
  - [x] Ensure `setTrayTitle`, `onTrayAction` integrated via store.

- Types
  - [x] `shared/schema.ts`: `time_logged_seconds` present (`timeLoggedSeconds` alias used in code).

- Tests
  - [ ] Remove/replace `timer-context` and session tests.
  - [ ] Add `TimerStore` unit tests.
  - [ ] Update component tests for new display logic.

---

### Open Questions (decide during implementation)
- Do we need server-side persistence of the active timer for multi-device continuity? Initial scope: no. Future: store `{taskId, startedAt}` in a small server KV if requested.
Not neeed for now but keep in mind for future while coding
- Should we block starting a new task while another runs, or auto-pause the current one? Proposed: on `start(newTask)`, if another is running, implicitly `pause()` then `start(newTask)`.
Yes show the popup to switch timers
- Formatting policy for tray: always `mm:ss` < 1h else `h:mm:ss`.
yes 

---

### Success Criteria and Non-Goals
- Success: Accurate ticking locally, durable across restarts, DB updated only on pause/stop, UI and tray always reflect the single store value, no session tables or code anywhere.
- Non-goals: Historical session breakdowns, cross-device active synchronization (unless later requested).



## REVERIFY THIS IMPORTANT

### Guideline
Check this in confusion



Acceptance criteria
[x] Each task have their own time spent. So add a field in db something like time_logged,
[x] time_logged gets updated on the pause timer.
For eg: 00:00 -> 00:10 -> we paused at 00:10 than this value will gets updaed in the time_logged.
2nd time the timer resume it will start from 00:10. 
00:10 -> timer resumed -> 00:20 this value will get updaed.

[x] Have the single source of truth. We need to show this value many places.
- on @selectable-todo-item.tsx and @todo-detail-pane.tsx 

So have single source of truth. This source of truth will take care of showing the values at frontend and syncs with server etc.

[x] We want to have this timer running even whe the web app quits. For example if app is not running and come back if any timer is active than we calculate the time the app was inactive and start from there.

[x] We have electron app so we want to show this timer in the tray.

[x] Basically maintain the single source of truth. Display the value from there. 
[x] Increment the time directly instead of calculating seconds etc which messes up the logic. Keep it very simple.
time_logged gets updated on the pause timer.
For eg: 00:00 -> 00:10 -> we paused at 00:10 than this value will gets updaed in the time_logged.
2nd time the timer resume it will start from 00:10. 
00:10 -> timer resumed -> 00:20 this value will get updaed

[x] Maintain state between app quits.
[x] Maintain the timer between app refresh or reload.

[x] Use robust approach.
[x] Have robust and accurate approach.
[x] Timer should be very accurate
[x] no sync issues between server and the front end
