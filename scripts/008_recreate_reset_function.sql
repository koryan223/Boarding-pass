-- Drop and recreate the reset function to fix the WHERE clause issue
-- This fixes the "UPDATE requires a WHERE clause" error

-- Drop the existing function first
DROP FUNCTION IF EXISTS reset_weekly_credits();

-- Recreate the function with proper WHERE clause
CREATE OR REPLACE FUNCTION reset_weekly_credits()
RETURNS TABLE(students_updated INTEGER, reset_time TIMESTAMPTZ) AS $$
DECLARE
    updated_count INTEGER;
    reset_timestamp TIMESTAMPTZ;
BEGIN
    -- Set the reset timestamp
    reset_timestamp := NOW();
    
    -- Update all students' weekly credits to their meal plan value
    -- Adding WHERE TRUE to satisfy PostgreSQL's WHERE clause requirement
    UPDATE students 
    SET weekly_credits = meal_plan,
        updated_at = reset_timestamp
    WHERE TRUE;
    
    -- Get the count of updated rows
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    
    -- Log the reset operation
    INSERT INTO meal_credit_reset_log (reset_type, students_affected, reset_by, created_at)
    VALUES ('automatic', updated_count, NULL, reset_timestamp);
    
    -- Return the results
    RETURN QUERY SELECT updated_count, reset_timestamp;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION reset_weekly_credits() TO authenticated;
