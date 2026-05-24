-- Fix RLS policies for students table to allow viewing student data when fetching swipes
-- The issue is that when fetching meal_swipes with a join to students,
-- the RLS policy on students may block access to student data

-- First, check existing policies and add a more permissive read policy for authenticated users
DO $$
BEGIN
  -- Drop existing select policy if it exists
  DROP POLICY IF EXISTS "Users can view students for swipes" ON students;
  DROP POLICY IF EXISTS "Authenticated users can view all students" ON students;
  
  -- Create a new policy that allows all authenticated users to view students
  CREATE POLICY "Authenticated users can view all students"
    ON students
    FOR SELECT
    TO authenticated
    USING (true);
    
  RAISE NOTICE 'Created new RLS policy for students table';
END $$;
