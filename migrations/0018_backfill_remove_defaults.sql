-- Optional: backfill user_id to a specific Supabase user and drop defaults
-- Update this user id before running in staging/prod
-- UPDATE lists SET user_id = '<supabase-user-id>' WHERE user_id = 'dev-user-00000000-0000-0000-0000-000000000000';
-- UPDATE tasks SET user_id = '<supabase-user-id>' WHERE user_id = 'dev-user-00000000-0000-0000-0000-000000000000';
-- UPDATE goals SET user_id = '<supabase-user-id>' WHERE user_id = 'dev-user-00000000-0000-0000-0000-000000000000';
-- UPDATE reviews SET user_id = '<supabase-user-id>' WHERE user_id = 'dev-user-00000000-0000-0000-0000-000000000000';
-- UPDATE notes SET user_id = '<supabase-user-id>' WHERE user_id = 'dev-user-00000000-0000-0000-0000-000000000000';
-- UPDATE timer_sessions SET user_id = '<supabase-user-id>' WHERE user_id = 'dev-user-00000000-0000-0000-0000-000000000000';
-- UPDATE task_estimates SET user_id = '<supabase-user-id>' WHERE user_id = 'dev-user-00000000-0000-0000-0000-000000000000';

-- After backfill, optionally drop defaults
-- ALTER TABLE lists ALTER COLUMN user_id DROP DEFAULT;
-- ALTER TABLE tasks ALTER COLUMN user_id DROP DEFAULT;
-- ALTER TABLE goals ALTER COLUMN user_id DROP DEFAULT;
-- ALTER TABLE reviews ALTER COLUMN user_id DROP DEFAULT;
-- ALTER TABLE notes ALTER COLUMN user_id DROP DEFAULT;
-- ALTER TABLE timer_sessions ALTER COLUMN user_id DROP DEFAULT;
-- ALTER TABLE task_estimates ALTER COLUMN user_id DROP DEFAULT;

