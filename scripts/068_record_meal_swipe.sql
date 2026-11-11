-- A meal swipe as one database step: the re-entry check, the credit deduction
-- and the swipe record either all happen or none do, so a credit can never be
-- taken without a swipe on record saying who took it.
--
-- Returns {status, weekly_credits, meal_plan}. status is 'success', 'reentry',
-- 'insufficient_credits', 'student_not_found' or 'session_not_found'; the last
-- two record nothing.
create or replace function public.record_meal_swipe(p_uin text, p_session_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_reentry_enabled boolean;
  v_student public.students%rowtype;
  v_status text;
  v_credits integer;
begin
  if v_user is null then
    raise exception 'Not signed in' using errcode = '28000';
  end if;

  select s.reentry_enabled into v_reentry_enabled from public.sessions s where s.id = p_session_id;
  if not found then
    return jsonb_build_object('status', 'session_not_found');
  end if;

  -- Holding the student's row makes overlapping swipes for one student wait their turn.
  select * into v_student from public.students st where st.uin = p_uin for no key update;
  if not found then
    return jsonb_build_object('status', 'student_not_found');
  end if;
  v_credits := v_student.weekly_credits;

  if v_reentry_enabled is true and exists (
    select 1 from public.meal_swipes m
    where m.student_uin = p_uin and m.session_id = p_session_id
      and m.status in ('success', 'reentry')
      and m.swiped_at >= clock_timestamp() - interval '1 hour'
  ) then
    v_status := 'reentry';
  elsif v_student.meal_plan_type = 'count' or (v_student.meal_plan_type is null and v_student.meal_plan = 0) then
    v_status := 'success';
  elsif v_credits <= 0 then
    v_status := 'insufficient_credits';
  else
    -- audit_row_change leaves a lone one-credit deduction out of the audit log while this flag is on.
    perform set_config('audit.swipe_credit_deduction', 'on', true);
    update public.students set weekly_credits = weekly_credits - 1 where uin = p_uin
    returning weekly_credits into v_credits;
    perform set_config('audit.swipe_credit_deduction', 'off', true);
    v_status := 'success';
  end if;

  insert into public.meal_swipes (student_uin, session_id, swiped_by, status)
  values (p_uin, p_session_id, v_user, v_status);

  return jsonb_build_object('status', v_status, 'weekly_credits', v_credits, 'meal_plan', v_student.meal_plan);
end;
$$;

revoke execute on function public.record_meal_swipe(text, uuid) from public, anon, service_role;
grant execute on function public.record_meal_swipe(text, uuid) to authenticated;

notify pgrst, 'reload schema';
