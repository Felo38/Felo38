-- Phases 3 to 5: ordering, order lifecycle, points earn and redeem, counter operations, notifications.
-- Every rule that changes money or points lives here. The app only calls these functions.

alter table public.orders add column if not exists customer_name text;
alter table public.orders add column if not exists customer_phone text;
alter table public.orders add column if not exists rules_version_id uuid references public.loyalty_rule_versions (id);

-- ---------------------------------------------------------------------------
-- Points math. Single source of truth. src/lib/loyalty/points.ts mirrors it for previews,
-- and supabase/tests/orders_loyalty.test.sql checks both agree on the same cases.
-- ---------------------------------------------------------------------------

create or replace function public.current_loyalty_rules()
returns public.loyalty_rule_versions
language sql
stable
security definer
set search_path = ''
as $$
  select r from public.loyalty_rule_versions r
  where r.effective_from <= now()
  order by r.effective_from desc
  limit 1
$$;

create or replace function public.calculate_points(
  p_coffee numeric,
  p_food numeric,
  p_rules public.loyalty_rule_versions
)
returns integer
language sql
immutable
set search_path = ''
as $$
  select floor(p_coffee * p_rules.coffee_points_per_egp + p_food * p_rules.food_points_per_egp)::integer
$$;

-- Internal only. Not granted to clients, so nobody can read another customer's balance.
create or replace function public.points_balance_internal(p_customer uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(l.delta), 0)::integer from public.points_ledger l where l.customer_id = p_customer
$$;
revoke execute on function public.points_balance_internal(uuid) from public, anon, authenticated;

-- Local Cairo wall-clock text ("2026-10-25 18:30") to timestamptz. Cairo has DST, so no fixed offset.
create or replace function public.cairo_local_to_timestamptz(p_local text)
returns timestamptz
language sql
immutable
set search_path = ''
as $$
  select (p_local::timestamp) at time zone 'Africa/Cairo'
$$;

-- ---------------------------------------------------------------------------
-- Internal helpers
-- ---------------------------------------------------------------------------

create or replace function public.notify_customer(
  p_customer uuid,
  p_order public.orders,
  p_kind text,
  p_title_ar text,
  p_title_en text,
  p_body_ar text,
  p_body_en text
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.notifications (user_id, kind, title_ar, title_en, body_ar, body_en, data)
  values (p_customer, p_kind, p_title_ar, p_title_en, p_body_ar, p_body_en,
          jsonb_build_object('order_id', p_order.id, 'order_no', p_order.order_no))
$$;
revoke execute on function public.notify_customer(uuid, public.orders, text, text, text, text, text) from public, anon, authenticated;

-- Order status machine. Returns true when the move is allowed for this actor type.
create or replace function public.order_move_allowed(
  p_from public.order_status,
  p_to public.order_status,
  p_can_cancel boolean
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case
    when p_to = 'cancelled' then p_can_cancel and p_from in ('pending', 'accepted', 'rescheduled', 'preparing', 'ready')
    when (p_from, p_to) in (
      ('pending', 'accepted'), ('pending', 'rejected'), ('pending', 'rescheduled'),
      ('rescheduled', 'accepted'), ('rescheduled', 'rejected'), ('rescheduled', 'rescheduled'),
      ('accepted', 'preparing'), ('accepted', 'rescheduled'),
      ('preparing', 'ready'),
      ('ready', 'picked_up')
    ) then true
    else false
  end
$$;

-- The only place an order's status changes. Callers check who may do it first.
create or replace function public._apply_order_status(
  p_order_id uuid,
  p_to public.order_status,
  p_reason text,
  p_ready_local text,
  p_actor uuid,
  p_notify boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
  v_from public.order_status;
  v_ready timestamptz;
  v_when text;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'Order not found'; end if;
  v_from := v_order.status;

  -- Cancel is allowed for admins and for the customer who owns the order. Other moves are staff only.
  if not public.order_move_allowed(v_from, p_to, public.is_admin() or p_actor = v_order.customer_id) then
    raise exception 'Cannot move order from % to %', v_from, p_to;
  end if;
  if p_to in ('rejected', 'cancelled') and length(btrim(coalesce(p_reason, ''))) = 0 then
    raise exception 'A reason is required';
  end if;
  if p_to = 'rescheduled' then
    v_ready := public.cairo_local_to_timestamptz(p_ready_local);
    if v_ready is null or v_ready <= now() then raise exception 'Ready time must be in the future'; end if;
  end if;

  if p_reason is not null then
    perform set_config('app.audit_reason', p_reason, true);
  end if;

  update public.orders
  set status = p_to,
      ready_at = coalesce(v_ready, ready_at),
      status_reason = coalesce(p_reason, status_reason),
      updated_at = now()
  where id = p_order_id
  returning * into v_order;

  insert into public.order_status_events (order_id, from_status, to_status, actor_id, reason)
  values (p_order_id, v_from, p_to, p_actor, p_reason);

  -- Points are reversed on rejection and cancellation. Earned only on pickup.
  if p_to in ('rejected', 'cancelled') and v_order.points_redeemed > 0 then
    insert into public.points_ledger (customer_id, branch_id, type, delta, order_id, rules_version_id, actor_id, reason)
    values (v_order.customer_id, v_order.branch_id, 'reversal', v_order.points_redeemed, v_order.id,
            v_order.rules_version_id, p_actor, p_reason);
  end if;

  if p_to = 'picked_up' then
    insert into public.points_ledger (customer_id, branch_id, type, delta, order_id, rules_version_id, actor_id)
    select v_order.customer_id, v_order.branch_id, 'earn', pts, v_order.id, v_order.rules_version_id, p_actor
    from (
      select public.calculate_points(
        coalesce(sum(oi.line_total_egp) filter (where oi.product_type = 'coffee'), 0),
        coalesce(sum(oi.line_total_egp) filter (where oi.product_type = 'food'), 0),
        (select r from public.loyalty_rule_versions r where r.id = v_order.rules_version_id)
      ) as pts
      from public.order_items oi where oi.order_id = v_order.id
    ) calc
    where pts > 0;
  end if;

  if p_notify then
    v_when := to_char(v_order.ready_at at time zone 'Africa/Cairo', 'DD/MM/YYYY "الساعة" HH24:MI');
    case p_to
      when 'accepted' then
        perform public.notify_customer(v_order.customer_id, v_order, 'order_accepted',
          'تم قبول طلبك #' || v_order.order_no, 'Order #' || v_order.order_no || ' accepted',
          'الفرع استلم طلبك وبيجهزه.', 'The branch received your order and is preparing it.');
      when 'preparing' then
        perform public.notify_customer(v_order.customer_id, v_order, 'order_preparing',
          'طلبك #' || v_order.order_no || ' بيتحضر', 'Order #' || v_order.order_no || ' is being prepared',
          'هيكون جاهز قريب.', 'It will be ready soon.');
      when 'ready' then
        perform public.notify_customer(v_order.customer_id, v_order, 'order_ready',
          'طلبك #' || v_order.order_no || ' جاهز', 'Order #' || v_order.order_no || ' is ready',
          'تعالى استلمه من الفرع.', 'Come pick it up at the branch.');
      when 'picked_up' then
        perform public.notify_customer(v_order.customer_id, v_order, 'order_picked_up',
          'شكرًا! طلبك #' || v_order.order_no || ' اتسلم', 'Thanks! Order #' || v_order.order_no || ' picked up',
          'بالتوفيق، ونشوفك قريب.', 'Enjoy, see you soon.');
      when 'rejected' then
        perform public.notify_customer(v_order.customer_id, v_order, 'order_rejected',
          'الفرع مقدرش يقبل طلبك #' || v_order.order_no, 'Order #' || v_order.order_no || ' was not accepted',
          'السبب: ' || p_reason, 'Reason: ' || p_reason);
      when 'cancelled' then
        perform public.notify_customer(v_order.customer_id, v_order, 'order_cancelled',
          'طلبك #' || v_order.order_no || ' اتلغى', 'Order #' || v_order.order_no || ' was cancelled',
          'السبب: ' || p_reason, 'Reason: ' || p_reason);
      when 'rescheduled' then
        perform public.notify_customer(v_order.customer_id, v_order, 'order_rescheduled',
          'طلبك #' || v_order.order_no || ' اتحجز', 'Order #' || v_order.order_no || ' is reserved',
          'هيكون جاهز يوم ' || v_when || '.', 'It will be ready on ' || v_when || '.');
      else null;
    end case;
  end if;
end;
$$;
revoke execute on function public._apply_order_status(uuid, public.order_status, text, text, uuid, boolean) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Customer: place and cancel orders
-- ---------------------------------------------------------------------------

create or replace function public.place_order(
  p_branch_slug text,
  p_type public.order_type,
  p_scheduled_local text,
  p_items jsonb,
  p_redeem_points integer default 0
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles;
  v_branch public.branches;
  v_rules public.loyalty_rule_versions;
  v_order_id uuid := gen_random_uuid();
  v_scheduled timestamptz;
  v_item record;
  v_product public.products;
  v_subtotal numeric(10, 2) := 0;
  v_qty integer := 0;
  v_balance integer;
  v_discount numeric(10, 2) := 0;
  v_points_used integer := 0;
  v_needs_confirm boolean := false;
begin
  if v_uid is null then raise exception 'Sign in required'; end if;

  -- Lock the customer row so two orders can't spend the same points at once.
  select * into v_profile from public.profiles where id = v_uid for update;
  if v_profile.role <> 'customer' then raise exception 'Only customers can place orders'; end if;

  select * into v_branch from public.branches where slug = p_branch_slug and active and accepting_orders;
  if not found then raise exception 'Branch is not accepting orders'; end if;

  v_rules := public.current_loyalty_rules();
  if v_rules is null then raise exception 'Loyalty rules are not configured'; end if;

  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'Cart is empty'; end if;
  if jsonb_array_length(p_items) > 50 then raise exception 'Too many items'; end if;

  if p_type = 'pickup_asap' then
    v_scheduled := null;
  else
    v_scheduled := public.cairo_local_to_timestamptz(p_scheduled_local);
    if v_scheduled is null then raise exception 'Choose a time'; end if;
  end if;
  if p_type = 'pickup_scheduled' then
    if v_scheduled <= now() then raise exception 'Choose a future time'; end if;
    if (v_scheduled at time zone 'Africa/Cairo')::date <> (now() at time zone 'Africa/Cairo')::date then
      raise exception 'Scheduled pickup must be today';
    end if;
  elsif p_type = 'reservation' then
    if v_scheduled < now() + (v_rules.min_reservation_lead_minutes * interval '1 minute') then
      raise exception 'Reservation is too soon';
    end if;
  end if;

  insert into public.orders (id, customer_id, branch_id, type, status, scheduled_for, subtotal_egp, total_egp,
                             customer_name, customer_phone, rules_version_id)
  values (v_order_id, v_uid, v_branch.id, p_type, 'pending', v_scheduled, 0, 0,
          v_profile.full_name, v_profile.phone, v_rules.id);

  for v_item in
    select (e ->> 'product_id')::uuid as product_id, (e ->> 'quantity')::integer as quantity
    from jsonb_array_elements(p_items) e
  loop
    if v_item.quantity is null or v_item.quantity < 1 or v_item.quantity > 20 then
      raise exception 'Invalid quantity';
    end if;
    -- Price comes from the database, never from the client.
    select p.* into v_product
    from public.products p
    join public.branch_products bp on bp.product_id = p.id and bp.branch_id = v_branch.id
    where p.id = v_item.product_id and p.active and bp.available;
    if not found then raise exception 'A product is not available at this branch'; end if;

    insert into public.order_items (order_id, product_id, product_name_ar, product_name_en, product_type,
                                    unit_price_egp, quantity, line_total_egp)
    values (v_order_id, v_product.id, v_product.name_ar, v_product.name_en, v_product.type,
            v_product.price_egp, v_item.quantity, v_product.price_egp * v_item.quantity);

    v_subtotal := v_subtotal + v_product.price_egp * v_item.quantity;
    v_qty := v_qty + v_item.quantity;
  end loop;

  if (v_rules.large_order_total_egp is not null and v_subtotal >= v_rules.large_order_total_egp)
     or (v_rules.large_order_quantity is not null and v_qty >= v_rules.large_order_quantity) then
    v_needs_confirm := true;
  end if;

  if coalesce(p_redeem_points, 0) > 0 then
    v_balance := public.points_balance_internal(v_uid);
    if p_redeem_points < v_rules.min_redeem_points then
      raise exception 'Minimum redemption is % points', v_rules.min_redeem_points;
    end if;
    if p_redeem_points > v_balance then raise exception 'Not enough points'; end if;
    if v_rules.redeem_egp_per_point > 0 then
      v_discount := round(least(p_redeem_points * v_rules.redeem_egp_per_point, v_subtotal), 2);
      -- Charge only the points that cover the discount actually given.
      v_points_used := ceil(v_discount / v_rules.redeem_egp_per_point)::integer;
    end if;
  end if;

  update public.orders
  set subtotal_egp = v_subtotal,
      discount_egp = v_discount,
      total_egp = v_subtotal - v_discount,
      points_redeemed = v_points_used,
      requires_confirmation = v_needs_confirm
  where id = v_order_id;

  insert into public.order_status_events (order_id, from_status, to_status, actor_id)
  values (v_order_id, null, 'pending', v_uid);

  if v_points_used > 0 then
    insert into public.points_ledger (customer_id, branch_id, type, delta, order_id, rules_version_id, actor_id)
    values (v_uid, v_branch.id, 'redeem', -v_points_used, v_order_id, v_rules.id, v_uid);
  end if;

  return v_order_id;
end;
$$;

create or replace function public.cancel_order(p_order_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
begin
  select * into v_order from public.orders where id = p_order_id;
  if not found or v_order.customer_id <> auth.uid() then raise exception 'Order not found'; end if;
  -- Customers may cancel only before the branch starts preparing.
  if v_order.status not in ('pending', 'accepted', 'rescheduled') then
    raise exception 'This order can no longer be cancelled';
  end if;
  perform public._apply_order_status(p_order_id, 'cancelled',
    coalesce(nullif(btrim(p_reason), ''), 'Cancelled by customer'), null, auth.uid(), false);
end;
$$;

-- ---------------------------------------------------------------------------
-- Staff: move orders through the branch flow
-- ---------------------------------------------------------------------------

create or replace function public.transition_order(
  p_order_id uuid,
  p_to public.order_status,
  p_reason text default null,
  p_ready_local text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_branch uuid;
begin
  select branch_id into v_branch from public.orders where id = p_order_id;
  if v_branch is null then raise exception 'Order not found'; end if;
  if not public.is_staff_of(v_branch) then raise exception 'Not allowed for this branch'; end if;
  perform public._apply_order_status(p_order_id, p_to, p_reason, p_ready_local, auth.uid(), true);
end;
$$;

-- ---------------------------------------------------------------------------
-- Staff: counter operations (in-store points and redemption)
-- ---------------------------------------------------------------------------

-- Find a customer by QR token or by phone. Staff see name, masked phone and balance only.
create or replace function public.find_customer(p_qr text, p_phone text)
returns table (customer_id uuid, full_name text, masked_phone text, balance integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_profile public.profiles;
begin
  if public.app_role() not in ('branch_staff', 'admin') then raise exception 'Not allowed'; end if;

  if nullif(btrim(coalesce(p_qr, '')), '') is not null then
    select * into v_profile from public.profiles where qr_token = btrim(p_qr) and role = 'customer';
  elsif nullif(btrim(coalesce(p_phone, '')), '') is not null then
    select * into v_profile from public.profiles where phone = btrim(p_phone) and role = 'customer';
  end if;
  if v_profile.id is null then return; end if;

  return query select v_profile.id, v_profile.full_name,
    '••••' || right(coalesce(v_profile.phone, ''), 4), public.points_balance_internal(v_profile.id);
end;
$$;

-- Adds a receipt and its points in one transaction. A receipt number can be used once per branch.
create or replace function public.add_in_store_points(
  p_customer uuid,
  p_branch_slug text,
  p_receipt_no text,
  p_coffee numeric,
  p_food numeric
)
returns table (points_awarded integer, balance integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_branch public.branches;
  v_rules public.loyalty_rule_versions;
  v_receipt_id uuid := gen_random_uuid();
  v_points integer;
begin
  select * into v_branch from public.branches where slug = p_branch_slug and active;
  if not found then raise exception 'Branch not found'; end if;
  if not public.is_staff_of(v_branch.id) then raise exception 'Not allowed for this branch'; end if;
  if length(btrim(coalesce(p_receipt_no, ''))) = 0 then raise exception 'Receipt number is required'; end if;
  if coalesce(p_coffee, 0) < 0 or coalesce(p_food, 0) < 0 or coalesce(p_coffee, 0) + coalesce(p_food, 0) > 100000 then
    raise exception 'Invalid amounts';
  end if;
  if not exists (select 1 from public.profiles where id = p_customer and role = 'customer') then
    raise exception 'Customer not found';
  end if;

  -- Lock the customer row so points and redemptions stay in order.
  perform 1 from public.profiles where id = p_customer for update;

  v_rules := public.current_loyalty_rules();
  v_points := public.calculate_points(coalesce(p_coffee, 0), coalesce(p_food, 0), v_rules);

  begin
    insert into public.receipts (id, branch_id, receipt_no, customer_id, coffee_egp, food_egp,
                                 points_awarded, rules_version_id, created_by)
    values (v_receipt_id, v_branch.id, btrim(p_receipt_no), p_customer, coalesce(p_coffee, 0),
            coalesce(p_food, 0), v_points, v_rules.id, auth.uid());
  exception when unique_violation then
    raise exception 'Receipt % was already used at this branch', btrim(p_receipt_no);
  end;

  if v_points > 0 then
    insert into public.points_ledger (customer_id, branch_id, type, delta, receipt_id, rules_version_id, actor_id)
    values (p_customer, v_branch.id, 'earn', v_points, v_receipt_id, v_rules.id, auth.uid());
  end if;

  return query select v_points, public.points_balance_internal(p_customer);
end;
$$;

-- Redeem at the counter. The cashier applies the discount on the bill.
create or replace function public.counter_redeem(p_customer uuid, p_branch_slug text, p_points integer)
returns table (discount_egp numeric, balance integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_branch public.branches;
  v_rules public.loyalty_rule_versions;
  v_balance integer;
begin
  select * into v_branch from public.branches where slug = p_branch_slug and active;
  if not found then raise exception 'Branch not found'; end if;
  if not public.is_staff_of(v_branch.id) then raise exception 'Not allowed for this branch'; end if;

  perform 1 from public.profiles where id = p_customer for update;

  v_rules := public.current_loyalty_rules();
  if p_points is null or p_points <= 0 then raise exception 'Enter a positive number of points'; end if;
  if p_points < v_rules.min_redeem_points then
    raise exception 'Minimum redemption is % points', v_rules.min_redeem_points;
  end if;
  v_balance := public.points_balance_internal(p_customer);
  if p_points > v_balance then raise exception 'Not enough points'; end if;

  insert into public.points_ledger (customer_id, branch_id, type, delta, rules_version_id, actor_id, reason)
  values (p_customer, v_branch.id, 'redeem', -p_points, v_rules.id, auth.uid(), 'counter redemption');

  return query select round(p_points * v_rules.redeem_egp_per_point, 2), v_balance - p_points;
end;
$$;

-- ---------------------------------------------------------------------------
-- Push: subscriptions for a customer's order. Only the customer or staff of that branch.
-- ---------------------------------------------------------------------------

create or replace function public.push_targets_for_order(p_order_id uuid)
returns setof public.push_subscriptions
language sql
stable
security definer
set search_path = ''
as $$
  select s.* from public.push_subscriptions s
  join public.orders o on o.customer_id = s.user_id
  where o.id = p_order_id
    and (o.customer_id = auth.uid() or public.is_staff_of(o.branch_id))
$$;

-- ---------------------------------------------------------------------------
-- Grants for the new functions. Only signed-in users may call them.
-- ---------------------------------------------------------------------------

grant execute on function public.place_order(text, public.order_type, text, jsonb, integer) to authenticated;
grant execute on function public.cancel_order(uuid, text) to authenticated;
grant execute on function public.transition_order(uuid, public.order_status, text, text) to authenticated;
grant execute on function public.find_customer(text, text) to authenticated;
grant execute on function public.add_in_store_points(uuid, text, text, numeric, numeric) to authenticated;
grant execute on function public.counter_redeem(uuid, text, integer) to authenticated;
grant execute on function public.push_targets_for_order(uuid) to authenticated;
grant execute on function public.current_loyalty_rules() to authenticated, anon;
grant execute on function public.calculate_points(numeric, numeric, public.loyalty_rule_versions) to authenticated, anon;
grant execute on function public.cairo_local_to_timestamptz(text) to authenticated, anon;

-- Realtime: the branch dashboard and the customer tracking page listen to these tables.
-- Realtime respects RLS, so each client only receives rows it may read.
do $$
begin
  alter publication supabase_realtime add table public.orders;
  alter publication supabase_realtime add table public.notifications;
exception
  when undefined_object then null;  -- plain Postgres without the supabase_realtime publication
  when duplicate_object then null;  -- already added
end $$;
