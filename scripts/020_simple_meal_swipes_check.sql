-- Check current meal swipes data
SELECT 'Current meal swipes count:' as info, COUNT(*) as count FROM meal_swipes;
SELECT 'Current students count:' as info, COUNT(*) as count FROM students;
SELECT 'Current sessions count:' as info, COUNT(*) as count FROM sessions;

-- Show sample data if exists
SELECT 'Sample meal swipes:' as info;
SELECT student_uin, swiped_at, status FROM meal_swipes ORDER BY swiped_at DESC LIMIT 5;

-- If no meal swipes exist, insert some simple test data
DO $$
DECLARE
    student_record RECORD;
    session_uuid UUID;
    user_uuid UUID;
BEGIN
    -- Check if meal_swipes table is empty
    IF (SELECT COUNT(*) FROM meal_swipes) = 0 THEN
        RAISE NOTICE 'No meal swipes found. Adding test data...';
        
        -- Get a user ID from user_roles table
        SELECT id INTO user_uuid FROM user_roles LIMIT 1;
        
        IF user_uuid IS NULL THEN
            RAISE NOTICE 'No users found in user_roles table';
            RETURN;
        END IF;
        
        -- Create a simple test session
        session_uuid := gen_random_uuid();
        INSERT INTO sessions (id, title, user_id, started_at, created_at, updated_at)
        VALUES (session_uuid, 'Test Session', user_uuid, NOW() - INTERVAL '2 hours', NOW(), NOW());
        
        -- Add meal swipes for existing students
        FOR student_record IN SELECT uin FROM students LIMIT 3 LOOP
            -- Add some swipes from today
            INSERT INTO meal_swipes (id, student_uin, session_id, swiped_by, swiped_at, location, status)
            VALUES 
                (gen_random_uuid(), student_record.uin, session_uuid, user_uuid, NOW() - INTERVAL '1 hour', 'Main Dining Hall', 'success'),
                (gen_random_uuid(), student_record.uin, session_uuid, user_uuid, NOW() - INTERVAL '1 day', 'Main Dining Hall', 'success'),
                (gen_random_uuid(), student_record.uin, session_uuid, user_uuid, NOW() - INTERVAL '2 days', 'Main Dining Hall', 'success'),
                (gen_random_uuid(), student_record.uin, session_uuid, user_uuid, NOW() - INTERVAL '3 days', 'Main Dining Hall', 'success'),
                (gen_random_uuid(), student_record.uin, session_uuid, user_uuid, NOW() - INTERVAL '1 week', 'Main Dining Hall', 'success');
        END LOOP;
        
        RAISE NOTICE 'Test meal swipes added successfully';
    ELSE
        RAISE NOTICE 'Meal swipes already exist in database';
    END IF;
END $$;

-- Show final count
SELECT 'Final meal swipes count:' as info, COUNT(*) as count FROM meal_swipes;
