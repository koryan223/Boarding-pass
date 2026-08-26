-- Fix the weekly meal credit reset so prepaid balances are never refilled.
--
-- Problem: two ambiguous overloads of reset_weekly_credits existed (a `text`
-- version that blanket-updated EVERY student, and a `varchar` version). The
-- cron job calls the function with untyped literals, so the blanket version
-- could win and wipe/refill prepaid balances every Monday.
--
-- Fix: drop the overloads and keep a single definition that only refills
-- students on 'standard' plans.
--   - standard -> refilled to meal_plan each week
--   - prepaid  -> never refilled (balance must deplete over time)
--   - count    -> no credit limit, nothing to reset

DROP FUNCTION IF EXISTS reset_weekly_credits(text, uuid);
DROP FUNCTION IF EXISTS reset_weekly_credits(varchar, uuid);
DROP FUNCTION IF EXISTS reset_weekly_credits(character varying, uuid);

CREATE OR REPLACE FUNCTION reset_weekly_credits(
  p_reset_type text DEFAULT 'automatic',
  p_user_id uuid DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_affected integer;
BEGIN
  UPDATE students
  SET weekly_credits = meal_plan
  WHERE meal_plan_type = 'standard';

  GET DIAGNOSTICS v_affected = ROW_COUNT;

  INSERT INTO meal_credit_reset_log (reset_type, user_id, students_affected)
  VALUES (p_reset_type, p_user_id, v_affected);

  RETURN v_affected;
END;
$$;
