-- Simplified storage setup that works within available permissions
-- Note: Storage bucket 'student-photos' should be created manually in Supabase dashboard
-- with the following settings:
-- - Name: student-photos
-- - Public: false (private bucket)
-- - File size limit: 5MB
-- - Allowed MIME types: image/jpeg, image/png, image/webp

-- Create function to generate photo file names
CREATE OR REPLACE FUNCTION generate_photo_filename(student_uin TEXT, file_extension TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN student_uin || '_' || EXTRACT(EPOCH FROM NOW())::TEXT || '.' || file_extension;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION generate_photo_filename(TEXT, TEXT) TO authenticated;

-- Note: Storage policies should be configured in Supabase dashboard:
-- 1. Go to Storage > Policies
-- 2. Create policies for the 'student-photos' bucket
-- 3. Allow admin and staff roles to INSERT, SELECT, UPDATE, DELETE
-- 4. Use this policy condition: auth.uid() IN (SELECT user_id FROM user_roles WHERE role IN ('admin', 'staff'))
