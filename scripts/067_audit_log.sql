-- Audit trail: every data change and auth event is recorded by the database
-- itself, so no code path (browser client, server routes, scheduled jobs,
-- direct SQL) can make a change without leaving a record.
--
-- The log is append-only and readable only by admins.
--
-- Meal swipes are the one exception to "every change": taking a swipe is not
-- recorded (the swipe itself is the record), and removing swipes is recorded
-- as one summary entry per delete rather than a copy of each swipe.
--
-- When a new table is added to the app, attach the two triggers to it the same
-- way as in section 2, otherwise its changes will not be recorded.

-- ---------------------------------------------------------------------------
-- 1. Log table, access rules, and recording functions
-- ---------------------------------------------------------------------------

create table if not exists public.audit_log (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default clock_timestamp(),
  actor_type text not null check (actor_type in ('user', 'anonymous', 'system', 'database')),
  actor_id uuid,
  actor_email text,
  actor_role text,
  action text not null,
  table_name text,
  record_id text,
  record_label text,
  changed_fields text[],
  old_data jsonb,
  new_data jsonb,
  metadata jsonb,
  transaction_id bigint not null default txid_current()
);

create index if not exists audit_log_actor_idx on public.audit_log (actor_id, id desc);
create index if not exists audit_log_table_idx on public.audit_log (table_name, id desc);
create index if not exists audit_log_action_idx on public.audit_log (action, id desc);
create index if not exists audit_log_occurred_at_idx on public.audit_log (occurred_at);

alter table public.audit_log enable row level security;

revoke all on public.audit_log from public, anon, authenticated, service_role;
grant select on public.audit_log to authenticated;

drop policy if exists "Admins can read the audit log" on public.audit_log;
create policy "Admins can read the audit log" on public.audit_log
  for select to authenticated
  using (
    exists (
      select 1 from public.user_roles r
      where r.id = (select auth.uid()) and r.role = 'admin'
    )
  );

-- Nobody can rewrite history: not users, not the app's server key.
create or replace function public.audit_log_reject_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'audit_log is append-only: % is not allowed', tg_op using errcode = '42501';
end;
$$;

drop trigger if exists audit_log_append_only on public.audit_log;
create trigger audit_log_append_only
  before update or delete on public.audit_log
  for each row execute function public.audit_log_reject_change();

drop trigger if exists audit_log_no_truncate on public.audit_log;
create trigger audit_log_no_truncate
  before truncate on public.audit_log
  for each statement execute function public.audit_log_reject_change();

-- Who is making the current change.
--   * Signed-in user through the API: taken from their verified session.
--   * The app's server key: taken from the x-audit-actor header, which the
--     server sets to the signed-in user (see lib/supabase/admin.ts). The header
--     is trusted ONLY for the server key, so a user cannot claim to be someone else.
--   * Scheduled jobs and the auth service: recorded as "system".
--   * Anything else (SQL editor, migrations): recorded as "database".
create or replace function public.audit_current_actor(
  out actor_id uuid,
  out actor_type text,
  out metadata jsonb
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_role text := auth.role();
  v_header text;
  v_app text := coalesce(current_setting('application_name', true), '');
begin
  if v_uid is not null then
    actor_id := v_uid;
    actor_type := 'user';
  elsif v_role = 'service_role' then
    v_header := nullif(current_setting('request.headers', true), '')::jsonb ->> 'x-audit-actor';
    if v_header ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      actor_id := v_header::uuid;
      actor_type := 'user';
    else
      actor_type := 'system';
      metadata := jsonb_build_object('source', 'app server');
    end if;
  elsif v_role = 'anon' then
    actor_type := 'anonymous';
  elsif v_app ilike 'pg_cron%' then
    actor_type := 'system';
    metadata := jsonb_build_object('source', 'scheduled job');
  elsif session_user = 'supabase_auth_admin' then
    actor_type := 'system';
    metadata := jsonb_build_object('source', 'auth service');
  else
    actor_type := 'database';
    metadata := jsonb_build_object('source', coalesce(nullif(v_app, ''), 'unknown'), 'db_role', session_user);
  end if;
end;
$$;

create or replace function public.audit_write(
  p_action text,
  p_table text,
  p_record_id text,
  p_label text,
  p_changed text[],
  p_old jsonb,
  p_new jsonb,
  p_metadata jsonb default null,
  p_actor_id uuid default null,
  p_actor_type text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := p_actor_id;
  v_actor_type text := p_actor_type;
  v_metadata jsonb := p_metadata;
  v_context record;
  v_email text;
  v_role text;
begin
  if v_actor_type is null then
    select a.actor_id, a.actor_type, a.metadata into v_context from public.audit_current_actor() a;
    v_actor_id := v_context.actor_id;
    v_actor_type := v_context.actor_type;
    if v_context.metadata is not null then
      v_metadata := coalesce(v_metadata, '{}'::jsonb) || v_context.metadata;
    end if;
  end if;

  if v_actor_id is not null then
    select u.email into v_email from auth.users u where u.id = v_actor_id;
    select r.role into v_role from public.user_roles r where r.id = v_actor_id;
  end if;

  insert into public.audit_log (
    actor_type, actor_id, actor_email, actor_role, action, table_name,
    record_id, record_label, changed_fields, old_data, new_data, metadata
  ) values (
    v_actor_type, v_actor_id, v_email, v_role, p_action, p_table,
    p_record_id, p_label, p_changed, p_old, p_new, v_metadata
  );
end;
$$;

-- Records inserts and updates, one row per changed record. Trigger arguments
-- are the primary key column(s) of the table. Updates store only the fields
-- that changed. (Deletes are handled by audit_rows_deleted below.)
create or replace function public.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_redacted constant text[] := array['pin_hash'];
  v_ignored constant text[] := array['updated_at'];
  v_before jsonb;
  v_after jsonb;
  v_row jsonb;
  v_old jsonb;
  v_new jsonb;
  v_changed text[];
  v_record_id text;
  v_label text;
  v_key text;
begin
  if tg_op = 'TRUNCATE' then
    perform public.audit_write('TRUNCATE', tg_table_name, null, 'All rows', null, null, null);
    return null;
  end if;

  if tg_op <> 'INSERT' then
    v_before := to_jsonb(old);
  end if;
  if tg_op <> 'DELETE' then
    v_after := to_jsonb(new);
  end if;
  v_row := coalesce(v_after, v_before);

  if tg_op = 'UPDATE' then
    select array_agg(n.key order by n.key) into v_changed
    from jsonb_each(v_after) n
    where n.key <> all (v_ignored) and n.value is distinct from v_before -> n.key;

    -- Nothing actually changed (e.g. re-saving identical values).
    if v_changed is null then
      return null;
    end if;

    select jsonb_object_agg(k, v_before -> k), jsonb_object_agg(k, v_after -> k)
    into v_old, v_new
    from unnest(v_changed) k;
  else
    v_old := v_before;
    v_new := v_after;
  end if;

  foreach v_key in array v_redacted loop
    if v_old ? v_key then
      v_old := jsonb_set(v_old, array[v_key], '"[redacted]"'::jsonb);
    end if;
    if v_new ? v_key then
      v_new := jsonb_set(v_new, array[v_key], '"[redacted]"'::jsonb);
    end if;
  end loop;

  if tg_nargs > 0 then
    select string_agg(v_row ->> t.k, ':' order by t.ord) into v_record_id
    from unnest(tg_argv) with ordinality as t(k, ord);
  else
    v_record_id := v_row ->> 'id';
  end if;

  v_label := case tg_table_name
    when 'students' then nullif(trim(concat_ws(' ', v_row ->> 'first_name', v_row ->> 'last_name')), '')
    when 'meal_swipes' then 'UIN ' || (v_row ->> 'student_uin')
    when 'student_pins' then 'UIN ' || (v_row ->> 'student_uin')
    when 'sessions' then v_row ->> 'title'
    when 'menus' then concat_ws(' ', v_row ->> 'day_of_week', v_row ->> 'meal_type', 'week of ' || (v_row ->> 'week_start_date'))
    when 'user_roles' then (select u.email::text from auth.users u where u.id = (v_row ->> 'id')::uuid)
    when 'user_location_access' then concat_ws(
      ' / ',
      (select u.email::text from auth.users u where u.id = (v_row ->> 'user_id')::uuid),
      (select l.name::text from public.locations l where l.id = (v_row ->> 'location_id')::uuid)
    )
    when 'session_resumes' then (select s.title from public.sessions s where s.id = (v_row ->> 'session_id')::uuid)
    when 'meal_credit_reset_log' then concat_ws(' ', v_row ->> 'reset_type', 'reset,', v_row ->> 'students_affected', 'students')
    when 'student_deletion_log' then v_row ->> 'deleted_student_name'
    else coalesce(v_row ->> 'name', v_row ->> 'title')
  end;

  perform public.audit_write(tg_op, tg_table_name, v_record_id, v_label, v_changed, v_old, v_new);
  return null;
end;
$$;

-- Records deletes for a whole statement at once, including rows removed by a
-- cascade, which is much faster for bulk deletes than recording row by row.
-- The label rules mirror the ones in audit_row_change above.
create or replace function public.audit_rows_deleted()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pk1 text := case when tg_nargs > 0 then tg_argv[0] end;
  v_pk2 text := case when tg_nargs > 1 then tg_argv[1] end;
  v_context record;
  v_email text;
  v_role text;
begin
  if not exists (select 1 from old_rows) then
    return null;
  end if;

  select a.actor_id, a.actor_type, a.metadata into v_context from public.audit_current_actor() a;
  if v_context.actor_id is not null then
    select u.email into v_email from auth.users u where u.id = v_context.actor_id;
    select r.role into v_role from public.user_roles r where r.id = v_context.actor_id;
  end if;

  insert into public.audit_log (
    actor_type, actor_id, actor_email, actor_role, action, table_name,
    record_id, record_label, old_data, metadata
  )
  select
    v_context.actor_type, v_context.actor_id, v_email, v_role, 'DELETE', tg_table_name,
    coalesce(nullif(concat_ws(':', d.j ->> v_pk1, d.j ->> v_pk2), ''), d.j ->> 'id'),
    case tg_table_name
      when 'students' then nullif(trim(concat_ws(' ', d.j ->> 'first_name', d.j ->> 'last_name')), '')
      when 'meal_swipes' then 'UIN ' || (d.j ->> 'student_uin')
      when 'student_pins' then 'UIN ' || (d.j ->> 'student_uin')
      when 'sessions' then d.j ->> 'title'
      when 'menus' then concat_ws(' ', d.j ->> 'day_of_week', d.j ->> 'meal_type', 'week of ' || (d.j ->> 'week_start_date'))
      when 'user_roles' then (select u.email::text from auth.users u where u.id = (d.j ->> 'id')::uuid)
      when 'user_location_access' then concat_ws(
        ' / ',
        (select u.email::text from auth.users u where u.id = (d.j ->> 'user_id')::uuid),
        (select l.name::text from public.locations l where l.id = (d.j ->> 'location_id')::uuid)
      )
      when 'session_resumes' then (select s.title from public.sessions s where s.id = (d.j ->> 'session_id')::uuid)
      when 'meal_credit_reset_log' then concat_ws(' ', d.j ->> 'reset_type', 'reset,', d.j ->> 'students_affected', 'students')
      when 'student_deletion_log' then d.j ->> 'deleted_student_name'
      else coalesce(d.j ->> 'name', d.j ->> 'title')
    end,
    case when d.j ? 'pin_hash' then jsonb_set(d.j, '{pin_hash}', '"[redacted]"'::jsonb) else d.j end,
    v_context.metadata
  from (select to_jsonb(o) as j from old_rows o) d;

  return null;
end;
$$;

-- Records a removal of meal swipes as a single summary entry. Copying every
-- swipe into the log costs about 6 seconds per 60,000 swipes, which pushes
-- large deletes past the API's 8 second statement limit.
create or replace function public.audit_swipes_deleted()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count bigint;
  v_summary jsonb;
begin
  select
    count(*),
    jsonb_build_object(
      'swipes', count(*),
      'students', count(distinct o.student_uin),
      'sessions', count(distinct o.session_id),
      'earliest_swipe', min(o.swiped_at),
      'latest_swipe', max(o.swiped_at)
    )
  into v_count, v_summary
  from old_rows o;

  if v_count = 0 then
    return null;
  end if;

  perform public.audit_write(
    'DELETE', tg_table_name, null,
    v_count || case when v_count = 1 then ' swipe' else ' swipes' end,
    null, v_summary, null
  );
  return null;
end;
$$;

-- Account events. These must never block sign-in or sign-up, so a failure to
-- record is downgraded to a warning here (data-change auditing above is strict).
create or replace function public.audit_auth_user_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  begin
    if tg_op = 'INSERT' then
      perform public.audit_write(
        'SIGN_UP', 'auth.users', new.id::text, new.email::text, null, null,
        jsonb_build_object('email', new.email), null, new.id, 'user'
      );
    elsif tg_op = 'DELETE' then
      perform public.audit_write(
        'ACCOUNT_DELETED', 'auth.users', old.id::text, old.email::text, null,
        jsonb_build_object('email', old.email), null
      );
    else
      if new.encrypted_password is distinct from old.encrypted_password then
        perform public.audit_write(
          'PASSWORD_CHANGE', 'auth.users', new.id::text, new.email::text, null, null, null, null, new.id, 'user'
        );
      end if;
      if new.email is distinct from old.email then
        perform public.audit_write(
          'EMAIL_CHANGE', 'auth.users', new.id::text, new.email::text, array['email'],
          jsonb_build_object('email', old.email), jsonb_build_object('email', new.email), null, new.id, 'user'
        );
      end if;
    end if;
  exception when others then
    raise warning 'audit_auth_user_event failed: %', sqlerrm;
  end;
  return null;
end;
$$;

create or replace function public.audit_auth_session_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  begin
    if tg_op = 'INSERT' then
      perform public.audit_write(
        'SIGN_IN', 'auth.sessions', new.id::text, null, null, null, null,
        nullif(jsonb_strip_nulls(jsonb_build_object('ip', host(new.ip), 'user_agent', new.user_agent)), '{}'::jsonb),
        new.user_id, 'user'
      );
    else
      perform public.audit_write(
        'SIGN_OUT', 'auth.sessions', old.id::text, null, null, null, null, null, old.user_id, 'user'
      );
    end if;
  exception when others then
    raise warning 'audit_auth_session_event failed: %', sqlerrm;
  end;
  return null;
end;
$$;

-- For actions that do not change data (currently: exporting swipe data).
-- The actor is always the caller's own verified session.
create or replace function public.log_audit_event(p_action text, p_label text, p_details jsonb default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Not signed in' using errcode = '28000';
  end if;
  if p_action is null or p_action not in ('EXPORT') then
    raise exception 'Unsupported audit action' using errcode = '22023';
  end if;
  if length(coalesce(p_label, '')) > 200 or pg_column_size(coalesce(p_details, '{}'::jsonb)) > 8192 then
    raise exception 'Audit event is too large' using errcode = '22023';
  end if;
  perform public.audit_write(p_action, null, null, p_label, null, null, null, p_details);
end;
$$;

revoke execute on function public.audit_log_reject_change() from public, anon, authenticated, service_role;
revoke execute on function public.audit_current_actor() from public, anon, authenticated, service_role;
revoke execute on function public.audit_write(text, text, text, text, text[], jsonb, jsonb, jsonb, uuid, text) from public, anon, authenticated, service_role;
revoke execute on function public.audit_row_change() from public, anon, authenticated, service_role;
revoke execute on function public.audit_rows_deleted() from public, anon, authenticated, service_role;
revoke execute on function public.audit_swipes_deleted() from public, anon, authenticated, service_role;
revoke execute on function public.audit_auth_user_event() from public, anon, authenticated, service_role;
revoke execute on function public.audit_auth_session_event() from public, anon, authenticated, service_role;
revoke execute on function public.log_audit_event(text, text, jsonb) from public, anon, service_role;
grant execute on function public.log_audit_event(text, text, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Attach recording to every table
-- ---------------------------------------------------------------------------

do $$
declare
  t record;
begin
  for t in
    select * from (values
      ('students', 'uin', null),
      ('meal_swipes', 'id', null),
      ('sessions', 'id', null),
      ('session_resumes', 'id', null),
      ('menus', 'id', null),
      ('groups', 'id', null),
      ('locations', 'id', null),
      ('user_roles', 'id', null),
      ('user_location_access', 'user_id', 'location_id'),
      ('student_pins', 'student_uin', null),
      ('meal_credit_reset_log', 'id', null),
      ('student_deletion_log', 'id', null)
    ) as v(table_name, pk1, pk2)
  loop
    execute format('drop trigger if exists audit_row_change on public.%I', t.table_name);
    execute format('drop trigger if exists audit_rows_deleted on public.%I', t.table_name);
    execute format('drop trigger if exists audit_truncate on public.%I', t.table_name);
    execute format(
      'create trigger audit_row_change after %s on public.%I for each row execute function public.audit_row_change(%s)',
      -- student_deletion_log already describes a deletion that is recorded on
      -- the students table, so only tampering with it (edit/remove) is logged.
      -- New meal swipes are not logged; edits to existing ones are.
      case when t.table_name in ('student_deletion_log', 'meal_swipes') then 'update' else 'insert or update' end,
      t.table_name,
      concat_ws(', ', quote_literal(t.pk1), quote_literal(t.pk2))
    );
    execute format(
      'create trigger audit_rows_deleted after delete on public.%I referencing old table as old_rows for each statement execute function public.%s',
      t.table_name,
      case
        when t.table_name = 'meal_swipes' then 'audit_swipes_deleted()'
        else format('audit_rows_deleted(%s)', concat_ws(', ', quote_literal(t.pk1), quote_literal(t.pk2)))
      end
    );
    execute format(
      'create trigger audit_truncate after truncate on public.%I for each statement execute function public.audit_row_change()',
      t.table_name
    );
  end loop;
end;
$$;

drop trigger if exists audit_auth_user_event on auth.users;
create trigger audit_auth_user_event
  after insert or delete or update of encrypted_password, email on auth.users
  for each row execute function public.audit_auth_user_event();

drop trigger if exists audit_auth_session_event on auth.sessions;
create trigger audit_auth_session_event
  after insert or delete on auth.sessions
  for each row execute function public.audit_auth_session_event();
