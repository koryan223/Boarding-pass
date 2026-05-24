-- Drop the old unique constraint that doesn't include location_id
ALTER TABLE menus DROP CONSTRAINT IF EXISTS menus_day_of_week_meal_type_key;

-- Drop the new constraint if it exists (in case migration was partially run)
ALTER TABLE menus DROP CONSTRAINT IF EXISTS menus_day_meal_location_unique;

-- Create the correct unique constraint that includes location_id
ALTER TABLE menus ADD CONSTRAINT menus_day_meal_location_unique 
  UNIQUE (day_of_week, meal_type, location_id);
