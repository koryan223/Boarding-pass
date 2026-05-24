-- Add location_id column to menus table
ALTER TABLE menus ADD COLUMN IF NOT EXISTS location_id uuid REFERENCES locations(id);

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_menus_location ON menus(location_id);

-- Insert default menu entries for existing locations that don't have menus yet
-- This creates a full week of empty menus for each location
DO $$
DECLARE
  loc RECORD;
  day_name TEXT;
  meal_name TEXT;
  days TEXT[] := ARRAY['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  meals TEXT[] := ARRAY['Breakfast', 'Lunch', 'Dinner'];
BEGIN
  FOR loc IN SELECT id FROM locations LOOP
    FOREACH day_name IN ARRAY days LOOP
      FOREACH meal_name IN ARRAY meals LOOP
        INSERT INTO menus (id, day_of_week, meal_type, menu_items, location_id, created_at, updated_at)
        VALUES (gen_random_uuid(), day_name, meal_name, '', loc.id, NOW(), NOW())
        ON CONFLICT DO NOTHING;
      END LOOP;
    END LOOP;
  END LOOP;
END $$;

-- Create a unique constraint to prevent duplicate menus per location/day/meal
ALTER TABLE menus DROP CONSTRAINT IF EXISTS menus_location_day_meal_unique;
ALTER TABLE menus ADD CONSTRAINT menus_location_day_meal_unique UNIQUE (location_id, day_of_week, meal_type);
