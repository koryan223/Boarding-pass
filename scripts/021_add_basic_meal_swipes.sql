-- Check if meal_swipes table has any data
SELECT 'Current meal swipes count:' as info, COUNT(*) as count FROM meal_swipes;

-- Check if we have any students
SELECT 'Current students count:' as info, COUNT(*) as count FROM students;

-- Add some basic meal swipe data for existing students
-- Removed 'location' column as it does not exist in the schema
INSERT INTO meal_swipes (
  id,
  student_uin,
  swiped_at,
  status,
  session_id,
  swiped_by
)
SELECT 
  gen_random_uuid(),
  s.uin,
  NOW() - INTERVAL '1 day' * (random() * 30)::int - INTERVAL '1 hour' * (random() * 24)::int,
  'success',
  NULL, -- No session required
  (SELECT id FROM user_roles LIMIT 1)  -- Use the first available user
FROM students s
CROSS JOIN generate_series(1, 5) -- 5 swipes per student
LIMIT 50; -- Limit total swipes

-- Verify the data was inserted
SELECT 'Meal swipes after insert:' as info, COUNT(*) as count FROM meal_swipes;
SELECT 'Sample meal swipes:' as info, student_uin, swiped_at FROM meal_swipes LIMIT 5;
