-- Create groups table
CREATE TABLE IF NOT EXISTS public.groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add group_id column to students table
ALTER TABLE public.students
ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES public.groups(id) ON DELETE SET NULL;

-- Create index for faster group lookups
CREATE INDEX IF NOT EXISTS idx_students_group_id ON public.students(group_id);

-- Enable RLS on groups table
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;

-- Policy: All authenticated users can view groups
CREATE POLICY "All authenticated users can view groups"
ON public.groups
FOR SELECT
TO authenticated
USING (true);

-- Policy: All authenticated users can manage groups
CREATE POLICY "All authenticated users can manage groups"
ON public.groups
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.groups TO authenticated;
GRANT SELECT ON public.groups TO anon;
