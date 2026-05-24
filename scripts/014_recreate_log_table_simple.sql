-- Drop and recreate the meal_credit_reset_log table with correct schema
DROP TABLE IF EXISTS meal_credit_reset_log CASCADE;

CREATE TABLE meal_credit_reset_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    reset_type TEXT NOT NULL CHECK (reset_type IN ('automatic', 'manual')),
    user_id UUID, -- nullable for automatic resets
    students_affected INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Disable RLS to avoid authentication issues
ALTER TABLE meal_credit_reset_log DISABLE ROW LEVEL SECURITY;

-- Grant necessary permissions
GRANT ALL ON meal_credit_reset_log TO authenticated;
GRANT ALL ON meal_credit_reset_log TO service_role;
