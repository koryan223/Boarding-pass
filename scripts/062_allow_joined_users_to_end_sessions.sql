-- Allow any authenticated user to update sessions (not just the creator),
-- so a user who JOINS a session can also end it. This matches the app's
-- shared-session model and the existing "all authenticated users can view" policy.
--
-- Root cause: the previous policy "Users can update their own sessions" used
-- USING (auth.uid() = user_id), so a non-owner's UPDATE (ending the session)
-- matched zero rows under RLS and silently succeeded without setting ended_at.
-- The session therefore stayed open and kept appearing as joinable.

DROP POLICY IF EXISTS "Users can update their own sessions" ON public.sessions;

CREATE POLICY "Authenticated users can update sessions"
ON public.sessions
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);
