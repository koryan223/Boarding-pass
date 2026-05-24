-- Update the trigger function to assign 'dining_station' role by default instead of 'staff'
create or replace function public.handle_new_user_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Changed default role from 'staff' to 'dining_station'
  insert into public.user_roles (id, role)
  values (new.id, 'dining_station')
  on conflict (id) do nothing;
  
  return new;
end;
$$;
