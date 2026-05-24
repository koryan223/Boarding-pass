-- Check if there are any meal swipes in the database
SELECT COUNT(*) as total_swipes FROM meal_swipes;

-- Check if there are any students to reference
SELECT COUNT(*) as total_students FROM students;

-- Check if there are any users to reference
SELECT COUNT(*) as total_users FROM user_roles;

-- If there are students but no swipes, insert some sample data
-- First, let's see what students exist
SELECT uin, first_name, last_name FROM students LIMIT 5;

-- Create sample sessions first to satisfy foreign key constraints
-- Insert sample sessions with valid user IDs from user_roles table
WITH sample_users AS (
  SELECT id FROM user_roles LIMIT 3
),
sample_sessions AS (
  INSERT INTO sessions (
    id,
    title,
    description,
    user_id,
    started_at,
    ended_at,
    duration_minutes,
    created_at,
    updated_at
  )
  SELECT 
    gen_random_uuid(),
    'Sample Session ' || ROW_NUMBER() OVER(),
    'Sample session for testing analytics',
    id,
    NOW() - INTERVAL '30 days' + (ROW_NUMBER() OVER() * INTERVAL '10 days'),
    NOW() - INTERVAL '30 days' + (ROW_NUMBER() OVER() * INTERVAL '10 days') + INTERVAL '2 hours',
    120,
    NOW() - INTERVAL '30 days' + (ROW_NUMBER() OVER() * INTERVAL '10 days'),
    NOW() - INTERVAL '30 days' + (ROW_NUMBER() OVER() * INTERVAL '10 days')
  FROM sample_users
  ON CONFLICT (id) DO NOTHING
  RETURNING id, user_id
)

-- Insert meal swipes using valid session IDs and user IDs
INSERT INTO meal_swipes (
  id,
  student_uin,
  swiped_at,
  session_id,
  swiped_by,
  status
)
SELECT 
  gen_random_uuid(),
  CASE 
    WHEN ROW_NUMBER() OVER() % 2 = 1 THEN '123456789'
    ELSE '987654321'
  END,
  NOW() - INTERVAL '1 day' - (ROW_NUMBER() OVER() * INTERVAL '2 days'),
  ss.id,
  ss.user_id,
  'success'
FROM sample_sessions ss
CROSS JOIN generate_series(1, 5) -- Create 5 swipes per session
ON CONFLICT (id) DO NOTHING;

-- Add more recent swipes for better analytics
WITH recent_sessions AS (
  SELECT id, user_id FROM sessions LIMIT 2
)
INSERT INTO meal_swipes (
  id,
  student_uin,
  swiped_at,
  session_id,
  swiped_by,
  status
) 
SELECT 
  gen_random_uuid(),
  '123456789',
  NOW() - INTERVAL '1 hour' - (ROW_NUMBER() OVER() * INTERVAL '6 hours'),
  rs.id,
  rs.user_id,
  'success'
FROM recent_sessions rs
CROSS JOIN generate_series(1, 3)
ON CONFLICT (id) DO NOTHING;

-- Verify the data was inserted
SELECT COUNT(*) as total_swipes_after_insert FROM meal_swipes;
SELECT student_uin, COUNT(*) as swipe_count FROM meal_swipes GROUP BY student_uin;
SELECT COUNT(*) as total_sessions FROM sessions;
