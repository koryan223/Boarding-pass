-- Migrate user_roles.base_location from varchar to uuid foreign key

-- Step 1: Add new location_id column
ALTER TABLE user_roles ADD COLUMN IF NOT EXISTS location_id uuid REFERENCES locations(id) ON DELETE SET NULL;

-- Step 2: Migrate existing base_location string values to location_id
-- Match location names to location IDs
UPDATE user_roles
SET location_id = locations.id
FROM locations
WHERE LOWER(user_roles.base_location) = LOWER(locations.name)
  AND user_roles.base_location IS NOT NULL
  AND user_roles.base_location != 'unassigned';

-- Step 3: Create index for performance
CREATE INDEX IF NOT EXISTS idx_user_roles_location ON user_roles(location_id);

-- Step 4: Drop the old base_location column
ALTER TABLE user_roles DROP COLUMN IF EXISTS base_location;

-- Step 5: Add comment
COMMENT ON COLUMN user_roles.location_id IS 'Foreign key to locations table (nullable, NULL means unassigned)';
