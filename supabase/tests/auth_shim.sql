-- LOCAL TESTS ONLY, on plain Postgres. Supabase already provides auth schema, auth.uid() and roles.
-- Never run this against a Supabase project: it would replace the real auth.uid().
create schema if not exists auth;

create table if not exists auth.users (
  id uuid primary key,
  aud text,
  role text,
  email text unique,
  phone text unique,
  raw_app_meta_data jsonb,
  raw_user_meta_data jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Same logic as Supabase: read the 'sub' claim from the JWT claims GUC.
create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(coalesce(
    current_setting('request.jwt.claim.sub', true),
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'
  ), '')::uuid
$$;

do $$ begin create role anon nologin; exception when duplicate_object then null; end $$;
do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;

-- Supabase grants these by default. Without it, auth.uid() fails for signed-in roles.
grant usage on schema auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
