-- Add "reentry" as a valid status for meal_swipes

-- First, drop the existing check constraint
ALTER TABLE meal_swipes DROP CONSTRAINT IF EXISTS meal_swipes_status_check;

-- Add the updated check constraint that includes "reentry"
ALTER TABLE meal_swipes ADD CONSTRAINT meal_swipes_status_check 
  CHECK (status IN ('success', 'failed', 'insufficient_credits', 'reentry'));
