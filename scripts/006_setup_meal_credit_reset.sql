-- Create Supabase Edge Function for automatic weekly reset
-- This function will be called by a cron job every Monday at 6 AM

-- Create the table if it doesn't exist (using the consistent name meal_credit_reset_log)
CREATE TABLE IF NOT EXISTS meal_credit_reset_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  reset_type VARCHAR(20) NOT NULL CHECK (reset_type IN ('automatic', 'manual')),
  reset_count INTEGER NOT NULL,
  reset_by UUID REFERENCES auth.users(id), -- NULL for automatic resets
  reset_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on the resets table
ALTER TABLE meal_credit_reset_log ENABLE ROW LEVEL SECURITY;

-- RLS policy for meal_credit_reset_log (admin and staff can view)
DROP POLICY IF EXISTS "Admin and staff can view resets" ON meal_credit_reset_log;
CREATE POLICY "Admin and staff can view resets" ON meal_credit_reset_log
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'staff')
    )
  );

-- First, create a more robust reset function
CREATE OR REPLACE FUNCTION reset_weekly_credits()
RETURNS json AS $$
DECLARE
  reset_count INTEGER;
BEGIN
  -- Reset all students' weekly credits to their meal plan value
  UPDATE students 
  SET weekly_credits = meal_plan,
      updated_at = NOW()
  WHERE TRUE;
  
  -- Get the count of updated records
  GET DIAGNOSTICS reset_count = ROW_COUNT;
  
  -- Log the reset operation
  INSERT INTO meal_credit_reset_log (reset_type, reset_count, reset_by, reset_at)
  VALUES ('automatic', reset_count, NULL, NOW());
  
  RETURN json_build_object(
    'success', true,
    'message', 'Weekly credits reset successfully',
    'students_updated', reset_count,
    'reset_at', NOW()
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission on the reset function to authenticated users
GRANT EXECUTE ON FUNCTION reset_weekly_credits() TO authenticated;

-- Create a cron job to run every Monday at 6 AM
-- Note: This requires the pg_cron extension to be enabled in Supabase
-- We wrap this in a DO block to prevent failure if pg_cron is not available
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'weekly-meal-credit-reset',
      '0 6 * * 1', -- Every Monday at 6 AM
      'SELECT reset_weekly_credits();'
    );
  END IF;
END $$;
