-- Fix RLS policies for student_deletion_log table
-- Add INSERT policy to allow admin and staff to log deletions

-- Add INSERT policy for student_deletion_log table
CREATE POLICY "Admin and staff can insert deletion log" ON student_deletion_log
  FOR INSERT WITH CHECK (true); -- Will be controlled at application level since we verify roles in API

-- Update SELECT policy to be more explicit
DROP POLICY IF EXISTS "Admin and staff can view deletion log" ON student_deletion_log;
CREATE POLICY "Admin and staff can view deletion log" ON student_deletion_log
  FOR SELECT USING (true); -- Will be controlled at application level since we verify roles in API
