-- Fix the unique constraint on menus table
-- Drop the old constraint that doesn't include week_start_date

-- Drop all possible old constraint names
ALTER TABLE menus DROP CONSTRAINT IF EXISTS menus_day_meal_location_unique;
ALTER TABLE menus DROP CONSTRAINT IF EXISTS menus_location_day_meal_unique;
ALTER TABLE menus DROP CONSTRAINT IF EXISTS menus_day_of_week_meal_type_key;
ALTER TABLE menus DROP CONSTRAINT IF EXISTS menus_day_of_week_meal_type_location_id_key;

-- Ensure the new constraint exists
ALTER TABLE menus DROP CONSTRAINT IF EXISTS menus_location_week_day_meal_unique;
ALTER TABLE menus ADD CONSTRAINT menus_location_week_day_meal_unique 
  UNIQUE (location_id, week_start_date, day_of_week, meal_type);
