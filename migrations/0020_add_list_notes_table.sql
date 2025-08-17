-- Create list_notes table for notes attached to lists
CREATE TABLE list_notes (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT,
  list_id VARCHAR NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  user_id VARCHAR NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for efficient queries
CREATE INDEX idx_list_notes_list_id ON list_notes(list_id);
CREATE INDEX idx_list_notes_user_id ON list_notes(user_id);
CREATE INDEX idx_list_notes_created_at ON list_notes(created_at);