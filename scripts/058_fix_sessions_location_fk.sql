-- Fix sessions location_id foreign key to use ON DELETE SET NULL
-- This allows locations to be deleted while preserving session history

-- Drop the existing constraint
ALTER TABLE sessions DROP CONSTRAINT IF EXISTS sessions_location_id_fkey;

-- Re-add the constraint with ON DELETE SET NULL
ALTER TABLE sessions 
  ADD CONSTRAINT sessions_location_id_fkey 
  FOREIGN KEY (location_id) 
  REFERENCES locations(id) 
  ON DELETE SET NULL;

-- Also fix menus table if it has the same issue
ALTER TABLE menus DROP CONSTRAINT IF EXISTS menus_location_id_fkey;
ALTER TABLE menus 
  ADD CONSTRAINT menus_location_id_fkey 
  FOREIGN KEY (location_id) 
  REFERENCES locations(id) 
  ON DELETE CASCADE;

-- Fix user_roles location_id constraint
ALTER TABLE user_roles DROP CONSTRAINT IF EXISTS user_roles_location_id_fkey;
ALTER TABLE user_roles 
  ADD CONSTRAINT user_roles_location_id_fkey 
  FOREIGN KEY (location_id) 
  REFERENCES locations(id) 
  ON DELETE SET NULL;
