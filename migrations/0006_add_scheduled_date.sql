-- Add scheduledDate field to tasks table for drag-and-drop planning feature
ALTER TABLE tasks ADD COLUMN scheduled_date timestamp;