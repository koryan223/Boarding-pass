-- Make room_number column nullable in students table
-- This allows importing students without room numbers

ALTER TABLE students ALTER COLUMN room_number DROP NOT NULL;

-- Verify the change
SELECT column_name, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'students' AND column_name = 'room_number';
