-- Orders, points and counter tests. One transaction, rolled back at the end.
-- Run after migrations and seed: psql -v ON_ERROR_STOP=1 -f supabase/tests/orders_loyalty.test.sql
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
    raise notice 'ok (blocked): % [%]', label, sqlerrm;
    return;
  end;
  raise exception 'FAIL (not blocked): %', label;
end $$;

-- Named order ids shared across role switches in this transaction.
create temp table ids (name text primary key, val uuid);
grant all on ids to public;

create or replace function pg_temp.id(p_name text) returns uuid language sql as $$
  select val from ids where name = p_name
$$;

-- Fixed ids from supabase/seed.sql
-- admin a1, cornich staff b1, customer c1 (balance 10), customer c2

-- ---------------------------------------------------------------------------
-- Points math: the SQL function must match the TypeScript tests in src/lib/loyalty
-- ---------------------------------------------------------------------------
do $$
declare
  r public.loyalty_rule_versions := (select r from public.loyalty_rule_versions r order by effective_from desc limit 1);
begin
  perform pg_temp.check(public.calculate_points(55, 85, r) = 9, 'points: floor(55*0.10 + 85*0.05) = 9');
  perform pg_temp.check(public.calculate_points(9.99, 0, r) = 0, 'points: 9.99 EGP coffee earns 0');
  perform pg_temp.check(public.calculate_points(10, 0, r) = 1, 'points: 10 EGP coffee earns 1');
  perform pg_temp.check(public.calculate_points(0, 0, r) = 0, 'points: nothing earns 0');
  perform pg_temp.check(public.calculate_points(1000, 1000, r) = 150, 'points: 1000 coffee + 1000 food = 150');
end $$;

-- ---------------------------------------------------------------------------
-- Staff records a receipt at the counter
-- ---------------------------------------------------------------------------
do $$
declare
  n integer;
begin
  perform pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');
  select points_awarded into n from public.add_in_store_points(
    '00000000-0000-0000-0000-0000000000c1', 'otr-cornich', 'R-T1', 500, 0);
  perform pg_temp.check(n = 50, 'counter receipt: 500 EGP coffee gives 50 points');
  perform pg_temp.blocked($q$ select * from public.add_in_store_points(
    '00000000-0000-0000-0000-0000000000c1', 'otr-cornich', 'R-T1', 500, 0) $q$,
    'same receipt number at the same branch is rejected');
  perform pg_temp.blocked($q$ select * from public.add_in_store_points(
    '00000000-0000-0000-0000-0000000000c1', 'otr-maadi-towers', 'R-T1', 500, 0) $q$,
    'staff cannot add points at another branch');
  reset role;
end $$;

-- Balance is now 10 + 50 = 60.
do $$
begin
  perform pg_temp.check(public.points_balance_internal('00000000-0000-0000-0000-0000000000c1') = 60,
    'balance after counter receipt is 60');
end $$;

-- ---------------------------------------------------------------------------
-- Customer places orders
-- ---------------------------------------------------------------------------
do $$
declare
  o uuid;
  cappuccino jsonb;
begin
  perform pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
  cappuccino := jsonb_build_array(jsonb_build_object(
    'product_id', (select id from public.products where slug = 'cappuccino'), 'quantity', 2));

  o := public.place_order('otr-cornich', 'pickup_asap', null, cappuccino, 0);
  reset role;
  insert into ids values ('A', o);
  perform pg_temp.check((select total_egp = 110 and status = 'pending' from public.orders where id = o),
    'order A: 2 cappuccino = 110 EGP, pending');

  perform pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
  perform pg_temp.blocked(format($q$ select public.place_order('otr-maadi-towers', 'pickup_asap', null,
    jsonb_build_array(jsonb_build_object('product_id', (select id from public.products where slug = 'croissant'), 'quantity', 1)), 0) $q$),
    'croissant is out of stock at Maadi Towers');
  perform pg_temp.blocked($q$ select public.place_order('otr-cornich', 'pickup_asap', null,
    jsonb_build_array(jsonb_build_object('product_id', (select id from public.products where slug = 'latte'), 'quantity', 0)), 0) $q$,
    'quantity 0 is rejected');
  perform pg_temp.blocked($q$ select public.place_order('otr-cornich', 'pickup_asap', null, '[]'::jsonb, 0) $q$,
    'empty cart is rejected');
  perform pg_temp.blocked($q$ select public.place_order('otr-cornich', 'pickup_asap', null,
    jsonb_build_array(jsonb_build_object('product_id', (select id from public.products where slug = 'latte'), 'quantity', 1)), 10) $q$,
    'redeem below the minimum (50 points) is rejected');
  perform pg_temp.blocked($q$ select public.place_order('otr-cornich', 'pickup_asap', null,
    jsonb_build_array(jsonb_build_object('product_id', (select id from public.products where slug = 'latte'), 'quantity', 1)), 100) $q$,
    'redeem more than the balance is rejected');
  reset role;
end $$;

-- Order B: redeem 50 points against 110 EGP (discount 5 EGP, 50 points used).
do $$
declare
  o uuid;
begin
  perform pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
  o := public.place_order('otr-cornich', 'pickup_asap', null,
    jsonb_build_array(jsonb_build_object('product_id', (select id from public.products where slug = 'cappuccino'), 'quantity', 2)), 50);
  reset role;
  insert into ids values ('B', o);
  perform pg_temp.check((select discount_egp = 5 and points_redeemed = 50 and total_egp = 105
    from public.orders where id = o), 'order B: 50 points = 5 EGP off, total 105');
  perform pg_temp.check(public.points_balance_internal('00000000-0000-0000-0000-0000000000c1') = 10,
    'redemption reserves points right away (60 - 50 = 10)');
end $$;

-- Large order: 10 espresso is at the quantity threshold, so it needs branch confirmation.
do $$
declare
  o uuid;
begin
  perform pg_temp.as_user('00000000-0000-0000-0000-0000000000c2');
  o := public.place_order('otr-cornich', 'pickup_asap', null,
    jsonb_build_array(jsonb_build_object('product_id', (select id from public.products where slug = 'espresso'), 'quantity', 10)), 0);
  reset role;
  insert into ids values ('L', o);
  perform pg_temp.check((select requires_confirmation from public.orders where id = o),
    'large order (10 items) is flagged for confirmation');
end $$;

-- Reservation must be at least 240 minutes away.
do $$
begin
  perform pg_temp.as_user('00000000-0000-0000-0000-0000000000c2');
  perform pg_temp.blocked($q$ select public.place_order('otr-cornich', 'reservation',
    to_char((now() + interval '1 hour') at time zone 'Africa/Cairo', 'YYYY-MM-DD HH24:MI'),
    jsonb_build_array(jsonb_build_object('product_id', (select id from public.products where slug = 'latte'), 'quantity', 1)), 0) $q$,
    'reservation one hour away is too soon');
  reset role;
end $$;

-- ---------------------------------------------------------------------------
-- Staff move order A through the branch flow. Earn happens only at pickup.
-- ---------------------------------------------------------------------------
do $$
declare
  a uuid := (select val from ids where name = 'A');
  s uuid := '00000000-0000-0000-0000-0000000000b1';
begin
  perform pg_temp.as_user(s);
  perform pg_temp.blocked(format($q$ select public.transition_order('%s', 'picked_up') $q$, a),
    'pending cannot jump straight to picked up');
  perform pg_temp.blocked(format($q$ select public.transition_order('%s', 'rejected') $q$, a),
    'rejecting without a reason is rejected');
  perform pg_temp.blocked(format($q$ select public.transition_order('%s', 'rescheduled', null, '2000-01-01 10:00') $q$, a),
    'rescheduling into the past is rejected');
  perform public.transition_order(a, 'accepted');
  perform public.transition_order(a, 'preparing');
  perform public.transition_order(a, 'ready');
  reset role;
  perform pg_temp.check(public.points_balance_internal('00000000-0000-0000-0000-0000000000c1') = 10,
    'no earn before pickup (still 10)');

  perform pg_temp.as_user(s);
  perform public.transition_order(a, 'picked_up');
  reset role;
  perform pg_temp.check(public.points_balance_internal('00000000-0000-0000-0000-0000000000c1') = 21,
    'pickup earns 11 points for 110 EGP coffee (balance 21)');
  perform pg_temp.check((select count(*) from public.order_status_events where order_id = a) = 5,
    'status history records every move (5 events)');
end $$;

-- Order B: rejected by the branch, so its 50 redeemed points come back.
do $$
declare
  b uuid := (select val from ids where name = 'B');
begin
  perform pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');
  perform public.transition_order(b, 'rejected', 'Out of cups');
  reset role;
  perform pg_temp.check(public.points_balance_internal('00000000-0000-0000-0000-0000000000c1') = 71,
    'rejecting order B reverses 50 points (balance 71)');
  perform pg_temp.check((select status = 'rejected' and status_reason = 'Out of cups' from public.orders where id = b),
    'rejected order keeps its reason');
end $$;

-- Reschedule a large order to a future time: the customer gets a notification.
do $$
declare
  l uuid := (select val from ids where name = 'L');
begin
  perform pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');
  perform public.transition_order(l, 'rescheduled', null,
    to_char((now() + interval '2 days') at time zone 'Africa/Cairo', 'YYYY-MM-DD HH24:MI'));
  reset role;
  perform pg_temp.check((select status = 'rescheduled' and ready_at > now() from public.orders where id = l),
    'large order rescheduled to a future ready time');
  perform pg_temp.check(exists (select 1 from public.notifications
    where user_id = '00000000-0000-0000-0000-0000000000c2' and kind = 'order_rescheduled'),
    'customer 2 gets an order_rescheduled notification');
end $$;

-- ---------------------------------------------------------------------------
-- Customers: cancel rules and isolation
-- ---------------------------------------------------------------------------
do $$
declare
  a uuid := (select val from ids where name = 'A');
  n uuid;
begin
  -- Customer 2 cancels their own large order, which is still rescheduled (allowed).
  perform pg_temp.as_user('00000000-0000-0000-0000-0000000000c2');
  perform pg_temp.blocked(format($q$ select public.cancel_order('%s', 'x') $q$, a),
    'customer 2 cannot cancel customer 1 order');
  perform public.cancel_order((select val from ids where name = 'L'), 'changed my mind');
  reset role;
  perform pg_temp.check((select status = 'cancelled' from public.orders where id = (select val from ids where name = 'L')),
    'customer can cancel own rescheduled order');

  perform pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
  perform pg_temp.blocked(format($q$ select public.cancel_order('%s', 'too late') $q$, a),
    'cannot cancel an order that was already picked up');
  reset role;
end $$;

-- Customers cannot move orders, read other balances, or look up other customers.
do $$
begin
  perform pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
  perform pg_temp.blocked(format($q$ select public.transition_order('%s', 'accepted') $q$,
    (select val from ids where name = 'A')), 'customer cannot call transition_order');
  perform pg_temp.blocked($q$ select public.points_balance_internal('00000000-0000-0000-0000-0000000000c2') $q$,
    'customer cannot read another balance');
  perform pg_temp.blocked($q$ select * from public.find_customer(null, '+201000000002') $q$,
    'customer cannot look up other customers');
  perform pg_temp.check((select count(*) from public.notifications where user_id <> auth.uid()) = 0,
    'customer sees only own notifications');
  reset role;
end $$;

-- Staff of Cornich cannot touch a Maadi Towers order.
do $$
declare
  m uuid;
begin
  perform pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
  m := public.place_order('otr-maadi-towers', 'pickup_asap', null,
    jsonb_build_array(jsonb_build_object('product_id', (select id from public.products where slug = 'latte'), 'quantity', 1)), 0);
  reset role;
  insert into ids values ('M', m);
  perform pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');
  perform pg_temp.blocked(format($q$ select public.transition_order('%s', 'accepted') $q$, m),
    'Cornich staff cannot move a Maadi Towers order');
  reset role;
end $$;

-- ---------------------------------------------------------------------------
-- Counter lookup and redemption
-- ---------------------------------------------------------------------------
do $$
declare
  f record;
  qr text := (select qr_token from public.profiles where id = '00000000-0000-0000-0000-0000000000c1');
begin
  perform pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');
  select * into f from public.find_customer(null, '+201000000001');
  perform pg_temp.check(f.customer_id = '00000000-0000-0000-0000-0000000000c1' and f.balance = 71
    and f.masked_phone = '••••0001', 'staff finds customer by phone with masked phone and balance');
  select * into f from public.find_customer(qr, null);
  perform pg_temp.check(f.customer_id = '00000000-0000-0000-0000-0000000000c1', 'staff finds customer by QR token');
  perform pg_temp.blocked($q$ select * from public.counter_redeem('00000000-0000-0000-0000-0000000000c1', 'otr-cornich', 10) $q$,
    'counter redemption below the minimum is rejected');
  perform pg_temp.blocked($q$ select * from public.counter_redeem('00000000-0000-0000-0000-0000000000c1', 'otr-maadi-towers', 60) $q$,
    'counter redemption at another branch is rejected');
  select * into f from public.counter_redeem('00000000-0000-0000-0000-0000000000c1', 'otr-cornich', 60);
  perform pg_temp.check(f.discount_egp = 6 and f.balance = 11, 'counter redeem 60 points = 6 EGP off, balance 11');
  reset role;
end $$;

-- Ledger rules still hold after all of this.
do $$
begin
  perform pg_temp.blocked($q$ update public.points_ledger set delta = 0 $q$, 'ledger stays append-only');
  perform pg_temp.check((select count(*) from public.points_ledger
    where order_id = (select val from ids where name = 'A') and type = 'earn') = 1,
    'pickup earn is recorded exactly once');
  perform pg_temp.check(public.points_balance_internal('00000000-0000-0000-0000-0000000000c1') = 11,
    'final balance matches the ledger (11)');
end $$;

rollback;
\echo 'All orders and loyalty tests passed.'
