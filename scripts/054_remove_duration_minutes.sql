-- Remove the duration_minutes column from sessions table
-- Duration will be calculated dynamically from started_at and ended_at

ALTER TABLE sessions DROP COLUMN IF EXISTS duration_minutes;
