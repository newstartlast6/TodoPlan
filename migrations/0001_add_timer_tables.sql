-- Migration: Add timer tracking tables
-- Created: 2025-01-08

-- Create timer_sessions table
CREATE TABLE IF NOT EXISTS "timer_sessions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" varchar NOT NULL,
	"start_time" timestamp NOT NULL,
	"end_time" timestamp,
	"duration_seconds" integer DEFAULT 0,
	"is_active" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);

-- Create task_estimates table
CREATE TABLE IF NOT EXISTS "task_estimates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" varchar NOT NULL,
	"estimated_duration_minutes" integer NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "task_estimates_task_id_unique" UNIQUE("task_id")
);

-- Add foreign key constraints
DO $$ BEGIN
 ALTER TABLE "timer_sessions" ADD CONSTRAINT "timer_sessions_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "task_estimates" ADD CONSTRAINT "task_estimates_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS "timer_sessions_task_id_idx" ON "timer_sessions" ("task_id");
CREATE INDEX IF NOT EXISTS "timer_sessions_start_time_idx" ON "timer_sessions" ("start_time");
CREATE INDEX IF NOT EXISTS "timer_sessions_is_active_idx" ON "timer_sessions" ("is_active");
CREATE INDEX IF NOT EXISTS "task_estimates_task_id_idx" ON "task_estimates" ("task_id");

-- Create materialized view for daily time summaries
CREATE MATERIALIZED VIEW IF NOT EXISTS "daily_time_summaries" AS
SELECT 
  DATE(start_time) as date,
  task_id,
  SUM(duration_seconds) as total_seconds,
  COUNT(*) as session_count
FROM timer_sessions 
WHERE end_time IS NOT NULL
GROUP BY DATE(start_time), task_id;

-- Create index on materialized view
CREATE UNIQUE INDEX IF NOT EXISTS "daily_time_summaries_date_task_idx" ON "daily_time_summaries" ("date", "task_id");

-- Create function to refresh materialized view
CREATE OR REPLACE FUNCTION refresh_daily_time_summaries()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY daily_time_summaries;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_timer_sessions_updated_at 
    BEFORE UPDATE ON timer_sessions 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();