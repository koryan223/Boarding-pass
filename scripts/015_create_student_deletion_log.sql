-- Create table to track student deletions for audit purposes
CREATE TABLE IF NOT EXISTS student_deletion_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  deleted_student_uin VARCHAR(9) NOT NULL,
  deleted_student_name VARCHAR(255) NOT NULL,
  deleted_student_data JSONB NOT NULL, -- Store complete student record
  deleted_by_user_id UUID NOT NULL,
  deleted_by_user_email VARCHAR(255) NOT NULL,
  deleted_by_user_role VARCHAR(50) NOT NULL,
  deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  reason TEXT
);

-- Add RLS policy for deletion log (only admin/staff can view)
ALTER TABLE student_deletion_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin and staff can view deletion log" ON student_deletion_log
  FOR SELECT USING (true); -- Will be controlled at application level

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_student_deletion_log_uin ON student_deletion_log(deleted_student_uin);
CREATE INDEX IF NOT EXISTS idx_student_deletion_log_deleted_by ON student_deletion_log(deleted_by_user_id);
CREATE INDEX IF NOT EXISTS idx_student_deletion_log_deleted_at ON student_deletion_log(deleted_at);
