-- Add location_id column to sessions table
ALTER TABLE sessions ADD COLUMN location_id uuid REFERENCES locations(id);

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_sessions_location_id ON sessions(location_id);

-- Add comment
COMMENT ON COLUMN sessions.location_id IS 'Location where the session took place';
