-- Remove the meal plan check constraint to allow any number of meals per week
ALTER TABLE students DROP CONSTRAINT IF EXISTS students_meal_plan_check;

-- Add a simple constraint to ensure meal_plan is positive if provided
ALTER TABLE students ADD CONSTRAINT students_meal_plan_positive CHECK (meal_plan IS NULL OR meal_plan > 0);
