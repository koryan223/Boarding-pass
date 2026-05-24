-- Fix the column name mismatch in the reset function
-- The table has 'user_id' but the function was trying to use 'triggered_by_user_id'

DROP FUNCTION IF EXISTS public.reset_weekly_credits(text, uuid);

-- Recreate the function with the correct column name
CREATE OR REPLACE FUNCTION public.reset_weekly_credits(
  reset_type_param text DEFAULT 'manual',
  user_id_param uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  affected_count integer;
  result json;
BEGIN
  -- Reset all students' weekly credits to their meal plan value
  UPDATE students 
  SET weekly_credits = meal_plan,
      updated_at = NOW()
  WHERE TRUE;
  
  GET DIAGNOSTICS affected_count = ROW_COUNT;
  
  -- Fixed column name from triggered_by_user_id to user_id
  INSERT INTO meal_credit_reset_log (reset_type, user_id, students_affected)
  VALUES (reset_type_param, user_id_param, affected_count);
  
  -- Return success result
  result := json_build_object(
    'success', true,
    'message', 'Meal credits reset successfully',
    'students_affected', affected_count,
    'reset_type', reset_type_param
  );
  
  RETURN result;
  
EXCEPTION WHEN OTHERS THEN
  -- Return error result
  result := json_build_object(
    'success', false,
    'message', 'Failed to reset meal credits: ' || SQLERRM,
    'students_affected', 0,
    'reset_type', reset_type_param
  );
  
  RETURN result;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.reset_weekly_credits(text, uuid) TO authenticated;
