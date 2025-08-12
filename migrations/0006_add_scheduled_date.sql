-- Add scheduledDate field to tasks table for drag-and-drop planning feature (idempotent)
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS scheduled_date timestamp;