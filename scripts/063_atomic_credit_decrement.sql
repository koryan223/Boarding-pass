-- Atomically deduct one meal credit. Replaces the app's read-then-write update,
-- which lost deductions when two swipes for the same student overlapped.
-- Returns the new balance, or no row if the student had no credits left.
CREATE OR REPLACE FUNCTION public.decrement_student_credit(p_uin text)
RETURNS integer
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
  UPDATE students
  SET weekly_credits = weekly_credits - 1
  WHERE uin = p_uin AND weekly_credits > 0
  RETURNING weekly_credits;
$$;

GRANT EXECUTE ON FUNCTION public.decrement_student_credit(text) TO authenticated;
