-- Enable pgcrypto for UUID generation if not already present
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Indexes for tasks
CREATE INDEX IF NOT EXISTS tasks_start_time_idx ON tasks (start_time);
CREATE INDEX IF NOT EXISTS tasks_created_at_idx ON tasks (created_at);

-- Additional timer_sessions indexes
CREATE INDEX IF NOT EXISTS timer_sessions_task_active_idx ON timer_sessions (task_id, is_active);

-- Optional: enforce at most one active session globally (application handles, but keeping as documentation)
-- CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS only_one_active_session_idx
--   ON timer_sessions ((is_active))
--   WHERE is_active IS TRUE;


