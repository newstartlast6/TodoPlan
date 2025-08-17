-- Add user_id columns and indexes for per-user scoping

-- Lists
ALTER TABLE IF EXISTS lists
  ADD COLUMN IF NOT EXISTS user_id varchar NOT NULL DEFAULT 'dev-user-00000000-0000-0000-0000-000000000000';
CREATE INDEX IF NOT EXISTS idx_lists_user_id ON lists(user_id);
CREATE INDEX IF NOT EXISTS idx_lists_user_created_at ON lists(user_id, created_at);

-- Tasks
ALTER TABLE IF EXISTS tasks
  ADD COLUMN IF NOT EXISTS user_id varchar NOT NULL DEFAULT 'dev-user-00000000-0000-0000-0000-000000000000';
CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_user_start_time ON tasks(user_id, start_time);
CREATE INDEX IF NOT EXISTS idx_tasks_user_scheduled_date ON tasks(user_id, scheduled_date);

-- Goals
ALTER TABLE IF EXISTS goals
  ADD COLUMN IF NOT EXISTS user_id varchar NOT NULL DEFAULT 'dev-user-00000000-0000-0000-0000-000000000000';
CREATE INDEX IF NOT EXISTS idx_goals_user_id ON goals(user_id);
CREATE INDEX IF NOT EXISTS idx_goals_user_anchor_date ON goals(user_id, anchor_date);

-- Reviews
ALTER TABLE IF EXISTS reviews
  ADD COLUMN IF NOT EXISTS user_id varchar NOT NULL DEFAULT 'dev-user-00000000-0000-0000-0000-000000000000';
CREATE INDEX IF NOT EXISTS idx_reviews_user_id ON reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_reviews_user_anchor_date ON reviews(user_id, anchor_date);

-- Notes
ALTER TABLE IF EXISTS notes
  ADD COLUMN IF NOT EXISTS user_id varchar NOT NULL DEFAULT 'dev-user-00000000-0000-0000-0000-000000000000';
CREATE INDEX IF NOT EXISTS idx_notes_user_id ON notes(user_id);
CREATE INDEX IF NOT EXISTS idx_notes_user_anchor_date ON notes(user_id, anchor_date);

-- Timer sessions
ALTER TABLE IF EXISTS timer_sessions
  ADD COLUMN IF NOT EXISTS user_id varchar NOT NULL DEFAULT 'dev-user-00000000-0000-0000-0000-000000000000';
CREATE INDEX IF NOT EXISTS idx_timer_sessions_user_id ON timer_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_timer_sessions_user_start_time ON timer_sessions(user_id, start_time);

-- Task estimates
ALTER TABLE IF EXISTS task_estimates
  ADD COLUMN IF NOT EXISTS user_id varchar NOT NULL DEFAULT 'dev-user-00000000-0000-0000-0000-000000000000';
CREATE INDEX IF NOT EXISTS idx_task_estimates_user_id ON task_estimates(user_id);

-- Note: for production, consider dropping the DEFAULTs after backfill and enforcing FK to auth.users(id) if desired.

