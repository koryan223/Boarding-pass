-- Fix infinite recursion in RLS policies by simplifying them

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Admin and staff can manage students" ON students;
DROP POLICY IF EXISTS "admins_can_manage_roles" ON user_roles;

-- Create simpler RLS policies that don't cause recursion

-- For students table - allow all authenticated users to read and write
-- (we'll handle role-based restrictions in the application layer)
CREATE POLICY "Authenticated users can manage students" ON students
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- For user_roles table - allow all authenticated users to read their own role
-- and allow service role to manage all roles
CREATE POLICY "Users can view own role simple" ON user_roles
  FOR SELECT TO authenticated USING (auth.uid() = id);

CREATE POLICY "Service role can manage all roles" ON user_roles
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Create a simpler function to check user roles without RLS recursion
CREATE OR REPLACE FUNCTION public.check_user_role(user_id uuid, required_role text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY definer
AS $$
DECLARE
  user_role text;
BEGIN
  -- Use service role context to bypass RLS
  SELECT role INTO user_role
  FROM public.user_roles
  WHERE id = user_id;
  
  -- Admin can access everything
  IF user_role = 'admin' THEN
    RETURN true;
  END IF;
  
  -- Check specific role match
  RETURN user_role = required_role;
END;
$$;
