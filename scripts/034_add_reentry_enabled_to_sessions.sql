-- Add reentry_enabled column to sessions table
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS reentry_enabled boolean DEFAULT false;

-- Update existing sessions to have reentry disabled by default
UPDATE sessions SET reentry_enabled = false WHERE reentry_enabled IS NULL;
