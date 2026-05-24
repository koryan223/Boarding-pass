-- Fix the cron job to call the correct function name
-- The function is called reset_weekly_credits, not reset_meal_credits

-- First, unschedule the incorrect job
SELECT cron.unschedule('weekly-meal-credit-reset');

-- Recreate with the correct function name
SELECT cron.schedule(
    'weekly-meal-credit-reset',
    '30 5 * * 1', -- 5:30 AM UTC Monday = 11:30 PM Sunday Central Time
    $$SELECT reset_weekly_credits('automatic', NULL)$$
);
