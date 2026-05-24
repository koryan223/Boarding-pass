-- Add cascade delete to meal_swipes session_id foreign key
-- This ensures that when a session is deleted, all associated meal swipes are also deleted

ALTER TABLE meal_swipes 
DROP CONSTRAINT IF EXISTS meal_swipes_session_id_fkey;

ALTER TABLE meal_swipes 
ADD CONSTRAINT meal_swipes_session_id_fkey 
FOREIGN KEY (session_id) 
REFERENCES sessions(id) 
ON DELETE CASCADE;
