-- Updated to run at 11:30 PM Sunday Central Time
-- 11:30 PM Sunday CST (Central Standard Time) = 5:30 AM Monday UTC
-- Note: This uses standard time and won't auto-adjust for daylight saving

-- First, unschedule the old cron job
SELECT cron.unschedule('weekly-meal-credit-reset');

-- Schedule at 5:30 AM UTC Monday (11:30 PM Sunday CST)
SELECT cron.schedule(
  'weekly-meal-credit-reset',
  '30 5 * * 1', -- Every Monday at 5:30 AM UTC (11:30 PM Sunday CST)
  $$
  SELECT reset_meal_credits();
  $$
);

-- Verify the new schedule
SELECT * FROM cron.job WHERE jobname = 'weekly-meal-credit-reset';
