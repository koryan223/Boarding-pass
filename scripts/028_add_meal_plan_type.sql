-- Add meal_plan_type column to students table
-- 'standard' = deduct credits from weekly allowance
-- 'count' = just count swipes, no credit deduction

ALTER TABLE students ADD COLUMN IF NOT EXISTS meal_plan_type VARCHAR(20) DEFAULT 'standard';

-- Add constraint to ensure valid values
ALTER TABLE students DROP CONSTRAINT IF EXISTS students_meal_plan_type_check;
ALTER TABLE students ADD CONSTRAINT students_meal_plan_type_check 
  CHECK (meal_plan_type IN ('standard', 'count'));

-- Update existing students to have 'standard' type if null
UPDATE students SET meal_plan_type = 'standard' WHERE meal_plan_type IS NULL;
