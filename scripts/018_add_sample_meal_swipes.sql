-- Add sample meal swipe data for testing analytics
-- This will create meal swipes for existing students

-- First, let's create some sample meal swipes for the current month
-- Removed 'location' column as it does not exist in the schema
INSERT INTO meal_swipes (id, student_uin, swiped_at, status, swiped_by, session_id)
SELECT 
  gen_random_uuid(),
  s.uin,
  -- Create swipes over the past 30 days
  NOW() - INTERVAL '1 day' * (random() * 30),
  -- Changed status from 'completed' to 'success' to match check constraint
  'success',
  (SELECT id FROM user_roles LIMIT 1), -- Use first available user as swiped_by
  (SELECT id FROM sessions ORDER BY created_at DESC LIMIT 1) -- Use most recent session
FROM students s
CROSS JOIN generate_series(1, (random() * 15 + 5)::int) -- 5-20 swipes per student
WHERE s.uin IS NOT NULL
LIMIT 200; -- Limit total swipes to prevent too much data

-- Add some swipes for this week specifically
-- Removed 'location' column as it does not exist in the schema
INSERT INTO meal_swipes (id, student_uin, swiped_at, status, swiped_by, session_id)
SELECT 
  gen_random_uuid(),
  s.uin,
  -- Create swipes for this week
  NOW() - INTERVAL '1 day' * (random() * 7),
  -- Changed status from 'completed' to 'success' to match check constraint
  'success',
  (SELECT id FROM user_roles LIMIT 1),
  (SELECT id FROM sessions ORDER BY created_at DESC LIMIT 1)
FROM students s
CROSS JOIN generate_series(1, (random() * 5 + 2)::int) -- 2-7 swipes per student this week
WHERE s.uin IS NOT NULL
LIMIT 100;

-- Verify the data was created
SELECT 
  COUNT(*) as total_swipes,
  COUNT(DISTINCT student_uin) as students_with_swipes,
  MIN(swiped_at) as earliest_swipe,
  MAX(swiped_at) as latest_swipe
FROM meal_swipes;
