## Persistence Layer Implementation Plan (Tasks Only)

This plan introduces a durable Postgres-backed persistence layer while preserving the existing `MemStorage` for local/offline development and tests. It delivers drop-in parity for tasks, timer sessions, task estimates, and user operations exposed by `IStorage` in `server/storage.ts`.

### Goals
- Provide a production-grade `DbStorage` implementing `IStorage` with Drizzle ORM + Postgres (Supabase or Neon).
- Keep `MemStorage` available for local dev and tests; switch via environment.
- Maintain API parity so no client changes are required.
- Ensure data integrity, observability, and robust error handling.

### Non-Goals
- Changing public API routes or client behavior.
- Introducing a second database type beyond Postgres.

---

## Phase 0 — Prerequisites & Decisions

- [x] Confirm Postgres as the primary database; use Drizzle ORM. Prefer Supabase (managed Postgres).
- [x] Define environment toggle:
  - `STORAGE_BACKEND=postgres|memory` (default to `memory` if unset)
  - `DATABASE_URL` required only when `STORAGE_BACKEND=postgres`
- [ ] Decide on seed strategy for development to replace `MemStorage` sample data.
- [x] Confirm timezone strategy (store timestamps in UTC; return ISO strings to clients as today).

Connection strings (Supabase):
- Transaction pooler: `postgresql://postgres.ouuqkfibrzukhsaovbmw:[YOUR-PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres`
- Session pooler: `postgresql://postgres.ouuqkfibrzukhsaovbmw:[YOUR-PASSWORD]@aws-0-us-east-1.pooler.supabase.com:5432/postgres`
- Direct: `postgresql://postgres:[YOUR-PASSWORD]@db.ouuqkfibrzukhsaovbmw.supabase.co:5432/postgres`

Notes:
- SSL is enforced automatically by appending `sslmode=require` when hostname contains `supabase.co|com`.

Deliverables:
- Decision note in `docs/` outlining toggles and timezones.

---

## Phase 1 — Schema and Migrations Hardening

Review current schema in `shared/schema.ts` and existing migration `migrations/0001_add_timer_tables.sql`.

Tasks:
- [x] Add DB indexes and constraints for performance and integrity:
  - Tasks: index on `start_time`, optional index on `created_at`.
  - Timer sessions: indexes on `task_id`, `start_time`, `is_active`.
  - Consider partial unique index to enforce “at most 1 active session globally” at the DB level (if we choose DB enforcement) or document app-level enforcement via transactions.
- [x] Ensure foreign keys cascade where appropriate (already defined for `task_id`).
- [x] Confirm `end_time` nullability for `timer_sessions` (in-progress sessions) matches usage.
- [x] Create `0002_indexes_constraints.sql` migration file.
- [x] Ensure `pgcrypto` extension is enabled for `gen_random_uuid()` defaults (Supabase/Neon):
  - Add `CREATE EXTENSION IF NOT EXISTS pgcrypto;` to migrations before tables that rely on `gen_random_uuid()`.

Acceptance criteria:
- Pushing migrations on a clean DB succeeds.
- Query planner uses expected indexes for common API paths (list tasks, get daily summary, fetch sessions by task).

Deliverables:
- New migration file `migrations/0002_indexes_constraints.sql`.
- Notes in `docs/` about chosen integrity strategy for active timers (DB vs app enforcement).

---

## Phase 2 — Storage Abstraction and Provider

Goal: Implement `DbStorage` with full parity and a safe runtime switch.

Impacted files:
- `server/storage.ts`
- `server/db.ts`
- `shared/schema.ts` (types-only, no breaking changes expected)

Tasks:
- [x] Refactor `server/db.ts` to avoid throwing when `DATABASE_URL` is missing during memory mode:
  - Export a factory or lazy initializer that only constructs the Drizzle client when `STORAGE_BACKEND=postgres`.
  - For Supabase: use `pg` + `drizzle-orm/node-postgres`.
  - Keep a single `DATABASE_URL` used by both Drizzle CLI and runtime client.
- [x] Implement `DbStorage` class to fully satisfy `IStorage`:
  - Users
    - [ ] `getUser`, `getUserByUsername`, `createUser`
  - Tasks
    - [ ] `getTasks(startDate?, endDate?)` — apply optional date filtering on `tasks.start_time` and sort ascending.
    - [ ] `getTask(id)`
    - [ ] `createTask(insertTask)` — set server-side `created_at`, handle optional fields consistently.
    - [ ] `updateTask(id, updateTask)`
    - [ ] `deleteTask(id)`
  - Timer sessions
    - [ ] `getActiveTimerSession()` — returns the single active session if any; ensure consistent ordering or limit 1.
    - [ ] `getTimerSession(id)`
    - [ ] `getTimerSessionsByTask(taskId)` — sort descending by `start_time`.
    - [ ] `createTimerSession(insertSession)` — set `created_at`/`updated_at`.
    - [ ] `updateTimerSession(id, updateSession)` — always bump `updated_at`.
    - [ ] `deleteTimerSession(id)`
    - [ ] `stopActiveTimerSessions()` — transactional update of all active sessions: compute elapsed, set `end_time`, accumulate `duration_seconds`, set `is_active=false`, update `updated_at`.
  - Task estimates
    - [ ] `getTaskEstimate(taskId)`
    - [ ] `createTaskEstimate(insertEstimate)`
    - [ ] `updateTaskEstimate(taskId, updateEstimate)`
    - [ ] `deleteTaskEstimate(taskId)`
  - Derived summaries
    - [ ] `getDailySummary(date)` — compute start/end of day and delegate to range method.
    - [ ] `getDailySummaryByDateRange(start, end)` — aggregate completed sessions by day + task and include task details.
- [x] Provide a `createStorage()` provider that chooses `DbStorage` or `MemStorage` based on env and exports a singleton `storage`.
- [x] Remove unconditional import-time DB connection side-effects in memory mode.

Acceptance criteria:
- Server starts without `DATABASE_URL` (memory mode) and with `DATABASE_URL` (postgres mode).
- All `IStorage` methods behave equivalently across memory and DB modes (modulo persistence).
- `routes.ts` requires no changes.

Deliverables:
- Updated `server/storage.ts` with `DbStorage` fully implemented and a provider switch.
- Updated `server/db.ts` with a safe, lazy connection.

---

## Phase 3 — Error Handling & Observability

Tasks:
- [ ] Map DB errors to `TimerPersistenceError` where appropriate; include metadata (operation, ids, timestamps).
- [ ] Add structured logs around critical storage operations (start/pause/stop timer, create/update task).
- [ ] Ensure idempotency where reasonable (e.g., safe re-application of updates in retries).

Acceptance criteria:
- API returns consistent error shapes already handled by `routes.ts`.
- Logs include correlation info for debugging (session id, task id).

Deliverables:
- Error mapping utilities or wrappers inside `DbStorage`.

---

## Phase 4 — Seeding & Local Dev Experience

Tasks:
- [ ] Add a seed script to create representative demo data in Postgres (equivalent to current `MemStorage` sample tasks).
- [ ] Provide `.env.example` documenting `STORAGE_BACKEND` and `DATABASE_URL`.
- [ ] Document developer flows:
  - Memory mode: `STORAGE_BACKEND=memory` (no DB required).
  - Postgres mode: set `DATABASE_URL`, run migrations, seed, then start server.
  - Supabase (local or cloud):
    - Cloud: use the Supabase `DATABASE_URL` with `sslmode=require`.
    - Local (Supabase CLI): run `supabase start`, use the printed connection string.

Acceptance criteria:
- New developers can bootstrap either mode in <5 minutes.

Deliverables:
- `scripts/seed.ts` (invoked via `tsx`), documentation in `README`.


## Risks & Mitigations
- Accidental DB connection at import time in memory mode → use lazy initialization in `server/db.ts` and provider pattern in `server/storage.ts`.
- Race conditions for active timer → wrap lifecycle operations in transactions; optionally add DB-level guard.
- Migration drift between schema and SQL → rely on Drizzle schema for source of truth, keep migrations deterministic, and test `db:migrate` in CI.

---

## Supabase-specific Addendum (instead of Neon)

Use Supabase’s managed Postgres as the persistence backend. Drizzle remains the ORM.

Tasks:
- [x] Dependencies:
  - Added `pg` and configured Drizzle node-postgres adapter. `@neondatabase/serverless` no longer used for DB connection.
- [x] Connection & Config:
  - Updated `server/db.ts` to use `pg.Pool` with `drizzle-orm/node-postgres`.
  - Auto-append `sslmode=require` for Supabase URLs and set Pool SSL.
  - If using Supabase connection pooling (pgBouncer), be aware some commands (e.g., `REFRESH MATERIALIZED VIEW CONCURRENTLY`) may require a direct (non-pooled) connection.
- [x] Migrations:
  - Ensured `CREATE EXTENSION IF NOT EXISTS pgcrypto;` precedes tables.
  - Added `0002_indexes_constraints.sql`.
- [ ] Materialized View considerations:
  - If using pgBouncer in transaction pooling mode, `REFRESH MATERIALIZED VIEW CONCURRENTLY` may fail. Options:
    - Use a direct connection for refresh routines; or
    - Use regular `REFRESH MATERIALIZED VIEW` off-hours; or
    - Replace MV with a query + indexed table updated via cron/job if needed.
- [ ] Environment:
  - `.env.example` should document Supabase `DATABASE_URL` formats for direct vs pooled.
- [ ] Seeding:
  - Seed via `scripts/seed.ts` using the same client as runtime.
- [ ] Observability:
  - Keep structured logs; ensure connection pool metrics/logging are captured in Supabase dashboard where applicable.

Acceptance criteria:
- App runs with `STORAGE_BACKEND=postgres` using Supabase `DATABASE_URL` without code changes outside `server/db.ts` and dependency swaps.
- All `IStorage` operations work identically to memory mode; data persists across restarts.

---

## Acceptance Criteria (Overall)
- The app runs in both modes with a single configuration flag.
- All API routes behave the same across modes; data persists in Postgres mode across restarts.
- Tests validate storage parity and pass consistently in CI.

---

## Estimated Timeline (conservative)
- Phase 0–1: 0.5–1 day
- Phase 2: 1.5–2 days
- Phase 3–4: 0.5–1 day
- Phase 5: 1–1.5 days
- Phase 6–9: 0.5–1 day

Total: ~4–6 days including QA and iteration.


