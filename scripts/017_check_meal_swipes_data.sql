-- Check if there are any meal swipes records in the database
SELECT 
  COUNT(*) as total_swipes,
  COUNT(DISTINCT student_uin) as unique_students,
  MIN(swiped_at) as earliest_swipe,
  MAX(swiped_at) as latest_swipe
FROM meal_swipes;

-- Show sample meal swipes data
SELECT 
  student_uin,
  swiped_at,
  location,
  status
FROM meal_swipes 
ORDER BY swiped_at DESC 
LIMIT 10;
