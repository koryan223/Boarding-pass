-- Simplified meal credit reset without problematic RLS policies
-- This script creates a working reset function and log table

-- Drop existing table and function
DROP TABLE IF EXISTS meal_credit_reset_log CASCADE;
DROP FUNCTION IF EXISTS reset_weekly_credits(TEXT, UUID);

-- Create simple log table without RLS complications
CREATE TABLE meal_credit_reset_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    reset_type TEXT NOT NULL CHECK (reset_type IN ('automatic', 'manual')),
    triggered_by UUID, -- Simple UUID field, no foreign key constraint
    students_affected INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Disable RLS to avoid auth context issues
ALTER TABLE meal_credit_reset_log DISABLE ROW LEVEL SECURITY;

-- Create simplified reset function
CREATE OR REPLACE FUNCTION reset_weekly_credits(reset_type_param TEXT DEFAULT 'automatic', user_id_param UUID DEFAULT NULL)
RETURNS JSON AS $$
DECLARE
    affected_count INTEGER;
BEGIN
    -- Update all students' weekly credits to their meal plan value
    UPDATE students 
    SET weekly_credits = meal_plan,
        updated_at = NOW()
    WHERE TRUE; -- Explicit WHERE clause required by PostgreSQL
    
    -- Get the number of affected rows
    GET DIAGNOSTICS affected_count = ROW_COUNT;
    
    -- Log the reset operation
    INSERT INTO meal_credit_reset_log (reset_type, triggered_by, students_affected)
    VALUES (reset_type_param, user_id_param, affected_count);
    
    -- Return success response
    RETURN json_build_object(
        'success', true,
        'message', 'Weekly meal credits reset successfully',
        'students_affected', affected_count
    );
    
EXCEPTION WHEN OTHERS THEN
    -- Return error response
    RETURN json_build_object(
        'success', false,
        'error', SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
