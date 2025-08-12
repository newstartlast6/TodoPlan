-- Add a persisted aggregate of all-time logged seconds for each task
ALTER TABLE tasks
ADD COLUMN IF NOT EXISTS time_logged_seconds integer NOT NULL DEFAULT 0;

-- Optional: backfill existing rows to 0 (handled by default)
UPDATE tasks SET time_logged_seconds = COALESCE(time_logged_seconds, 0);

