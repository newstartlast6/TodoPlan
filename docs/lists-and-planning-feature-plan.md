### Lists and Planning Feature — Implementation Plan (Tasks Only)

#### Overview
- **Goal**: Allow users to create project-based Lists that contain todos (same as current tasks/todos functionality but initially without any date/time), then plan their day/week by dragging these list todos into the calendar (Day/Week views). The right-side detail area becomes a Plan panel in planning mode. Also support dragging scheduled tasks between dates within Week view to reschedule.

#### Top-level TODO checklist
- [ ] Data model and migrations
- [ ] Server API and storage layer
- [ ] Client Plan panel and Lists UI
- [ ] Drag-and-drop from Plan panel to Day/Week views
- [ ] Drag-and-drop between dates in Week view (reschedule scheduled tasks)
- [ ] Testing (unit, component, integration, server)
- [ ] Documentation and rollout

#### Scope
- **In-scope**:
  - CRUD for Lists
  - Unscheduled todos within Lists (no date/time)
  - Plan panel on the right showing all Lists and their todos
  - Drag-and-drop from Plan panel into Day/Week to schedule
  - Drag-and-drop between dates in Week view to reschedule scheduled tasks (inter-day move)
  - Keep existing todo/task functionality (notes, priority, timer, estimation) consistent
  - Show Plan panel in Today and Week views; available elsewhere behind a toggle
- **Out-of-scope (v1)**:
  - Multi-user permissions/sharing
  - Advanced project entity (optional follow-up)
  - Kanban boards, tags, complex filters
  - Advanced rescheduling gestures beyond Week inter-day drag (e.g., complex snapping/auto-conflict resolution)

---

### Data Model and Migrations

1) Add Lists table
   - `lists` table fields:
     - id (uuid, pk, default gen_random_uuid())
     - name (text, required)
     - description (text, optional)
     - color (varchar, optional)
     - projectId (uuid, optional; future-proof for Projects)
     - position (integer, default 0) for ordering lists
     - createdAt, updatedAt (timestamps, default now())
   - Indexes: by `position`, maybe `name` (text search later)

2) Extend Tasks to support unscheduled and list membership
   - Modify `tasks` table:
     - `start_time` nullable
     - `end_time` nullable
     - `list_id` (uuid, nullable, fk -> lists.id, onDelete set null)
     - `list_position` (integer, default 0) for ordering within a list
   - Backfill: none required for existing rows (they already have non-null start/end). Ensure code handles nulls.
   - Indexes: (`list_id`, `list_position`), partial indexes to filter unscheduled: `WHERE start_time IS NULL`

3) New Drizzle schema definitions
   - Add `lists` table in `shared/schema.ts`
   - Update `tasks` in `shared/schema.ts` to make `startTime`/`endTime` optional and add `listId`, `listPosition`
   - Update insert/update zod schemas accordingly

4) Migration script
   - Create `0004_lists_and_unscheduled_tasks.sql`:
     - Create `lists`
     - Alter `tasks` columns to nullable for `start_time`, `end_time`
     - Add `list_id`, `list_position`
     - Add indexes

---

### Server API and Storage Layer

5) Storage interface changes (`server/storage.ts`)
   - Extend `IStorage` with:
     - Lists: `getLists()`, `getList(id)`, `createList(insert)`, `updateList(id, update)`, `deleteList(id)`, `reorderLists(order: Array<{id, position}>)`
     - List tasks: `getTasksByList(listId)`, `reorderTasksInList(listId, order: Array<{taskId, position}>)`
     - Unscheduled tasks: `getUnscheduledTasks(listId?)`
   - Implement in `MemStorage` and `DbStorage`

6) Routes (`server/routes.ts`)
   - Lists CRUD
     - `GET /api/lists`
     - `POST /api/lists`
     - `GET /api/lists/:id`
     - `PUT /api/lists/:id`
     - `DELETE /api/lists/:id`
     - `PUT /api/lists/:id/reorder` (optional: or `PUT /api/lists/reorder` for batch)
   - List tasks
     - `GET /api/lists/:id/tasks` (query: `scheduled=true|false`)
     - `PUT /api/lists/:id/tasks/reorder`
     - `POST /api/lists/:id/tasks` to add a new unscheduled task directly in a list
   - Unscheduled tasks
     - `GET /api/tasks/unscheduled` (optional filter `listId`)
   - Update existing Tasks endpoints to allow null `startTime`/`endTime` on create/update
     - Validation: when `startTime` provided, require `endTime` and `endTime > startTime`

7) Validation and errors
   - Zod schemas for Lists insert/update
   - Ensure timer routes remain unaffected (timer can start on unscheduled tasks)
   - Ensure `/api/tasks` date-range queries exclude unscheduled by design (pinned to `startTime` filter)

---

### Client — Plan Panel and Lists UI

8) New components (`client/src/components/plan/`)
   - `plan-panel.tsx`: Right-side panel replacing detail pane in Plan mode
   - `list-column.tsx`: Displays a single List with add-todo, reorder, inline edit
   - `plan-todo-item.tsx`: Simplified todo item for unscheduled (no time fields)
   - `list-create-dialog.tsx` (or inline create in header)

9) New hooks and state
   - `use-plan-mode.ts`: global toggle to switch right pane between Todo Detail and Plan panel
   - `use-lists.ts`: CRUD and caching for lists
   - `use-unscheduled-tasks.ts`: fetch tasks with `startTime=null` (optionally by `listId`)
   - Update `use-selected-todo.tsx` not to auto-open detail pane when Plan mode is active

10) Calendar integration
   - In `client/src/pages/calendar.tsx`:
     - Add Plan toggle button in header (Today/Week views prominent)
     - When Plan mode enabled, `ResponsiveLayout.detail` renders Plan panel instead of `TodoDetailPane`
     - Ensure Plan panel is visible side-by-side with calendar views

11) List and todo interactions
   - Create list
   - Rename/delete list
   - Add new unscheduled todo within a list (inline `EditableText`, notes support)
   - Reorder lists and todos (dragging within panel)
   - Move todo between lists (drag between list columns)
   - Context actions: “Add to Today”, “Estimate”, “Start Timer”, “Mark complete”

12) Timer and estimation
   - Allow starting timer from unscheduled todo in Plan panel
   - If desired, on timer start without schedule, do nothing special (remain unscheduled)
   - Estimation component usable in Plan panel (same shared API)

---

### Drag and Drop — Plan to Calendar and Week Inter-day Reschedule

13) DnD library
   - Add `@dnd-kit/core` (or similar) for panel interactions and cross-area dragging
   - Provide drag handle and accessible keyboard support

14) Drop targets in Day/Week views
   - In `DayView` and `WeekView`, define droppable zones for 30/60-minute slots
   - On drop of an unscheduled todo:
     - Compute `startTime` from drop location
     - Determine `endTime` using estimate if available, else default duration (configurable, e.g., 60 min)
     - Update task: set `startTime`, `endTime`, and clear `listId` (remove from list) unless we want to keep a backlink
     - Optimistic UI: show event; invalidate Plan queries so it disappears from Plan panel

15) Drag-and-drop between dates in Week view (reschedule scheduled tasks)
   - In `WeekView`, allow dragging an already scheduled task to another day/time
   - On drop:
     - Preserve duration by default: `endTime = newStartTime + previousDuration`
     - Alternatively snap `endTime` to slot-end if more natural (config flag)
     - Update task via existing update API
     - Optimistic UI: move event; invalidate calendar queries for affected range
   - Constraints:
     - If dropped outside valid hours, clamp to min/max view hours
     - If overlaps, allow stacking (current behavior) and optionally show warning toast

16) Dragging scheduled tasks back to Plan (optional v1.1)
   - Allow dragging a scheduled task into a list to unschedule it:
     - Clear `startTime`/`endTime` and set `listId`

17) Conflict handling
   - If drop overlaps existing tasks, accept and stack (current behavior), or display a subtle warning toast—no blockers in v1

---

### UI/UX Details

17) Plan panel layout
   - Header: “Plan” with actions (Add List)
   - Body: Scrollable lists; each list shows unscheduled todos
   - Empty states for no lists, no todos

18) Consistent styling with existing UI
   - Reuse `EditableText`, `Badge`, `Button`, `Separator`, `Toast`
   - Keep variants compact to fit side panel

19) Accessibility
   - Keyboard navigation for list and todo creation
   - ARIA roles for draggable/droppable areas

---

### Client-Server Wiring

20) Queries and caching
   - Query keys:
     - `['/api/lists']`
     - `['/api/lists', listId, 'tasks', 'unscheduled']`
     - `['/api/tasks', 'unscheduled']`
   - Invalidate on create/update/delete or when scheduling/rescheduling via DnD (Week inter-day included)

21) API client helpers
   - Extend `apiRequest` usage for lists endpoints
   - Error toasts for network failures

---

### Testing Plan

22) Unit tests
   - Schema guards (zod) for lists and updated tasks
   - Hooks: `use-lists`, `use-unscheduled-tasks`, `use-plan-mode`

23) Component tests
   - Plan panel render and interactions (create list/todo, rename, delete)
   - DnD: drag from Plan todo into Day/Week (simulate drop, verify task schedule)
   - Reordering within list
   - Week view: drag scheduled task between dates/time slots and verify reschedule

24) Integration tests
   - Plan panel + Week view end-to-end: create unscheduled → drag into week → visible as scheduled, removed from plan
   - Timer from Plan todo
   - Week inter-day reschedule: move scheduled task to another date and verify times updated

25) Server tests
   - Lists CRUD
   - Unscheduled task queries
   - Scheduling via update API

---

### Performance and Reliability

26) Loading strategy
   - Lazy-load lists and unscheduled tasks when Plan mode opens
   - Paginate if list is large (v1 can skip)

27) Offline considerations
   - Follow existing timer persistence model; lists/todos remain basic (no offline queue in v1)

28) Error handling
   - Toasts for CRUD/DnD failures with retry

---

### Feature Flag and Rollout

29) Feature flag
   - Gate Plan mode and Lists behind `ENABLE_LISTS` env/config

30) Rollout
   - Phase 1: Backend + hidden UI
   - Phase 2: Enable Plan panel read-only
   - Phase 3: Enable DnD

---

### Documentation Tasks

31) Update docs
   - Add user guide section “Planning with Lists”
   - API reference for new endpoints

---

### Detailed Task Breakdown (Checklist)

Backend
- [ ] Add `lists` table (schema + migration)
- [ ] Make `tasks.start_time` and `tasks.end_time` nullable (migration)
- [ ] Add `tasks.list_id`, `tasks.list_position` (migration + indexes)
- [ ] Update Drizzle types and zod schemas in `shared/schema.ts`
- [ ] Extend `IStorage` for lists and unscheduled task methods
- [ ] Implement in `MemStorage`
- [ ] Implement in `DbStorage`
- [ ] Add Lists routes (CRUD, reorder)
- [ ] Add List tasks routes and reorder
- [ ] Add Unscheduled tasks route (optional)
- [ ] Update task create/update validation to allow null times

Client
- [ ] Create `use-plan-mode.ts`
- [ ] Create `use-lists.ts` and `use-unscheduled-tasks.ts`
- [ ] Build `plan-panel.tsx` shell
- [ ] Build `list-column.tsx` with inline create/rename/delete and reorder
- [ ] Build `plan-todo-item.tsx` (no time fields) with notes preview and quick actions
- [ ] Add Plan toggle in `pages/calendar.tsx` header
- [ ] Swap right pane: `TodoDetailPane` → `PlanPanel` when Plan mode on
- [ ] Wire queries and optimistic updates
- [ ] Add DnD provider and drag handles in Plan panel
- [ ] Add droppable slots to `DayView` and `WeekView`
- [ ] On drop, compute times and update task; invalidate caches
- [ ] Empty states and loading skeletons
 - [ ] In `WeekView`, enable dragging scheduled tasks between dates/time slots to reschedule
 - [ ] Preserve duration on Week reschedule; clamp within view hours; show toast on conflicts (non-blocking)

Timer/Estimation Integration
- [ ] Ensure timer controls work for unscheduled tasks in Plan panel
- [ ] Use estimate for default duration on drop (fallback to config)

Testing
- [ ] Unit tests for schemas and hooks
- [ ] Component tests for Plan panel and list interactions
- [ ] DnD integration test (Plan → Week/Day)
- [ ] Server route tests for lists and unscheduled tasks

Docs & Flag
- [ ] Add user documentation page
- [ ] Add feature flag plumbing and default off/on strategy

---

### Acceptance Criteria
- [ ] Lists: Users can create, rename, delete, and reorder Lists.
- [ ] Todos in Lists: Users can add/edit/complete/delete unscheduled todos inside Lists; notes and priority available.
- [ ] Plan Panel: In Today/Week views, a right-side Plan panel shows Lists with their todos.
- [ ] Drag to Schedule: Users can drag a list todo into Day/Week to schedule it; it appears on calendar and is removed from Plan.
- [ ] Week inter-day reschedule: Users can drag a scheduled task between dates in Week view to reschedule; duration preserved by default.
- [ ] No Dates Initially: Creating todos in Lists does not require date/time.
- [ ] Consistency: Timer and estimation work for list todos; scheduling uses estimate as default duration when available.
- [ ] Stability: Existing calendar task behavior unchanged for already scheduled tasks.

---

### Future Enhancements (Post-v1)
- Projects entity with project-level reporting and color coding
- Tags and filters in Plan panel
- Drag scheduled tasks back to Lists to unschedule
- Bulk operations (multi-select, multi-schedule)
- Cross-device sync for Plan data offline queue


