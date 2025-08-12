## Plan View (Modern Lists-to-Calendar Planning)

This document outlines the tasks to add a modern, minimalistic “Plan” experience: see all Lists and their Todos in a left planning panel and drag-and-drop tasks onto Today, Week, and Month views to schedule or reschedule quickly.

### Objectives
- Provide a clean planning panel showing all Lists and their Todos in a compact list view.
- Enable drag-and-drop from the Plan panel to calendar days (Day/Week/Month) to schedule.
- Allow drag-and-drop between dates to reschedule.
- Offer quick access to the Plan panel via the sidebar and calendar header.

### User Stories (DoD attached to each section below)
- As a user, I can open a Plan panel from the sidebar or within Calendar and see all my lists and todos.
- As a user, I can drag any todo from the Plan panel into a day in Week view or Day view Today to schedule it.
- As a user, I can move tasks between days by dragging.
- As a user, I can unschedule tasks by dragging them back to the Plan panel or to an “Unscheduled” bucket.
- As a user, I can keep my planning workflow minimalistic, modern, and fast.

---

### 1) Navigation & Entry Points
- [x] Add a “Plan” toggle in `MinimalisticSidebar` (third icon) that toggles the Plan panel within Calendar.
- [x] Add a “Plan” button in `client/src/pages/calendar.tsx` header to open/close the Plan panel.
- [x] Persist open/closed state (localStorage) so the panel state survives reloads.
- [x] DoD: From both the sidebar and the calendar header, I can open/close the Plan panel. State persists across sessions.

### 2) Planning Panel UI (Clean, Minimalistic)
- [x] Create `client/src/components/planning/plan-panel.tsx`.
  - [x] Show all Lists (emoji + name) as collapsible sections.
  - [x] Under each List, render its Todos in a compact list view (use existing `SelectableTodoItem` with `variant="list"` or a new minimal variant).
  - [x] Include a lightweight search/filter at top (by text; optional filters for priority/completed).
  - [x] Indicate unscheduled tasks (no `scheduledDate`) with a subtle badge.
  - [x] Keep design modern: white/neutral background, soft borders, subtle hover, rounded corners, calm spacing.
- [x] Place Plan panel left of the calendar main content (width ~320px), separate from the minimalistic app sidebar.
- [x] Add empty states and loading skeletons.
- [x] DoD: I see all lists and tasks, can collapse lists, and can visually tell which tasks are unscheduled.

### 3) Data Model & Scheduling Rules
- [x] Use `tasks.scheduledDate` (already present) as the date-only plan anchor.
- [x] Define scheduling behavior:
  - [x] Scheduling to a day sets `scheduledDate = droppedDate` without changing `startTime`/`endTime` if present.
  - [x] If the task has no meaningful time, keep time hidden in views and display it as “Untimed” for that day.
  - [x] Moving between days updates `scheduledDate` accordingly.
  - [x] Unscheduling clears `scheduledDate` (set to null) by dropping into an “Unscheduled” section in Plan panel.
- [x] DoD: Clear rules documented in code comments and applied uniformly across Day/Week/Month views.

### 4) API/Server Updates
- [x] Update GET `/api/tasks` to include `scheduledDate` filtering when `startDate`/`endDate` are provided:
  - [x] Return tasks where `start_time` is in range OR `scheduled_date` is in range.
  - [x] Add query flag `includeUnscheduled=true` to return tasks with `scheduled_date IS NULL` (for Plan panel if needed).
- [x] Ensure PUT `/api/tasks/:id` supports updating `{ scheduledDate }` (already allowed by `updateTaskSchema`).
- [x] Migration/Index:
  - [x] Create an index on `tasks.scheduled_date` for fast range queries.
  - [x] Verify `migrations/0006_add_scheduled_date.sql` has been applied; add a new migration for the index if missing.
- [x] DoD: Server returns tasks filtered by either planned date or start time; scheduling updates are persisted.

### 5) Client Data & Hooks
- [x] Add `useAllListsWithTasks` hook or extend existing hooks:
  - [x] Fetch all lists (`useLists`).
  - [x] Fetch all tasks once (`/api/tasks?includeUnscheduled=true` when Plan is open).
  - [x] Group tasks by `listId`; expose derived sets: `unscheduled`, `scheduledByDate`.
- [x] Add lightweight client-side search/filter state for the Plan panel.
- [x] Ensure existing mutations (`useUpdateTask`) cover `scheduledDate` updates with optimistic UI and undo.
- [x] DoD: Plan panel has responsive, cached data with optimistic updates on schedule/move.

### 6) Drag & Drop (react-dnd)
- [x] Add `DndProvider` (HTML5 + touch backends) at calendar root.
- [x] Make each task in Plan panel a draggable item:
  - [x] Drag payload: `{ taskId, source: 'plan-panel' }`.
- [x] Make Day/Week/Month day containers droppable:
  - [x] Drop target accepts type `TASK`.
  - [x] On drop, call `useUpdateTask` with `{ scheduledDate: dropDate }`.
  - [x] Visual drop feedback: highlight day card, show subtle guideline.
- [x] Enable dragging tasks between days (drag from within Day/Week views):
  - [x] Make rendered tasks draggable with payload `{ taskId, source: 'calendar', fromDate }`.
  - [x] On drop to a different day, update `scheduledDate`.
- [x] Add drag to “Unscheduled” bucket in Plan panel to clear `scheduledDate`.
- [x] Keyboard fallback: context menu options: Move to Today/Tomorrow/Next week.
- [x] DoD: DnD works with mouse and touch; accessible fallback is available.

### 7) Calendar Views Integration
- [x] Day view (`day-view.tsx`):
  - [x] Include tasks where `isSameDay(task.startTime, day)` OR `task.scheduledDate === day`.
  - [x] Render untimed (scheduled) tasks in the list with time hidden.
  - [x] Make day container droppable; enable intra-day drag between other days.
- [x] Week view (`week-view.tsx`):
  - [x] For each day, include `startTime OR scheduledDate` matches.
  - [x] Day cards droppable; enable moving tasks between days via DnD.
- [x] Month view (`month-view.tsx`) [optional v1.1]:
  - [x] Droppable day cells (sets `scheduledDate`).
  - [x] Visual cue for acceptable drop.
- [x] DoD: Day/Week fully support scheduledDate; Month optional if timeboxed.

### 8) Lists Page Integration (Optional for v1)
- [x] Add a non-calendar “Plan” toggle on `/lists` that opens the same Plan panel stacked on the left.
- [x] Dropping into the Lists Plan panel clears scheduling (unscheduled bucket).
- [x] DoD: Consistent planning experience across Lists and Calendar (if included in v1).

### 9) Styling & Visual Design (Modern, Minimal)
- [x] Use neutral background, soft borders, subtle hover states, rounded corners.
- [x] Compact density with comfortable spacing (no clutter).
- [x] Consistent color system with existing Tailwind tokens.
- [x] Smooth transitions for expand/collapse and drop highlights.
- [x] DoD: Plan panel looks cohesive with the app and feels “modern”.

### 10) UX Details & Safety Nets
- [x] Show toast on schedule/move with an “Undo” action; revert via optimistic context.
- [ ] Prevent duplicate drops (debounce or check last mutation).
- [ ] Handle conflicts if task is being edited elsewhere.
- [x] DoD: Users can safely undo accidental moves; no duplicate updates.

### 11) Accessibility
- [x] All interactive elements keyboard-focusable.
- [x] Add ARIA roles for draggable and droppable regions; announce on drop.
- [x] Provide menu-based move options for keyboard-only users.
- [x] DoD: Planning is usable with keyboard and screen readers.

### 12) Performance
- [ ] Virtualize task lists in Plan panel if lists are large (use `react-window`).
- [ ] Batch updates and throttle drag hover computations.
- [x] Cache results with React Query; tune `staleTime` for Plan panel.
- [ ] DoD: No jank on machines with many tasks/lists.

### 13) Analytics/Insights (Optional)
- [ ] Track schedule/move frequency (client-only console for dev).
- [ ] Track time-to-plan (panel open to first drop).
- [ ] DoD: Basic signals captured (behind dev flag only).

### 15) Rollout & Migration
- [x] Add a feature flag (env/localStorage) to enable/disable Plan panel.
- [x] Create migration for `tasks.scheduled_date` index.
- [ ] Smoke test on both in-memory and Postgres backends.
- [ ] DoD: Feature can be toggled and safely deployed.

### 16) Documentation
- [ ] Update README or create `docs/planning-user-guide.md` with quick tips.
- [ ] In-app tooltip explaining planning once (dismissible).
- [ ] DoD: Users understand how to use Plan with minimal onboarding.

---

### Acceptance Criteria (Condensed)
- Plan panel opens from sidebar and calendar header; state persists.
- Plan panel shows all lists and tasks; unscheduled tasks clearly indicated.
- Drag from Plan panel to Day/Week sets `scheduledDate` to dropped date.
- Drag between dates reschedules; drag to Unscheduled clears `scheduledDate`.
- Day/Week views include tasks scheduled via `scheduledDate` (untimed) alongside timed tasks.
- UI is clean, minimalistic, responsive, and accessible; undo supported.


