-- NOT YET RUN. Run only once the app version that swipes through
-- record_meal_swipe (068) is the published one: older versions still call
-- decrement_student_credit, and their swipes fail without it.
--
-- Removing it closes the last way to take a credit without recording a swipe
-- and without an audit entry.
drop function if exists public.decrement_student_credit(text);

notify pgrst, 'reload schema';
