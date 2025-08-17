-- Timer Rewrite Cleanup (sessionless)

-- Ensure tasks.time_logged_seconds exists (idempotent)
ALTER TABLE tasks
ADD COLUMN IF NOT EXISTS time_logged_seconds integer NOT NULL DEFAULT 0;

-- Optional: Drop legacy timer-related tables if no longer needed
-- Uncomment after verifying no dependencies remain
-- DROP TABLE IF EXISTS timer_sessions;


