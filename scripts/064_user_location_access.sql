-- Per-user location access for staff and dining station accounts.
-- Admins check/uncheck locations per user; a row here means "this user may work
-- with students whose base_location_id is this location".
-- Admins are never scoped and do not need rows.

CREATE TABLE IF NOT EXISTS public.user_location_access (
  user_id uuid NOT NULL REFERENCES public.user_roles(id) ON DELETE CASCADE,
  location_id uuid NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, location_id)
);

CREATE INDEX IF NOT EXISTS user_location_access_location_idx
  ON public.user_location_access (location_id);

ALTER TABLE public.user_location_access ENABLE ROW LEVEL SECURITY;

-- Users can read their own grants; all writes go through the admin API (service role).
DROP POLICY IF EXISTS "Users can view their own location access" ON public.user_location_access;
CREATE POLICY "Users can view their own location access"
  ON public.user_location_access
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Seed: give every existing staff / dining station user access to their current
-- base location so nobody loses access when scoping turns on.
INSERT INTO public.user_location_access (user_id, location_id)
SELECT id, location_id
FROM public.user_roles
WHERE role IN ('staff', 'dining_station') AND location_id IS NOT NULL
ON CONFLICT DO NOTHING;
