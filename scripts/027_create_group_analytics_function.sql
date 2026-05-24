-- Function to get group meal swipe analytics
CREATE OR REPLACE FUNCTION public.get_group_analytics(
  group_id_param UUID,
  month_param INTEGER DEFAULT EXTRACT(MONTH FROM NOW())::INTEGER
)
RETURNS TABLE (
  total_swipes BIGINT,
  student_count BIGINT,
  week_1_swipes BIGINT,
  week_2_swipes BIGINT,
  week_3_swipes BIGINT,
  week_4_swipes BIGINT,
  week_5_swipes BIGINT,
  average_swipes_per_student NUMERIC
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  month_start DATE;
  month_end DATE;
BEGIN
  -- Calculate month boundaries
  month_start := DATE_TRUNC('month', NOW() - INTERVAL '1 month' * (EXTRACT(MONTH FROM NOW())::INTEGER - month_param));
  month_end := (month_start + INTERVAL '1 month' - INTERVAL '1 day')::DATE;

  RETURN QUERY
  WITH student_list AS (
    SELECT s.uin
    FROM public.students s
    WHERE s.group_id = group_id_param
  ),
  swipe_data AS (
    SELECT 
      ms.student_uin,
      ms.swiped_at,
      EXTRACT(DAY FROM ms.swiped_at) AS day_of_month
    FROM public.meal_swipes ms
    INNER JOIN student_list sl ON ms.student_uin = sl.uin
    WHERE ms.swiped_at >= month_start 
      AND ms.swiped_at <= month_end
      AND ms.status = 'success'
  ),
  weekly_breakdown AS (
    SELECT
      COUNT(*) FILTER (WHERE day_of_month BETWEEN 1 AND 7) AS w1,
      COUNT(*) FILTER (WHERE day_of_month BETWEEN 8 AND 14) AS w2,
      COUNT(*) FILTER (WHERE day_of_month BETWEEN 15 AND 21) AS w3,
      COUNT(*) FILTER (WHERE day_of_month BETWEEN 22 AND 28) AS w4,
      COUNT(*) FILTER (WHERE day_of_month > 28) AS w5
    FROM swipe_data
  )
  SELECT
    COALESCE((SELECT COUNT(*) FROM swipe_data), 0)::BIGINT AS total_swipes,
    COALESCE((SELECT COUNT(*) FROM student_list), 0)::BIGINT AS student_count,
    COALESCE(wb.w1, 0)::BIGINT AS week_1_swipes,
    COALESCE(wb.w2, 0)::BIGINT AS week_2_swipes,
    COALESCE(wb.w3, 0)::BIGINT AS week_3_swipes,
    COALESCE(wb.w4, 0)::BIGINT AS week_4_swipes,
    COALESCE(wb.w5, 0)::BIGINT AS week_5_swipes,
    CASE 
      WHEN (SELECT COUNT(*) FROM student_list) > 0 
      THEN ROUND((SELECT COUNT(*) FROM swipe_data)::NUMERIC / (SELECT COUNT(*) FROM student_list)::NUMERIC, 2)
      ELSE 0
    END AS average_swipes_per_student
  FROM weekly_breakdown wb;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.get_group_analytics(UUID, INTEGER) TO authenticated;
