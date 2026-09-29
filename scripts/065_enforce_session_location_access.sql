-- Enforce per-user location access for starting and joining sessions.
-- Sessions are created/joined from the browser client, so the check must live
-- in the database rather than only in the UI.

CREATE OR REPLACE FUNCTION public.user_can_access_location(p_user_id uuid, p_location_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_location_id IS NULL THEN false
    WHEN EXISTS (SELECT 1 FROM user_roles WHERE id = p_user_id AND role = 'admin') THEN true
    ELSE EXISTS (
      SELECT 1 FROM user_location_access
      WHERE user_id = p_user_id AND location_id = p_location_id
    )
  END;
$$;

-- Location IDs the current user may start/join sessions at (all locations for admins).
CREATE OR REPLACE FUNCTION public.my_accessible_location_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT l.id FROM locations l
  WHERE public.user_can_access_location(auth.uid(), l.id);
$$;

GRANT EXECUTE ON FUNCTION public.user_can_access_location(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_accessible_location_ids() TO authenticated;

-- auth.uid() is NULL for service-role/cron writes, which are trusted and skipped.
CREATE OR REPLACE FUNCTION public.enforce_session_location_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.location_id IS NULL THEN
    RAISE EXCEPTION 'A location is required to start a session';
  END IF;

  IF NOT public.user_can_access_location(auth.uid(), NEW.location_id) THEN
    RAISE EXCEPTION 'You do not have access to this location';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_session_location_access ON public.sessions;
CREATE TRIGGER enforce_session_location_access
  BEFORE INSERT OR UPDATE OF location_id ON public.sessions
  FOR EACH ROW EXECUTE FUNCTION public.enforce_session_location_access();

CREATE OR REPLACE FUNCTION public.enforce_session_join_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_location uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT location_id INTO v_location FROM sessions WHERE id = NEW.session_id;

  -- Legacy sessions without a location stay joinable by admins only.
  IF NOT public.user_can_access_location(auth.uid(), v_location)
     AND NOT EXISTS (SELECT 1 FROM user_roles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'You do not have access to this session''s location';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_session_join_access ON public.session_resumes;
CREATE TRIGGER enforce_session_join_access
  BEFORE INSERT ON public.session_resumes
  FOR EACH ROW EXECUTE FUNCTION public.enforce_session_join_access();
