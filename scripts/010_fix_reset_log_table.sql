-- Fix the meal_credit_reset_log table and reset function
-- This script aligns the table structure with what seems to be desired

-- Drop the existing table if it exists to ensure clean slate
DROP TABLE IF EXISTS meal_credit_reset_log;

-- Create the meal_credit_reset_log table with proper schema
CREATE TABLE meal_credit_reset_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    reset_type TEXT NOT NULL CHECK (reset_type IN ('automatic', 'manual')),
    user_id UUID REFERENCES auth.users(id), -- Standardizing on user_id as seen in live schema
    students_affected INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE meal_credit_reset_log ENABLE ROW LEVEL SECURITY;

-- Create policy for admin and staff to view reset logs
CREATE POLICY "Admin and staff can view reset logs" ON meal_credit_reset_log
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid() 
            AND role IN ('admin', 'staff')
        )
    );

-- Create policy for admin and staff to insert reset logs
CREATE POLICY "Admin and staff can insert reset logs" ON meal_credit_reset_log
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid() 
            AND role IN ('admin', 'staff')
        )
    );

-- Clean up old function signatures to avoid ambiguity
DROP FUNCTION IF EXISTS reset_weekly_credits();
DROP FUNCTION IF EXISTS reset_weekly_credits(text, uuid);

-- Recreate the reset function with proper error handling and signature
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
    INSERT INTO meal_credit_reset_log (reset_type, user_id, students_affected)
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
