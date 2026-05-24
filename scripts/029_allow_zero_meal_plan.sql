-- Drop the existing constraint that requires meal_plan > 0
ALTER TABLE students DROP CONSTRAINT IF EXISTS students_meal_plan_positive;

-- Add a new constraint that allows meal_plan >= 0 (0 for count plans, >0 for standard plans)
ALTER TABLE students ADD CONSTRAINT students_meal_plan_non_negative CHECK (meal_plan IS NULL OR meal_plan >= 0);
