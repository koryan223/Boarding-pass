-- Increase room_number column length to accommodate longer room identifiers
-- Current limit is VARCHAR(4), which is too short for values like "Newman EE"

ALTER TABLE students 
ALTER COLUMN room_number TYPE VARCHAR(50);

-- Add a comment explaining the column
COMMENT ON COLUMN students.room_number IS 'Room number or location identifier (e.g., "Newman EE", "101A")';
