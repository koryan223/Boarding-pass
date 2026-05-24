-- Add 'prepaid' meal plan type for students who buy a fixed number of meals
-- that don't reset weekly. When credits reach 0, they stay at 0.

-- Update the constraint to allow 'prepaid' value
ALTER TABLE students DROP CONSTRAINT IF EXISTS students_meal_plan_type_check;
ALTER TABLE students ADD CONSTRAINT students_meal_plan_type_check 
  CHECK (meal_plan_type IN ('standard', 'count', 'prepaid'));

-- Remove the meal_plan value constraint to allow any number for prepaid plans
ALTER TABLE students DROP CONSTRAINT IF EXISTS students_meal_plan_check;

-- Update the reset_weekly_credits function to EXCLUDE prepaid plans from reset
CREATE OR REPLACE FUNCTION reset_weekly_credits(
  reset_type_param VARCHAR DEFAULT 'automatic',
  user_id_param UUID DEFAULT NULL
)
RETURNS json AS $$
DECLARE
  reset_count INTEGER;
BEGIN
  -- Reset all students' weekly credits to their meal plan value
  -- EXCEPT for prepaid plans which should never reset
  UPDATE students 
  SET weekly_credits = meal_plan,
      updated_at = NOW()
  WHERE meal_plan_type != 'prepaid' OR meal_plan_type IS NULL;
  
  -- Get the count of updated records
  GET DIAGNOSTICS reset_count = ROW_COUNT;
  
  -- Log the reset operation
  INSERT INTO meal_credit_reset_log (reset_type, reset_count, reset_by, reset_at)
  VALUES (reset_type_param, reset_count, user_id_param, NOW());
  
  RETURN json_build_object(
    'success', true,
    'message', 'Weekly credits reset successfully (prepaid plans excluded)',
    'students_affected', reset_count,
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
