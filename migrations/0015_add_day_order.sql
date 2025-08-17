-- Add day_order column to tasks for within-day manual ordering
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS day_order INTEGER;

-- Optional: index to speed up ordering by day within a date range
-- CREATE INDEX IF NOT EXISTS idx_tasks_scheduled_date_day_order ON tasks (scheduled_date, day_order);


