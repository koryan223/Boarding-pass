-- Update get_student_analytics function to count only successful swipes
CREATE OR REPLACE FUNCTION get_student_analytics(student_id_param text, month_param text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    result json;
    student_record record;
    start_date timestamp;
    end_date timestamp;
    last_swipe_record record;
    total_swipes integer;
    weekly_data json;
    avg_swipes numeric;
    credits_remaining integer;
    swipes_this_week integer;
    current_week_start timestamp;
BEGIN
    -- Get student info
    SELECT * INTO student_record FROM students WHERE uin = student_id_param;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Student not found';
    END IF;

    -- Parse month param (format YYYY-MM), default to current month if invalid/null
    BEGIN
        start_date := to_timestamp(month_param || '-01', 'YYYY-MM-DD');
    EXCEPTION WHEN OTHERS THEN
        start_date := date_trunc('month', now());
    END;
    
    end_date := start_date + interval '1 month';
    
    -- Get total SUCCESSFUL swipes this month, excluding re-entries
    SELECT COUNT(*) INTO total_swipes
    FROM meal_swipes
    WHERE student_uin = student_id_param
    AND swiped_at >= start_date
    AND swiped_at < end_date
    AND status = 'success';
    
    -- Get last swipe (overall, not just this month)
    SELECT * INTO last_swipe_record
    FROM meal_swipes
    WHERE student_uin = student_id_param
    ORDER BY swiped_at DESC
    LIMIT 1;
    
    -- Calculate remaining credits for the current week, counting only successful swipes
    current_week_start := date_trunc('week', now());
    
    SELECT COUNT(*) INTO swipes_this_week
    FROM meal_swipes
    WHERE student_uin = student_id_param
    AND swiped_at >= current_week_start
    AND status = 'success';
    
    credits_remaining := GREATEST(0, COALESCE(student_record.weekly_credits, 0) - swipes_this_week);

    -- Get weekly data for the month, counting only successful swipes
    WITH weekly_stats AS (
        SELECT 
            to_char(date_trunc('week', swiped_at), 'YYYY-MM-DD') as week_start,
            COUNT(*) as swipe_count
        FROM meal_swipes
        WHERE student_uin = student_id_param
        AND swiped_at >= start_date
        AND swiped_at < end_date
        AND status = 'success'
        GROUP BY date_trunc('week', swiped_at)
        ORDER BY date_trunc('week', swiped_at)
    )
    SELECT json_agg(
        json_build_object(
            'week', week_start,
            'swipeCount', swipe_count
        )
    ) INTO weekly_data
    FROM weekly_stats;
    
    -- Calculate average swipes per week (for the selected month), counting only successful swipes
    SELECT COALESCE(AVG(swipe_count), 0) INTO avg_swipes
    FROM (
        SELECT COUNT(*) as swipe_count
        FROM meal_swipes
        WHERE student_uin = student_id_param
        AND swiped_at >= start_date
        AND swiped_at < end_date
        AND status = 'success'
        GROUP BY date_trunc('week', swiped_at)
    ) sub;

    -- Build result matching StudentSwipeAnalytics interface
    result := json_build_object(
        'lastSwipe', CASE 
            WHEN last_swipe_record IS NULL THEN null 
            ELSE json_build_object(
                'date', last_swipe_record.swiped_at,
                'creditsRemaining', credits_remaining
            ) 
        END,
        'weeklySwipeData', COALESCE(weekly_data, '[]'::json),
        'averageSwipesPerWeek', COALESCE(avg_swipes, 0),
        'totalSwipesThisMonth', total_swipes
    );
    
    RETURN result;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_student_analytics(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_student_analytics(text, text) TO service_role;
