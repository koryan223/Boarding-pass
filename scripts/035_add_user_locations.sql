-- Create locations table
CREATE TABLE IF NOT EXISTS locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default unassigned location
INSERT INTO locations (name) VALUES ('unassigned') ON CONFLICT (name) DO NOTHING;

-- Add base_location column to user_roles
ALTER TABLE user_roles 
ADD COLUMN IF NOT EXISTS base_location VARCHAR(255) DEFAULT 'unassigned';

-- Enable RLS on locations
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to view locations
CREATE POLICY "All authenticated users can view locations" ON locations
  FOR SELECT TO authenticated USING (true);

-- Allow admins to manage locations (via service role)
CREATE POLICY "Service role can manage locations" ON locations
  FOR ALL USING (true) WITH CHECK (true);
