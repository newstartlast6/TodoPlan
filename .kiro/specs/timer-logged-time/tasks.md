## Timer Logged Time — Task Breakdown

### Database
- [ ] Add `time_logged_seconds BIGINT NOT NULL DEFAULT 0` to `tasks`.
- [ ] Backfill job: aggregate per-task all-time seconds from `timer_sessions` into `tasks.time_logged_seconds`.
- [ ] (Optional later) Create `task_daily_totals` for performance if day-range queries become heavy.

### Server
- [ ] In timer stop/pause finalize path, update aggregates in a transaction:
     - Update `timer_sessions` with `end_time`, `duration_seconds`, `is_active=false`.
     - Update `tasks.time_logged_seconds += session_delta` for the affected `task_id`.
- [ ] New endpoints:
     - [ ] `GET /api/timers/task/:id` → `{ allTimeSeconds: tasks.time_logged_seconds, todaySeconds, sessionCountToday }` (today derived from `timer_sessions`).
     - [ ] `GET /api/timers/daily-range?start=YYYY-MM-DD&end=YYYY-MM-DD` → array of `{ date, totalSeconds }` computed from `timer_sessions`.
- [ ] Unit tests for: task total increment, cross-midnight split logic for daily computation, new routes.

### Client — State
- [ ] Extend `TimerContext.loadDailySummary()` to optionally use the range endpoint for Week view; store a map keyed by date.
- [ ] Ensure `useTaskTimer(taskId)` continues to add `activeSession.durationSeconds` when task is active.
- [ ] Add a derived selector/hook `useDayTotal(date)` that returns `{ totalSeconds, formattedTotal }` and adds live active seconds when `date` is today.

### Client — UI
- Day View (`client/src/components/calendar/day-view.tsx`)
  - [ ] Under the “{percent} • {N} tasks” label, render a small secondary line: `Total logged: {formatted}`.
  - [ ] Use `useDayTotal(currentDate)` for live updates when timer runs today.
  - [ ] Keep layout clean and compact (muted text, mono font, xs size).

- Week View (`client/src/components/calendar/week-view.tsx`)
  - [ ] For each day card, under “{percent} • {N} tasks”, show `Total logged: {formatted}`.
  - [ ] For the current day, include live seconds (like Day View); for other days, show persisted totals.
  - [ ] Fetch week range once via the daily-range endpoint.

- Selectable Todo Item (`client/src/components/calendar/selectable-todo-item.tsx`)
  - [ ] Default `showLoggedTime=true` for Day and Week variants; keep minimal style.
  - [ ] Render a short row with clock icon and `taskTimer.formattedTotalTime` if `> 0`, or show while active.

- Todo Detail Pane (`client/src/components/calendar/todo-detail-pane.tsx`)
  - [ ] Display “Time Logged Today” (existing) and add “All time logged” from `GET /api/timers/task/:id` (`tasks.time_logged_seconds`).
  - [ ] Refresh these on stop/switch or when pane becomes visible.

### Efficiency
- [ ] Do not issue per-second HTTP while timer runs; compute live view locally.
- [ ] Trigger refresh of summaries only on transitions (pause/stop/switch) and periodic background sync.

### QA / Acceptance
- [ ] Each task shows its own logged time in list item and detail pane and values persist after reload.
- [ ] Day totals under “{percent} • {N} tasks” update live for Today and match DB after stop.
- [ ] Week view shows totals for each day; Today updates live, others reflect persisted data.
- [ ] API calls are limited to transitions and periodic sync; no per-second requests.
- [ ] Cross-midnight sessions allocate time across days correctly.


