-- Add base_location_id column to students table
ALTER TABLE students
ADD COLUMN IF NOT EXISTS base_location_id uuid REFERENCES locations(id) ON DELETE SET NULL;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_students_base_location ON students(base_location_id);

-- Add comment to explain the column
COMMENT ON COLUMN students.base_location_id IS 'Base dining location for the student (nullable, shows as unassigned if null)';
