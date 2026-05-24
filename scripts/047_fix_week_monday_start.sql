-- Ensure weeks start on Monday and always return 4 weeks of data
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
    reentry_this_week integer;
    current_week_start date;
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
    
    -- Calculate Monday as week start using explicit date arithmetic
    -- Get the Monday of the current week (ISO 8601: Monday = 1, Sunday = 7)
    current_week_start := CURRENT_DATE - (EXTRACT(ISODOW FROM CURRENT_DATE)::integer - 1);
    
    -- Get total SUCCESSFUL swipes this month
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
    
    -- Get successful swipes this week
    SELECT COUNT(*) INTO swipes_this_week
    FROM meal_swipes
    WHERE student_uin = student_id_param
    AND swiped_at::date >= current_week_start
    AND status = 'success';
    
    -- Get re-entries this week
    SELECT COUNT(*) INTO reentry_this_week
    FROM meal_swipes
    WHERE student_uin = student_id_param
    AND swiped_at::date >= current_week_start
    AND status = 'reentry';
    
    credits_remaining := GREATEST(0, COALESCE(student_record.weekly_credits, 0) - swipes_this_week);

    -- Get detailed weekly data with Monday as week start
    WITH weekly_stats AS (
        SELECT 
            -- Calculate Monday of each week explicitly
            (swiped_at::date - (EXTRACT(ISODOW FROM swiped_at)::integer - 1)) as week_monday,
            COUNT(*) FILTER (WHERE status = 'success') as success_count,
            COUNT(*) FILTER (WHERE status = 'reentry') as reentry_count,
            COUNT(*) FILTER (WHERE status = 'insufficient_credits') as fail_count,
            COUNT(*) FILTER (WHERE status = 'success') as swipe_count
        FROM meal_swipes
        WHERE student_uin = student_id_param
        AND swiped_at >= start_date
        AND swiped_at < end_date
        GROUP BY week_monday
        ORDER BY week_monday
    )
    SELECT json_agg(
        json_build_object(
            'week', to_char(week_monday, 'YYYY-MM-DD'),
            'swipeCount', swipe_count,
            'successCount', success_count,
            'reentryCount', reentry_count,
            'failCount', fail_count
        )
    ) INTO weekly_data
    FROM weekly_stats;
    
    -- Calculate average swipes per week
    SELECT COALESCE(AVG(swipe_count), 0) INTO avg_swipes
    FROM (
        SELECT COUNT(*) as swipe_count
        FROM meal_swipes
        WHERE student_uin = student_id_param
        AND swiped_at >= start_date
        AND swiped_at < end_date
        AND status = 'success'
        GROUP BY (swiped_at::date - (EXTRACT(ISODOW FROM swiped_at)::integer - 1))
    ) sub;

    -- Build result
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
        'totalSwipesThisMonth', total_swipes,
        'swipesThisWeek', swipes_this_week,
        'reentryThisWeek', reentry_this_week
    );
    
    RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION get_student_analytics(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_student_analytics(text, text) TO service_role;
