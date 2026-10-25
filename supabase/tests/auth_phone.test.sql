-- Phone and Google accounts. One transaction, rolled back at the end.
\set ON_ERROR_STOP on
begin;

create or replace function pg_temp.as_user(p_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;

create or replace function pg_temp.check(ok boolean, label text) returns void language plpgsql as $$
begin
  if not coalesce(ok, false) then raise exception 'FAIL: %', label; end if;
  raise notice 'ok: %', label;
end $$;

create or replace function pg_temp.blocked(p_sql text, label text) returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    raise notice 'ok (blocked): %', label;
    return;
  end;
  raise exception 'FAIL (not blocked): %', label;
end $$;

-- A Google user has no phone at sign-up.
do $$
begin
  insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data)
  values ('00000000-0000-0000-0000-0000000000e1', 'authenticated', 'authenticated', 'google.user@example.test',
    '{"provider":"google"}', '{}');
  perform pg_temp.check((select phone is null from public.profiles where id = '00000000-0000-0000-0000-0000000000e1'),
    'google sign-up creates a profile without a phone');
end $$;

-- Verifying a phone (Auth sets auth.users.phone) copies it to the profile in E.164.
do $$
begin
  update auth.users set phone = '201777777777' where id = '00000000-0000-0000-0000-0000000000e1';
  perform pg_temp.check((select phone = '+201777777777' from public.profiles
    where id = '00000000-0000-0000-0000-0000000000e1'), 'verified phone is copied to the profile');
end $$;

-- A user can't type in a phone that Auth didn't verify.
do $$
begin
  perform pg_temp.as_user('00000000-0000-0000-0000-0000000000e1');
  perform pg_temp.blocked($q$ update public.profiles set phone = '+201888888888'
    where id = '00000000-0000-0000-0000-0000000000e1' $q$, 'unverified phone on profile is rejected');
  reset role;
end $$;

-- Another account can't claim a phone that is already in use.
do $$
begin
  perform pg_temp.blocked($q$ update auth.users set phone = '201000000001'
    where id = '00000000-0000-0000-0000-0000000000e1' $q$, 'phone already used by another account is rejected');
end $$;

rollback;
\echo 'All phone and Google account tests passed.'
