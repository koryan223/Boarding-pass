-- Create user roles table to associate roles with users
create table if not exists public.user_roles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('admin', 'staff', 'dining_station')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS on user_roles table
alter table public.user_roles enable row level security;

-- RLS policies for user_roles
-- Users can view their own role
create policy "users_can_view_own_role"
  on public.user_roles for select
  using (auth.uid() = id);

-- Only admins can insert/update/delete roles
create policy "admins_can_manage_roles"
  on public.user_roles for all
  using (
    exists (
      select 1 from public.user_roles
      where id = auth.uid() and role = 'admin'
    )
  );

-- Create function to get user role
create or replace function public.get_user_role(user_id uuid)
returns text
language plpgsql
security definer
as $$
declare
  user_role text;
begin
  select role into user_role
  from public.user_roles
  where id = user_id;
  
  return coalesce(user_role, null);
end;
$$;

-- Create trigger to automatically assign 'staff' role to new users
create or replace function public.handle_new_user_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_roles (id, role)
  values (new.id, 'staff')
  on conflict (id) do nothing;
  
  return new;
end;
$$;

-- Create trigger
drop trigger if exists on_auth_user_created_role on auth.users;
create trigger on_auth_user_created_role
  after insert on auth.users
  for each row
  execute function public.handle_new_user_role();
