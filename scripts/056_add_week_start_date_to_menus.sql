-- Add week_start_date column to menus table to support storing menus by week
-- This allows viewing/editing menus for different weeks (past and future)

-- Add the week_start_date column (Monday of the week)
ALTER TABLE menus ADD COLUMN IF NOT EXISTS week_start_date DATE;

-- Set default value for existing records to the current week's Monday
UPDATE menus 
SET week_start_date = date_trunc('week', CURRENT_DATE)::date 
WHERE week_start_date IS NULL;

-- Make the column NOT NULL after setting defaults
ALTER TABLE menus ALTER COLUMN week_start_date SET NOT NULL;

-- Drop the old unique constraint
ALTER TABLE menus DROP CONSTRAINT IF EXISTS menus_location_day_meal_unique;
ALTER TABLE menus DROP CONSTRAINT IF EXISTS menus_day_of_week_meal_type_key;

-- Create new unique constraint including week_start_date
ALTER TABLE menus ADD CONSTRAINT menus_location_week_day_meal_unique 
  UNIQUE (location_id, week_start_date, day_of_week, meal_type);

-- Create index for faster queries by week
CREATE INDEX IF NOT EXISTS idx_menus_week_start_date ON menus(week_start_date);
CREATE INDEX IF NOT EXISTS idx_menus_location_week ON menus(location_id, week_start_date);
