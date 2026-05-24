-- Add pending role to user_roles table and update default role trigger

-- Update the role check constraint to include 'pending'
ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_role_check;
ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_role_check 
  CHECK (role IN ('admin', 'staff', 'dining_station', 'pending'));

-- Update the trigger function to assign 'pending' role to new users instead of 'staff'
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_roles (id, role)
  VALUES (new.id, 'pending')
  ON CONFLICT (id) DO NOTHING;
  
  RETURN new;
END;
$$;
