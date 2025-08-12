-- Create index on scheduled_date for faster planning queries
CREATE INDEX IF NOT EXISTS idx_tasks_scheduled_date ON tasks (scheduled_date);


