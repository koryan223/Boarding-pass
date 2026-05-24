-- Add DELETE policy for sessions table so admins and users can delete their own sessions

-- Allow users to delete their own sessions
CREATE POLICY "Users can delete their own sessions"
ON sessions
FOR DELETE
TO public
USING (auth.uid() = user_id);

-- Optionally, also allow admins to delete any session
-- (Uncomment if you have admin role checking)
-- CREATE POLICY "Admins can delete any session"
-- ON sessions
-- FOR DELETE
-- TO authenticated
-- USING (
--   EXISTS (
--     SELECT 1 FROM user_roles
--     WHERE user_id = auth.uid() AND role = 'admin'
--   )
-- );
