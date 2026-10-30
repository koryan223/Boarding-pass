-- meal_swipes only had a primary key, so per-session swipe counts (Past Sessions)
-- scanned the whole table for every session and hit the 8s statement timeout.
CREATE INDEX IF NOT EXISTS meal_swipes_session_id_idx ON public.meal_swipes (session_id);
CREATE INDEX IF NOT EXISTS meal_swipes_student_uin_idx ON public.meal_swipes (student_uin);
CREATE INDEX IF NOT EXISTS meal_swipes_swiped_at_idx ON public.meal_swipes (swiped_at);
