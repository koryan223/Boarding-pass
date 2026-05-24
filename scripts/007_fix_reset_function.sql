-- Fix the reset_weekly_credits function to include WHERE clause
-- PostgreSQL requires WHERE clause for UPDATE statements for safety

CREATE OR REPLACE FUNCTION reset_weekly_credits()
RETURNS json AS $$
DECLARE
  reset_count INTEGER;
BEGIN
  -- Reset all students' weekly credits to their meal plan value
  -- Added WHERE TRUE to satisfy PostgreSQL's requirement for WHERE clause
  UPDATE students 
  SET weekly_credits = meal_plan,
      updated_at = NOW()
  WHERE TRUE; -- Explicit WHERE clause to update all records
  
  -- Get the count of updated records
  GET DIAGNOSTICS reset_count = ROW_COUNT;
  
  -- Log the reset operation
  -- Ensure we use the correct table name 'meal_credit_reset_log'
  -- Note: We can't use auth.uid() in an automatic context easily unless invoked by a user
  -- For this 'fix' script, we assume manual invocation context if possible, or NULL
  INSERT INTO meal_credit_reset_log (reset_type, reset_count, reset_by, reset_at)
  VALUES ('manual', reset_count, auth.uid(), NOW());
  
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
