-- Server-side auto-close for stale sessions (2-hour inactivity window).
--
-- Previously, auto-close only ran client-side (contexts/session-context.tsx),
-- so stale sessions were never closed unless someone had the app open in a
-- browser. This moves the authoritative logic into the database and schedules
-- it via pg_cron so it runs even when no browser is open.
--
-- "Last activity" = the most recent swipe for the session, or started_at if the
-- session has no swipes yet.

CREATE OR REPLACE FUNCTION auto_close_stale_sessions()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_closed integer;
  v_now timestamptz := now();
  v_cutoff timestamptz := now() - interval '2 hours';
BEGIN
  WITH stale AS (
    SELECT s.id
    FROM sessions s
    LEFT JOIN (
      SELECT session_id, max(swiped_at) AS last_swipe
      FROM meal_swipes
      GROUP BY session_id
    ) ms ON ms.session_id = s.id
    WHERE s.ended_at IS NULL
      AND COALESCE(ms.last_swipe, s.started_at) < v_cutoff
  )
  UPDATE sessions
  SET ended_at = v_now, updated_at = v_now
  WHERE id IN (SELECT id FROM stale);

  GET DIAGNOSTICS v_closed = ROW_COUNT;
  RAISE NOTICE 'auto_close_stale_sessions closed % sessions', v_closed;
  RETURN v_closed;
END;
$$;

-- (Re)schedule the cron job to run every 5 minutes.
SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname = 'auto-close-stale-sessions';

SELECT cron.schedule(
  'auto-close-stale-sessions',
  '*/5 * * * *',
  $$SELECT auto_close_stale_sessions();$$
);
