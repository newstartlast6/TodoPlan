ALTER TABLE reviews ADD COLUMN IF NOT EXISTS biggest_win text;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS top_challenge text;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS top_distraction text;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS next_focus_plan text;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS energy_level integer DEFAULT 0;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS mood text;

