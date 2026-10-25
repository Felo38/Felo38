-- On the Run: helper functions, guard triggers, RLS policies, grants.
-- Rule: every table has RLS on. Sensitive writes (points, order status) are added as
-- SECURITY DEFINER functions in later phases that check the caller's role inside the function.

-- ---------------------------------------------------------------------------
-- Helper functions used by policies
-- ---------------------------------------------------------------------------

create or replace function public.app_role()
returns public.user_role
language sql
stable
security definer
set search_path = ''
as $$
  select p.role from public.profiles p where p.id = auth.uid()
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.app_role() = 'admin', false)
$$;

-- True for an admin, or for branch staff of exactly this branch.
create or replace function public.is_staff_of(p_branch_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and (p.role = 'admin' or (p.role = 'branch_staff' and p.branch_id = p_branch_id))
  )
$$;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

-- Every new auth user gets a customer profile. The role is never taken from user metadata,
-- so a client can't sign up as staff or admin.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, phone)
  values (
    new.id,
    case
      when new.phone is null or new.phone = '' then null
      when left(new.phone, 1) = '+' then new.phone
      else '+' || new.phone
    end
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- A user can edit their own profile (name, locale, default branch), but not their role,
-- branch or phone. Only an admin can change those.
create or replace function public.guard_profile_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    if new.role is distinct from old.role
      or new.branch_id is distinct from old.branch_id
      or new.phone is distinct from old.phone then
      raise exception 'Only an admin can change role, branch or phone';
    end if;
  end if;
  return new;
end;
$$;

create trigger profiles_guard_changes
  before update on public.profiles
  for each row execute function public.guard_profile_changes();

-- Points ledger is append-only. Corrections are new rows.
create or replace function public.forbid_ledger_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'points_ledger is append-only';
end;
$$;

create trigger points_ledger_append_only
  before update or delete on public.points_ledger
  for each row execute function public.forbid_ledger_mutation();

-- Audit: every change to these tables is written to audit_log.
-- The actor is auth.uid(). The reason comes from the transaction setting app.audit_reason,
-- which the app sets with set_config() before a change that needs one.
create or replace function public.write_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.audit_log (actor_id, action, entity, entity_id, before_data, after_data, reason)
  values (
    auth.uid(),
    tg_op,
    tg_table_name,
    coalesce(to_jsonb(new) ->> 'id', to_jsonb(old) ->> 'id'),
    case when tg_op <> 'INSERT' then to_jsonb(old) end,
    case when tg_op <> 'DELETE' then to_jsonb(new) end,
    nullif(current_setting('app.audit_reason', true), '')
  );
  return null;
end;
$$;

create trigger audit_branches after insert or update or delete on public.branches
  for each row execute function public.write_audit();
create trigger audit_categories after insert or update or delete on public.categories
  for each row execute function public.write_audit();
create trigger audit_products after insert or update or delete on public.products
  for each row execute function public.write_audit();
create trigger audit_branch_products after insert or update or delete on public.branch_products
  for each row execute function public.write_audit();
create trigger audit_loyalty_rules after insert on public.loyalty_rule_versions
  for each row execute function public.write_audit();
create trigger audit_profiles after update of role, branch_id, phone on public.profiles
  for each row execute function public.write_audit();
create trigger audit_points_ledger after insert on public.points_ledger
  for each row execute function public.write_audit();
create trigger audit_orders after update on public.orders
  for each row execute function public.write_audit();
create trigger audit_tickets after update on public.tickets
  for each row execute function public.write_audit();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.branches enable row level security;
alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.branch_products enable row level security;
alter table public.loyalty_rule_versions enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_status_events enable row level security;
alter table public.receipts enable row level security;
alter table public.points_ledger enable row level security;
alter table public.tickets enable row level security;
alter table public.ticket_messages enable row level security;
alter table public.notifications enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.audit_log enable row level security;

-- branches: public sees active branches. Staff also see their own branch while inactive.
create policy branches_select on public.branches for select
  using (active or public.is_staff_of(id));
create policy branches_admin_insert on public.branches for insert
  with check (public.is_admin());
create policy branches_admin_update on public.branches for update
  using (public.is_admin()) with check (public.is_admin());
create policy branches_admin_delete on public.branches for delete
  using (public.is_admin());

-- profiles: only yourself or an admin. Staff look customers up through functions, not directly.
create policy profiles_select on public.profiles for select
  using (id = auth.uid() or public.is_admin());
create policy profiles_update on public.profiles for update
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

-- categories and products: public sees active ones. Admin manages them.
create policy categories_select on public.categories for select
  using (active or public.is_admin());
create policy categories_admin_write on public.categories for all
  using (public.is_admin()) with check (public.is_admin());

create policy products_select on public.products for select
  using (active or public.is_admin());
create policy products_admin_write on public.products for all
  using (public.is_admin()) with check (public.is_admin());

-- branch_products: public reads the menu. Staff toggle stock for their own branch only.
create policy branch_products_select on public.branch_products for select
  using (true);
create policy branch_products_admin_insert on public.branch_products for insert
  with check (public.is_admin());
create policy branch_products_admin_delete on public.branch_products for delete
  using (public.is_admin());
create policy branch_products_staff_update on public.branch_products for update
  using (public.is_staff_of(branch_id)) with check (public.is_staff_of(branch_id));

-- loyalty rules: public reads them (the loyalty page explains the math). Admin adds versions.
create policy loyalty_rules_select on public.loyalty_rule_versions for select
  using (true);
create policy loyalty_rules_admin_insert on public.loyalty_rule_versions for insert
  with check (public.is_admin());

-- orders: the customer sees their own, staff sees their branch, admin sees all.
-- No direct writes. Orders change only through functions.
create policy orders_select on public.orders for select
  using (customer_id = auth.uid() or public.is_staff_of(branch_id));

create policy order_items_select on public.order_items for select
  using (exists (select 1 from public.orders o where o.id = order_id));

create policy order_status_events_select on public.order_status_events for select
  using (exists (select 1 from public.orders o where o.id = order_id));

-- receipts and points ledger: the customer sees their own, staff sees their branch.
create policy receipts_select on public.receipts for select
  using (customer_id = auth.uid() or public.is_staff_of(branch_id));

create policy points_ledger_select on public.points_ledger for select
  using (customer_id = auth.uid() or public.is_staff_of(branch_id));

-- tickets: the creator, admin, and staff of the ticket's branch can see them.
-- Only admin updates them (status, assignee).
create policy tickets_select on public.tickets for select
  using (created_by = auth.uid() or public.is_staff_of(branch_id) or public.is_admin()
         or customer_id = auth.uid());
create policy tickets_insert on public.tickets for insert
  with check (
    created_by = auth.uid()
    and (
      (customer_id = auth.uid() and branch_id is null and public.app_role() = 'customer'
        and (order_id is null or exists (
          select 1 from public.orders o where o.id = order_id and o.customer_id = auth.uid())))
      or (branch_id is not null and public.is_staff_of(branch_id))
    )
  );
create policy tickets_admin_update on public.tickets for update
  using (public.is_admin()) with check (public.is_admin());

-- ticket messages: follow the ticket's visibility. Internal notes are admin-only.
create policy ticket_messages_select on public.ticket_messages for select
  using (exists (select 1 from public.tickets t where t.id = ticket_id)
         and (not is_internal or public.is_admin()));
create policy ticket_messages_insert on public.ticket_messages for insert
  with check (
    author_id = auth.uid()
    and exists (select 1 from public.tickets t where t.id = ticket_id)
    and (not is_internal or public.is_admin())
  );

-- notifications and push subscriptions: owner only. Notifications are written by the server.
create policy notifications_select on public.notifications for select
  using (user_id = auth.uid());
create policy notifications_update on public.notifications for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy push_subscriptions_owner on public.push_subscriptions for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- audit log: admin reads only.
create policy audit_log_admin_select on public.audit_log for select
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Grants. RLS limits rows; these limit which operations exist at all.
-- ---------------------------------------------------------------------------

grant usage on schema public to anon, authenticated;
grant select on all tables in schema public to anon, authenticated;
grant insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to anon, authenticated;
grant execute on all functions in schema public to anon, authenticated;

-- Tables that only functions may write. Taking the grant away is a second line of defence.
revoke insert, update, delete on public.orders, public.order_items, public.order_status_events,
  public.receipts, public.points_ledger, public.audit_log, public.loyalty_rule_versions
  from authenticated;
revoke insert, update, delete on public.orders, public.order_items, public.order_status_events,
  public.receipts, public.points_ledger, public.audit_log from anon;
grant insert on public.loyalty_rule_versions to authenticated;
grant insert on public.tickets, public.ticket_messages, public.push_subscriptions to authenticated;
grant update on public.tickets to authenticated;
