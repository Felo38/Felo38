-- RLS, guard and ledger tests. Runs in one transaction and rolls back at the end.
-- Run with: psql -v ON_ERROR_STOP=1 -f supabase/tests/rls.test.sql
\set ON_ERROR_STOP on
begin;

-- Helpers (session-local, gone after the transaction)
create or replace function pg_temp.as_user(p_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;

create or replace function pg_temp.as_anon() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '', true);
  execute 'set local role anon';
end $$;

create or replace function pg_temp.check(ok boolean, label text) returns void language plpgsql as $$
begin
  if not coalesce(ok, false) then
    raise exception 'FAIL: %', label;
  end if;
  raise notice 'ok: %', label;
end $$;

-- Passes only if the statement raises an error.
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

-- Fixed ids from supabase/seed.sql

-- ---------------------------------------------------------------------------
-- Branches and anon access
-- ---------------------------------------------------------------------------
do $$
begin
  insert into public.branches (slug, name_ar, name_en, address_ar, active)
  values ('test-inactive', 'مخفي', 'Hidden', 'x', false);
  perform pg_temp.as_anon();
  perform pg_temp.check(not exists (select 1 from public.branches where slug = 'test-inactive'),
    'anon cannot see inactive branches');
  perform pg_temp.check(exists (select 1 from public.branches where slug = 'otr-cornich'),
    'anon can see active branches');
  perform pg_temp.blocked($q$ insert into public.branches (slug, name_ar, name_en, address_ar)
    values ('x', 'x', 'x', 'x') $q$, 'anon cannot insert branches');
  reset role;
end $$;

-- ---------------------------------------------------------------------------
-- Orders: customers see their own, staff see their branch, admin sees all
-- ---------------------------------------------------------------------------
do $$
begin
  perform pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
  perform pg_temp.check((select count(*) from public.orders) = 1
    and (select bool_and(customer_id = '00000000-0000-0000-0000-0000000000c1') from public.orders), 'customer 1 sees only own orders');
  perform pg_temp.check(not exists (select 1 from public.profiles where id = '00000000-0000-0000-0000-0000000000c2'),
    'customer 1 cannot read customer 2 profile');
  perform pg_temp.check((select count(*) from public.points_ledger) = 1,
    'customer 1 sees own points ledger');
  perform pg_temp.blocked($q$ insert into public.orders (customer_id, branch_id, type, subtotal_egp, total_egp)
    values ('00000000-0000-0000-0000-0000000000c1', (select id from public.branches limit 1),
    'pickup_asap', 10, 10) $q$, 'customer cannot insert orders directly');
  perform pg_temp.blocked($q$ update public.orders set status = 'picked_up' $q$,
    'customer cannot update order status directly');
  reset role;

  perform pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');
  perform pg_temp.check((select count(*) from public.orders) = 1
    and (select bool_and(branch_id = (select id from public.branches where slug = 'otr-cornich')) from public.orders), 'staff sees only own branch orders');
  perform pg_temp.check(not exists (select 1 from public.receipts where branch_id <> (select id from public.branches where slug = 'otr-cornich')),
    'staff sees only own branch receipts');
  reset role;

  perform pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
  perform pg_temp.check((select count(*) from public.orders) = 2, 'admin sees all orders');
  reset role;
end $$;

-- ---------------------------------------------------------------------------
-- Branch stock: staff toggle only their branch
-- ---------------------------------------------------------------------------
do $$
declare
  n integer;
begin
  perform pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');
  with u as (
    update public.branch_products set available = false
    where branch_id = (select id from public.branches where slug = 'otr-cornich') and product_id = (select id from public.products where slug = 'latte')
    returning 1
  ) select count(*) into n from u;
  perform pg_temp.check(n = 1, 'staff can mark a product out of stock at own branch');

  with u as (
    update public.branch_products set available = false
    where branch_id = (select id from public.branches where slug = 'otr-maadi-towers') returning 1
  ) select count(*) into n from u;
  perform pg_temp.check(n = 0, 'staff cannot change stock at another branch');

  with u as (
    update public.branches set accepting_orders = false returning 1
  ) select count(*) into n from u;
  perform pg_temp.check(n = 0, 'staff cannot edit branch settings');
  reset role;
end $$;

-- ---------------------------------------------------------------------------
-- Profiles: customers cannot escalate their role or branch
-- ---------------------------------------------------------------------------
do $$
declare
  n integer;
begin
  perform pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
  perform pg_temp.blocked($q$ update public.profiles set role = 'admin'
    where id = '00000000-0000-0000-0000-0000000000c1' $q$, 'customer cannot make themselves admin');
  perform pg_temp.blocked($q$ update public.profiles set role = 'branch_staff'
    where id = '00000000-0000-0000-0000-0000000000c1' $q$, 'customer cannot make themselves staff');
  perform pg_temp.blocked($q$ update public.profiles set phone = '+201999999999'
    where id = '00000000-0000-0000-0000-0000000000c1' $q$, 'customer cannot change own phone');
  perform pg_temp.blocked($q$ insert into public.profiles (id, role) values
    ('00000000-0000-0000-0000-0000000000f1', 'admin') $q$, 'customer cannot insert profiles');
  reset role;
end $$;

-- A new signup always becomes a customer, even if it sends role in its metadata.
do $$
begin
  insert into auth.users (id, aud, role, phone, raw_user_meta_data)
  values ('00000000-0000-0000-0000-0000000000d1', 'authenticated', 'authenticated', '201555555555',
    '{"role":"admin"}');
  perform pg_temp.check((select role from public.profiles
    where id = '00000000-0000-0000-0000-0000000000d1') = 'customer',
    'signup ignores role in metadata and creates a customer');
  perform pg_temp.check((select phone from public.profiles
    where id = '00000000-0000-0000-0000-0000000000d1') = '+201555555555',
    'signup stores phone as E.164');
end $$;

-- ---------------------------------------------------------------------------
-- Points ledger rules
-- ---------------------------------------------------------------------------
do $$
begin
  perform pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
  perform pg_temp.blocked($q$ insert into public.points_ledger (customer_id, type, delta, reason)
    values ('00000000-0000-0000-0000-0000000000c1', 'adjustment', 999, 'self') $q$,
    'customer cannot add points');
  reset role;

  perform pg_temp.blocked($q$ update public.points_ledger set delta = 999 $q$,
    'ledger rows cannot be updated, even by postgres');
  perform pg_temp.blocked($q$ delete from public.points_ledger $q$,
    'ledger rows cannot be deleted, even by postgres');

  perform pg_temp.blocked($q$ insert into public.points_ledger (customer_id, type, delta)
    values ('00000000-0000-0000-0000-0000000000c1', 'adjustment', 5) $q$,
    'manual adjustment without reason is rejected');
  perform pg_temp.blocked($q$ insert into public.points_ledger (customer_id, type, delta, reason)
    values ('00000000-0000-0000-0000-0000000000c1', 'redeem', 5, 'wrong sign') $q$,
    'redeem with positive delta is rejected');
  perform pg_temp.blocked($q$ insert into public.points_ledger (customer_id, type, delta, receipt_id)
    values ('00000000-0000-0000-0000-0000000000c1', 'earn', 10,
    '20000000-0000-0000-0000-0000000000a1') $q$,
    'second earn for the same receipt is rejected');

  perform pg_temp.blocked($q$ insert into public.receipts (branch_id, receipt_no, customer_id, created_by)
    values ((select id from public.branches where slug = 'otr-cornich'), 'R-0001',
    '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000b1') $q$,
    'duplicate receipt number at the same branch is rejected');

end $$;

-- Redeeming and earning for the same order: one row per type.
do $$
begin
  insert into public.points_ledger (customer_id, branch_id, type, delta, order_id, rules_version_id)
  values ('00000000-0000-0000-0000-0000000000c2',
    (select id from public.branches where slug = 'otr-maadi-towers'), 'redeem', -20,
    '10000000-0000-0000-0000-0000000000a2', null);
  perform pg_temp.blocked($q$ insert into public.points_ledger (customer_id, branch_id, type, delta, order_id)
    values ('00000000-0000-0000-0000-0000000000c2',
    (select id from public.branches where slug = 'otr-maadi-towers'), 'redeem', -20,
    '10000000-0000-0000-0000-0000000000a2') $q$, 'second redeem for the same order is rejected');
end $$;

-- ---------------------------------------------------------------------------
-- Tickets: internal notes are admin-only
-- ---------------------------------------------------------------------------
do $$
declare
  n integer;
  t uuid := '30000000-0000-0000-0000-0000000000a1';
begin
  insert into public.tickets (id, category, subject, body, customer_id, created_by)
  values (t, 'order', 'late order', 'my order is late',
    '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000c1');
  insert into public.ticket_messages (ticket_id, author_id, body, is_internal)
  values (t, '00000000-0000-0000-0000-0000000000c1', 'hello', false),
         (t, '00000000-0000-0000-0000-0000000000a1', 'internal: call the customer', true);

  perform pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
  perform pg_temp.check((select count(*) from public.ticket_messages where ticket_id = t) = 1,
    'customer sees only public ticket messages');
  perform pg_temp.blocked($q$ insert into public.ticket_messages (ticket_id, author_id, body, is_internal)
    values ('30000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000c1', 'x', true) $q$,
    'customer cannot write internal notes');
  perform pg_temp.blocked($q$ insert into public.tickets (category, subject, body, customer_id, created_by)
    values ('other', 's', 'b', '00000000-0000-0000-0000-0000000000c2',
    '00000000-0000-0000-0000-0000000000c1') $q$, 'customer cannot open a ticket for someone else');
  with u as (
    update public.tickets set status = 'resolved' returning 1
  ) select count(*) into n from u;
  perform pg_temp.check(n = 0, 'customer cannot change ticket status');
  reset role;

  perform pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
  perform pg_temp.check((select count(*) from public.ticket_messages where ticket_id = t) = 2,
    'admin sees internal notes');
  reset role;
end $$;

-- ---------------------------------------------------------------------------
-- Audit log: admin reads, nobody else
-- ---------------------------------------------------------------------------
do $$
begin
  perform pg_temp.check((select count(*) from public.audit_log) > 0, 'audit log is being written');
  perform pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
  perform pg_temp.check((select count(*) from public.audit_log) = 0, 'customer cannot read audit log');
  reset role;
  perform pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
  perform pg_temp.check((select count(*) from public.audit_log) > 0, 'admin reads audit log');
  reset role;
end $$;

rollback;
\echo 'All RLS and ledger tests passed.'
