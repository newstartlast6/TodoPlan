-- Create notes table for period notes (daily/weekly/monthly/yearly)
CREATE TABLE IF NOT EXISTS notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL,
  anchor_date timestamp NOT NULL,
  content text,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

-- Unique index to ensure a single note per (type, anchor_date)
CREATE UNIQUE INDEX IF NOT EXISTS idx_notes_unique ON notes(type, anchor_date);


