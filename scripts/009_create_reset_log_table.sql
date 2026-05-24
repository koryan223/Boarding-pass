-- Create the meal_credit_reset_log table that the reset function needs
CREATE TABLE IF NOT EXISTS meal_credit_reset_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    reset_type VARCHAR(20) NOT NULL CHECK (reset_type IN ('automatic', 'manual')),
    -- Consistent column name: reset_by vs triggered_by. Script 6 used reset_by. Script 9 uses triggered_by.
    -- We'll support both or standardise. Let's standardise on 'reset_by' to match previous scripts, 
    -- or add triggered_by as an alias if needed. But to match the schema found in GetIntegrations,
    -- it showed 'user_id' in one output and 'triggered_by' in script 9 read.
    -- The schema check showed: 'reset_type', 'created_at', 'students_affected', 'user_id' (from GetIntegrations output earlier).
    -- Wait, the schema check said: "Columns: id, reset_type, created_at, students_affected, user_id".
    -- So the column is 'user_id' in the live DB.
    user_id UUID REFERENCES auth.users(id),
    students_affected INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE meal_credit_reset_log ENABLE ROW LEVEL SECURITY;

-- Create policy for admins and staff to view reset logs
DROP POLICY IF EXISTS "Admin and staff can view reset logs" ON meal_credit_reset_log;
CREATE POLICY "Admin and staff can view reset logs" ON meal_credit_reset_log
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid() 
            AND role IN ('admin', 'staff')
        )
    );

-- Create policy for the reset function to insert logs
DROP POLICY IF EXISTS "System can insert reset logs" ON meal_credit_reset_log;
CREATE POLICY "System can insert reset logs" ON meal_credit_reset_log
    FOR INSERT WITH CHECK (true);
