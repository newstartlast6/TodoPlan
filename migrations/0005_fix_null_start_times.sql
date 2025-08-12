-- Migration: Fix null start_time values in tasks
-- Created: 2025-12-08

-- Update any tasks with null start_time to use created_at or current timestamp
UPDATE "tasks" 
SET "start_time" = COALESCE("created_at", now())
WHERE "start_time" IS NULL;

-- Update any tasks with null end_time to use start_time + 1 hour
UPDATE "tasks" 
SET "end_time" = COALESCE("start_time" + INTERVAL '1 hour', now() + INTERVAL '1 hour')
WHERE "end_time" IS NULL;