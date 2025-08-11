-- Migration: Add goals table
-- Created: 2025-08-11

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS "goals" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "type" varchar NOT NULL,
  "anchor_date" date NOT NULL,
  "value" text NOT NULL DEFAULT '',
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

-- Unique goal per type + anchor date
CREATE UNIQUE INDEX IF NOT EXISTS goals_type_anchor_date_unique ON goals (type, anchor_date);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_goals_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_goals_updated_at ON goals;
CREATE TRIGGER update_goals_updated_at 
    BEFORE UPDATE ON goals 
    FOR EACH ROW 
    EXECUTE FUNCTION update_goals_updated_at_column();


