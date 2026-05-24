-- Drop the location column from meal_swipes table
ALTER TABLE meal_swipes DROP COLUMN IF EXISTS location;

-- Verify the column was dropped
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'meal_swipes' 
AND table_schema = 'public'
ORDER BY ordinal_position;
