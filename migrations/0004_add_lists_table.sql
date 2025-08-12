-- Migration: Add lists table and extend tasks with list_id
-- Created: 2025-12-08

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create lists table
CREATE TABLE IF NOT EXISTS "lists" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "emoji" text NOT NULL DEFAULT '📋',
  "color" text,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

-- Add list_id column to tasks table
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "list_id" varchar;

-- Clean up any invalid list_id references before adding foreign key constraint
UPDATE "tasks" SET "list_id" = NULL WHERE "list_id" IS NOT NULL AND "list_id" NOT IN (SELECT "id" FROM "lists");

-- Add foreign key constraint
DO $$ BEGIN
 ALTER TABLE "tasks" ADD CONSTRAINT "tasks_list_id_lists_id_fk" FOREIGN KEY ("list_id") REFERENCES "lists"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS "tasks_list_id_idx" ON "tasks" ("list_id");
CREATE INDEX IF NOT EXISTS "lists_created_at_idx" ON "lists" ("created_at");

-- Create trigger to update updated_at timestamp for lists
CREATE OR REPLACE FUNCTION update_lists_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_lists_updated_at ON lists;
CREATE TRIGGER update_lists_updated_at 
    BEFORE UPDATE ON lists 
    FOR EACH ROW 
    EXECUTE FUNCTION update_lists_updated_at_column();