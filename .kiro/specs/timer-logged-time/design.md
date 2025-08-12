## Timer Logged Time: UI and Persistence Plan

### Goals
- Show each task’s logged time near the task title/notes in `SelectableTodoItem` and in the task detail panel.
- Show the total time logged for the day underneath the progress label (e.g., “29% • 7 tasks”) in Day view and in each Day card of Week view.
- Update day totals live while the timer is running, without per-second API calls.
- Persist per-task logged time in the database so that when a task loads, its logged time is available.

### Current State (as discovered)
- Data model
  - `timer_sessions` table exists and stores `task_id`, `start_time`, `end_time`, `duration_seconds`, `is_active`.
  - Migrations also mention a materialized view `daily_time_summaries` (not yet integrated in server code).
  - No stored per-task aggregate logged time; totals are derived from `timer_sessions`.
- Server API
  - `GET /api/timers/daily` returns a date’s breakdown by task and `totalSeconds`, computed from completed sessions.
  - `GET /api/timers/active` returns the current active session.
  - No endpoint that returns all-time per-task totals or a multi-day range summary.
- Client
  - `TimerContext` keeps `dailySummary` and `totalDailySeconds` based on server `GET /api/timers/daily` result. This excludes the active, still-running seconds.
  - `useTaskTimer(taskId)` adds active session seconds to a task’s daily total locally.
  - Day/Week views show percent and task count, but not day total time.
  - `SelectableTodoItem` has an optional `showLoggedTime` prop (hidden by default in Day/Week views).

### Architecture Decisions
1) Source of truth
   - Keep `timer_sessions` as the canonical event log.
   - Persist per-task all‑time total directly on the `tasks` row to satisfy “stored with each task”.

2) Persisted aggregates
   - Extend `tasks` table: add `time_logged_seconds` (int/bigint, default 0, not null).
     - Updated transactionally when a session is finalized (stop/switch; pause if we persist endTime).
   - Optional (if needed later for performance): `task_daily_totals(task_id, date, total_seconds, session_count)` to avoid heavy day-range aggregation. For now, compute daily from `timer_sessions`.
   - Cross-midnight sessions: split duration across dates for daily computation; all‑time sum still updates once on the task row.

3) Server API additions
   - `GET /api/timers/task/:id` → return per-task totals from `tasks.time_logged_seconds` and today’s seconds derived from `timer_sessions`.
   - `GET /api/timers/daily-range?start=YYYY-MM-DD&end=YYYY-MM-DD` → list per-day totals to power Week view; computed from `timer_sessions` (no new table required initially).
   - Keep `GET /api/timers/daily` for focused single-day scenarios.

4) Live updates without per-second network calls
   - Do not poll server while timer runs.
   - On `timer:tick` events, compute live values on the client by adding `activeSession.durationSeconds` to:
     - The active task’s displayed daily total (`useTaskTimer` already handles this).
     - The day’s total in Day/Week views for Today only.
   - On pause/stop/switch: sync events (already queued via `PersistenceService`/`SyncService`) and refresh daily summaries opportunistically.

5) UI additions and behavior
   - `SelectableTodoItem` (Day/Week views): show a subtle row beneath the title/notes with a clock icon and the task’s “Time Logged Today” (e.g., `1h 20m`).
     - Use mono font, 12px text, muted color.
     - Show when `total > 0` to remain minimalistic; optionally show `0:00` when the task is active to reinforce feedback.
   - Day view header (“29% • 7 tasks”): add a second line right below, “Total logged: {formatted hh:mm}”. Updates live if the active session belongs to today.
   - Week view Day cards: under the “{percent} • {N} tasks” label, add the same “Total logged: …” line for that day. Only Today updates live client-side; past/future days rely on persisted aggregates.
   - Task detail panel: keep “Time Logged Today”. Add “All time logged” from `tasks.time_logged_seconds` for long-term feedback.

6) Performance and efficiency
   - Only network on state transitions: start/pause/resume/stop/switch and periodic sync batches.
   - Compute live seconds locally using Background Worker; never POST per tick.
   - Batch and debounce any UI-driven refreshes of summaries at safe intervals (e.g., after stop or every few minutes when visible).

7) Edge cases
   - Cross-midnight sessions: split duration into constituent days during finalize/stop.
   - Timezone: normalize on server using UTC for storage; derive per-day using server TZ or user-configured TZ.
   - Deleted tasks: cascades from `tasks` should delete `timer_sessions` and aggregator rows.
   - Unscheduled tasks: totals still tracked; UI shows logged time even if not on a date slot.

### Data Model Sketch
- `tasks(..., time_logged_seconds BIGINT NOT NULL DEFAULT 0)`
- `timer_sessions(task_id, start_time, end_time, duration_seconds, is_active, ...)`
- (Optional later) `task_daily_totals(task_id, date, total_seconds, session_count, updated_at, PK(task_id, date))`

Indexes
- Existing `timer_sessions` indexes retained (`task_id`, `start_time`, `is_active`).

### Server Responsibilities
- On stop (and on pause if endTime becomes non-null and session is persisted):
  - Compute finalized elapsed for the active session.
  - Update `tasks.time_logged_seconds += session_delta` in the same transaction that finalizes the `timer_sessions` row.
  - For daily endpoints, compute day totals by summing `timer_sessions` within date bounds (split cross-midnight as needed).
- Expose read endpoints for per-task totals and daily-range summaries.
- Maintain existing `GET /api/timers/daily` for simple daily queries.

### Client Responsibilities
- Display per-task daily logged time in `SelectableTodoItem` (enabled by default in Day/Week views; compact, muted).
- Display total logged time under progress labels in Day/Week views.
- Live update calculations for Today using `activeSession.durationSeconds` locally.
- On stop/switch, request fresh summaries to sync with persisted aggregates.

### Verification Strategy (maps to acceptance criteria)
1) Per-task logged time is displayed and persisted
   - Start/stop timers across sessions; reload app → per-task “All time logged” and “Today” visible in detail panel; “Today” also visible inline for Day/Week.
   - Check `tasks.time_logged_seconds` updates and persists after stop/switch; daily endpoints reflect correct totals from `timer_sessions`.

2) Day totals update live while running
   - Start a timer on Today; observe Day view and Today’s card in Week view update the total every second without network calls.
   - Pause/Stop → totals remain and match persisted values after a lightweight refresh.

3) Persistence after pause/stop and visibility in detail + list
   - Pause/stop multiple times; totals accumulate and are immediately shown. Navigate away/back; values remain.

4) Efficient API usage
   - Confirm no per-second HTTP. Only transitions and periodic background sync occur.
   - Use range endpoint for Week (single request) rather than 7 individual daily calls.

5) Edge conditions
   - Cross-midnight split validated by tests; totals for two days reflect proper allocation.
   - Deleted tasks remove aggregates.

### Rollout Steps
- Migration to add `time_logged_seconds` to `tasks` and backfill by aggregating existing `timer_sessions`.
- Server updates: finalize path increments `tasks.time_logged_seconds`; add per-task and daily-range read endpoints.
- Client UI tweaks for Day/Week and `SelectableTodoItem` default display of logged time.
- Add tests (server: aggregation and routes; client: live updates and rendering).

### UI Notes
- Minimalist style: small muted text, mono font for durations, subtle separators, avoid visual clutter.
- Accessibility: preserve semantics (labels, aria-live for changing totals not required; visuals update only).


