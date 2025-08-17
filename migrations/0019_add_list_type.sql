-- Add type column to lists table (if it doesn't exist)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='lists' AND column_name='type') THEN
        ALTER TABLE lists ADD COLUMN type VARCHAR NOT NULL DEFAULT 'todo';
    END IF;
END $$;

-- Create indexes for list type queries (if they don't exist)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_lists_type') THEN
        CREATE INDEX idx_lists_type ON lists(type);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_lists_user_type') THEN
        CREATE INDEX idx_lists_user_type ON lists(user_id, type);
    END IF;
END $$;