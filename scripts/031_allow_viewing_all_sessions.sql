-- Allow all authenticated users to view all sessions
-- This enables staff and admins to see sessions from any user

-- Drop existing SELECT policy
DROP POLICY IF EXISTS "Users can view their own sessions" ON sessions;

-- Create new policy that allows all authenticated users to view all sessions
CREATE POLICY "All authenticated users can view sessions"
  ON sessions
  FOR SELECT
  TO authenticated
  USING (true);
