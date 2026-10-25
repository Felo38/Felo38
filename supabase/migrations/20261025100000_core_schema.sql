-- On the Run: core schema.
-- Money is stored as numeric(10,2) in EGP. Points are integers.
-- Writes to points and orders go through functions added in later phases, never from the client.

create type public.user_role as enum ('customer', 'branch_staff', 'admin');
create type public.product_type as enum ('coffee', 'food', 'other');
create type public.order_type as enum ('pickup_asap', 'pickup_scheduled', 'reservation');
create type public.order_status as enum (
  'pending', 'accepted', 'preparing', 'ready', 'picked_up',
  'rejected', 'cancelled', 'rescheduled'
);
create type public.ticket_status as enum ('open', 'in_progress', 'resolved');
create type public.ledger_type as enum ('earn', 'redeem', 'adjustment', 'reversal');

-- ---------------------------------------------------------------------------
-- Branches and staff
-- ---------------------------------------------------------------------------

create table public.branches (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name_ar text not null,
  name_en text not null,
  address_ar text not null,
  address_en text,
  maps_url text,
  phone text,
  lat numeric(9, 6),
  lng numeric(9, 6),
  working_hours jsonb not null default '{}'::jsonb,
  accepting_orders boolean not null default true,
  prep_minutes integer not null default 15 check (prep_minutes >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  check ((lat is null) = (lng is null))
);

-- One row per auth user. Created by a trigger on auth.users, never by the client.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  phone text unique check (phone is null or phone ~ '^\+[1-9][0-9]{7,14}$'),
  full_name text,
  role public.user_role not null default 'customer',
  -- Staff belong to exactly one branch. Customers and admins have none.
  branch_id uuid references public.branches (id) on delete restrict,
  default_branch_id uuid references public.branches (id) on delete set null,
  locale text not null default 'ar' check (locale in ('ar', 'en')),
  -- Opaque token encoded in the customer's QR code. Never the phone number.
  qr_token text not null unique default (
    replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')
  ),
  created_at timestamptz not null default now(),
  check ((role = 'branch_staff') = (branch_id is not null))
);

-- ---------------------------------------------------------------------------
-- Menu
-- ---------------------------------------------------------------------------

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name_ar text not null,
  name_en text not null,
  sort_order integer not null default 0,
  active boolean not null default true
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories (id) on delete restrict,
  slug text not null unique,
  name_ar text not null,
  name_en text not null,
  description_ar text,
  description_en text,
  price_egp numeric(10, 2) not null check (price_egp >= 0),
  -- Decides which points rate applies. 'other' earns no points.
  type public.product_type not null default 'other',
  image_path text,
  sort_order integer not null default 0,
  active boolean not null default true
);

-- A row means "this branch sells this product". A missing row means it does not.
-- available = false means temporarily out of stock at this branch.
create table public.branch_products (
  branch_id uuid not null references public.branches (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  available boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null,
  primary key (branch_id, product_id)
);

-- ---------------------------------------------------------------------------
-- Loyalty settings. Append-only: a change inserts a new version, so old points stay correct.
-- ---------------------------------------------------------------------------

create table public.loyalty_rule_versions (
  id uuid primary key default gen_random_uuid(),
  effective_from timestamptz not null default now(),
  coffee_points_per_egp numeric(8, 4) not null check (coffee_points_per_egp >= 0),
  food_points_per_egp numeric(8, 4) not null check (food_points_per_egp >= 0),
  redeem_egp_per_point numeric(8, 4) not null check (redeem_egp_per_point >= 0),
  min_redeem_points integer not null default 0 check (min_redeem_points >= 0),
  expiry_days integer check (expiry_days is null or expiry_days > 0),
  -- Large-order rule: an order above either threshold needs branch confirmation.
  large_order_total_egp numeric(10, 2) check (large_order_total_egp is null or large_order_total_egp >= 0),
  large_order_quantity integer check (large_order_quantity is null or large_order_quantity > 0),
  min_reservation_lead_minutes integer not null default 240 check (min_reservation_lead_minutes >= 0),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Orders
-- ---------------------------------------------------------------------------

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_no bigint generated always as identity unique,
  customer_id uuid not null references public.profiles (id) on delete restrict,
  branch_id uuid not null references public.branches (id) on delete restrict,
  type public.order_type not null,
  status public.order_status not null default 'pending',
  scheduled_for timestamptz,
  ready_at timestamptz,
  requires_confirmation boolean not null default false,
  subtotal_egp numeric(10, 2) not null check (subtotal_egp >= 0),
  discount_egp numeric(10, 2) not null default 0 check (discount_egp >= 0),
  total_egp numeric(10, 2) not null check (total_egp >= 0),
  points_redeemed integer not null default 0 check (points_redeemed >= 0),
  status_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (type <> 'reservation' or scheduled_for is not null),
  check (total_egp = subtotal_egp - discount_egp)
);

-- Snapshot of name and price at order time, so later menu edits never change past orders.
create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  product_name_ar text not null,
  product_name_en text not null,
  product_type public.product_type not null,
  unit_price_egp numeric(10, 2) not null check (unit_price_egp >= 0),
  quantity integer not null check (quantity > 0),
  line_total_egp numeric(10, 2) not null,
  check (line_total_egp = unit_price_egp * quantity)
);

create table public.order_status_events (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders (id) on delete cascade,
  from_status public.order_status,
  to_status public.order_status not null,
  actor_id uuid references public.profiles (id) on delete set null,
  reason text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- In-store purchases and points ledger
-- ---------------------------------------------------------------------------

create table public.receipts (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches (id) on delete restrict,
  receipt_no text not null check (length(btrim(receipt_no)) > 0),
  customer_id uuid not null references public.profiles (id) on delete restrict,
  coffee_egp numeric(10, 2) not null default 0 check (coffee_egp >= 0),
  food_egp numeric(10, 2) not null default 0 check (food_egp >= 0),
  points_awarded integer not null default 0 check (points_awarded >= 0),
  rules_version_id uuid references public.loyalty_rule_versions (id),
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  -- A receipt number can only be used once per branch, so points can't be counted twice.
  unique (branch_id, receipt_no)
);

create table public.points_ledger (
  id bigint generated always as identity primary key,
  customer_id uuid not null references public.profiles (id) on delete restrict,
  branch_id uuid references public.branches (id) on delete restrict,
  type public.ledger_type not null,
  delta integer not null check (delta <> 0),
  order_id uuid references public.orders (id) on delete restrict,
  receipt_id uuid references public.receipts (id) on delete restrict,
  rules_version_id uuid references public.loyalty_rule_versions (id),
  reason text,
  actor_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  check (type <> 'earn' or (delta > 0 and (order_id is not null or receipt_id is not null))),
  check (type <> 'redeem' or delta < 0),
  check (type <> 'adjustment' or length(btrim(coalesce(reason, ''))) > 0),
  check (type <> 'reversal' or order_id is not null)
);

-- Idempotency: one earn/redeem/reversal per order, and one earn per receipt.
create unique index points_ledger_one_per_order on public.points_ledger (order_id, type)
  where order_id is not null;
create unique index points_ledger_one_earn_per_receipt on public.points_ledger (receipt_id)
  where receipt_id is not null and type = 'earn';

-- ---------------------------------------------------------------------------
-- Tickets (complaints and branch reports)
-- ---------------------------------------------------------------------------

create table public.tickets (
  id uuid primary key default gen_random_uuid(),
  ticket_no bigint generated always as identity unique,
  category text not null check (category in ('order', 'points', 'other')),
  subject text not null check (length(btrim(subject)) > 0),
  body text not null check (length(btrim(body)) > 0),
  status public.ticket_status not null default 'open',
  customer_id uuid references public.profiles (id) on delete set null,
  branch_id uuid references public.branches (id) on delete set null,
  order_id uuid references public.orders (id) on delete set null,
  created_by uuid not null references public.profiles (id) on delete restrict,
  assignee_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (customer_id is not null or branch_id is not null)
);

create table public.ticket_messages (
  id bigint generated always as identity primary key,
  ticket_id uuid not null references public.tickets (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete restrict,
  body text not null check (length(btrim(body)) > 0),
  -- Internal notes are visible to admins only.
  is_internal boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Notifications and audit
-- ---------------------------------------------------------------------------

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null,
  title_ar text not null,
  title_en text not null,
  body_ar text not null,
  body_en text not null,
  data jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth_key text not null,
  created_at timestamptz not null default now()
);

create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid,
  action text not null,
  entity text not null,
  entity_id text,
  before_data jsonb,
  after_data jsonb,
  reason text,
  created_at timestamptz not null default now()
);

create index orders_branch_created_idx on public.orders (branch_id, created_at desc);
create index orders_customer_created_idx on public.orders (customer_id, created_at desc);
create index points_ledger_customer_idx on public.points_ledger (customer_id);
create index points_ledger_branch_idx on public.points_ledger (branch_id);
create index tickets_status_idx on public.tickets (status);
create index notifications_user_idx on public.notifications (user_id, created_at desc);
