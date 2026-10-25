-- Dev seed: 3 branches, 4 categories, 20 products, one user per role, and sample orders.
-- For production, run supabase/seed/branches_all.sql instead of the sample branches here.
-- Dev users (set real passwords in the Supabase dashboard before use):
--   admin@ontherun.test            admin
--   staff.cornich@ontherun.test    branch_staff (otr-cornich)
--   +201000000001                  customer
--   +201000000002                  customer (used to test isolation)

-- Branches (real names and addresses from the site locations sheet)
insert into public.branches (slug, name_ar, name_en, address_ar, address_en, maps_url, prep_minutes)
values
  ('otr-cornich', 'Cornich', 'Cornich', '1017 كورنيش النيل', '1017 Cornich El Nile St, Maadi, Cairo Governorate',
   'https://maps.app.goo.gl/J6sDqqa6CTWzBGf27', 15),
  ('otr-maadi-towers', 'Maadi Towers', 'Maadi Towers', 'شارع حلوان الزراعى - ابراج عثمان - المعادى',
   'Masr - Helwan Agriculture Rd, Maadi Al Khabiri Al Wasti, Maadi, Cairo Governorate 4211212',
   'https://maps.app.goo.gl/J4qaAZ5gSvAqUeRT6', 20),
  ('otr-dokki', 'Dokki', 'Dokki', '50 ش مراد - امام مجلس الدولة - الدقي',
   '50 Mourad St El Dokki Giza EG-GZ EG 12611, 50 Mourad, Oula, Al Giza',
   'https://maps.app.goo.gl/n5vB5MvLiEdn9J359', 15)
on conflict (slug) do nothing;

-- Categories (placeholder names, replace from the admin panel later)
insert into public.categories (slug, name_ar, name_en, sort_order) values
  ('coffee', 'قهوة', 'Coffee', 1),
  ('food', 'أكل', 'Food', 2),
  ('snacks', 'سناكس', 'Snacks', 3),
  ('drinks', 'مشروبات', 'Drinks', 4)
on conflict (slug) do nothing;

-- Products. Prices are placeholders in EGP.
insert into public.products (category_id, slug, name_ar, name_en, price_egp, type, sort_order)
select c.id, v.slug, v.name_ar, v.name_en, v.price, v.type::public.product_type, v.sort_order
from (values
  ('coffee', 'espresso', 'إسبريسو', 'Espresso', 35, 'coffee', 1),
  ('coffee', 'americano', 'أمريكانو', 'Americano', 45, 'coffee', 2),
  ('coffee', 'cappuccino', 'كابتشينو', 'Cappuccino', 55, 'coffee', 3),
  ('coffee', 'latte', 'لاتيه', 'Latte', 60, 'coffee', 4),
  ('coffee', 'mocha', 'موكا', 'Mocha', 65, 'coffee', 5),
  ('coffee', 'flat-white', 'فلات وايت', 'Flat White', 60, 'coffee', 6),
  ('coffee', 'v60', 'V60', 'V60', 70, 'coffee', 7),
  ('food', 'cinnamon-roll', 'سينامون رول', 'Cinnamon Roll', 45, 'food', 1),
  ('food', 'chicken-sandwich', 'ساندوتش فراخ', 'Chicken Sandwich', 85, 'food', 2),
  ('food', 'croissant', 'كرواسون', 'Croissant', 40, 'food', 3),
  ('food', 'club-sandwich', 'كلوب ساندوتش', 'Club Sandwich', 95, 'food', 4),
  ('food', 'brownie', 'براوني', 'Brownie', 50, 'food', 5),
  ('snacks', 'chips', 'شيبسي', 'Chips', 20, 'other', 1),
  ('snacks', 'chocolate-bar', 'شوكولاتة', 'Chocolate Bar', 30, 'other', 2),
  ('snacks', 'cookies', 'بسكويت', 'Cookies', 25, 'other', 3),
  ('drinks', 'orange-juice', 'عصير برتقال', 'Orange Juice', 55, 'other', 1),
  ('drinks', 'lemonade', 'ليمون بالنعناع', 'Mint Lemonade', 45, 'other', 2),
  ('drinks', 'water', 'مياه', 'Water', 10, 'other', 3),
  ('drinks', 'iced-latte', 'آيس لاتيه', 'Iced Latte', 65, 'coffee', 4),
  ('drinks', 'hot-chocolate', 'هوت شوكليت', 'Hot Chocolate', 60, 'other', 5),
  ('coffee', 'turkish-coffee', 'قهوة تركي', 'Turkish Coffee', 40, 'coffee', 8)
) as v(cat, slug, name_ar, name_en, price, type, sort_order)
join public.categories c on c.slug = v.cat
on conflict (slug) do nothing;

-- Every product is sold at every sample branch, except one out of stock at Maadi Towers.
insert into public.branch_products (branch_id, product_id, available)
select b.id, p.id, not (b.slug = 'otr-maadi-towers' and p.slug = 'croissant')
from public.branches b cross join public.products p
where b.slug in ('otr-cornich', 'otr-maadi-towers', 'otr-dokki')
on conflict do nothing;

-- Loyalty rules (placeholder values). 55 EGP coffee earns 5 points.
insert into public.loyalty_rule_versions (
  coffee_points_per_egp, food_points_per_egp, redeem_egp_per_point,
  min_redeem_points, large_order_total_egp, large_order_quantity, min_reservation_lead_minutes
) values (0.1000, 0.0500, 0.1000, 50, 1500, 10, 240);

-- Dev users. Auth rows are created first. The on_auth_user_created trigger makes the profile.
insert into auth.users (id, aud, role, email, phone, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
  ('00000000-0000-0000-0000-0000000000a1', 'authenticated', 'authenticated', 'admin@ontherun.test', null,
   '{"provider":"email"}', '{}', now(), now()),
  ('00000000-0000-0000-0000-0000000000b1', 'authenticated', 'authenticated', 'staff.cornich@ontherun.test', null,
   '{"provider":"email"}', '{}', now(), now()),
  ('00000000-0000-0000-0000-0000000000c1', 'authenticated', 'authenticated', null, '201000000001',
   '{"provider":"phone"}', '{}', now(), now()),
  ('00000000-0000-0000-0000-0000000000c2', 'authenticated', 'authenticated', null, '201000000002',
   '{"provider":"phone"}', '{}', now(), now());

update public.profiles set role = 'admin', full_name = 'Dev Admin'
where id = '00000000-0000-0000-0000-0000000000a1';

update public.profiles
set role = 'branch_staff',
    branch_id = (select id from public.branches where slug = 'otr-cornich'),
    full_name = 'Cornich Staff'
where id = '00000000-0000-0000-0000-0000000000b1';

update public.profiles set full_name = 'Customer One', default_branch_id = (
  select id from public.branches where slug = 'otr-cornich')
where id = '00000000-0000-0000-0000-0000000000c1';

update public.profiles set full_name = 'Customer Two'
where id = '00000000-0000-0000-0000-0000000000c2';

-- Sample orders: one per customer, both still pending.
insert into public.orders (id, customer_id, branch_id, type, status, subtotal_egp, total_egp)
values
  ('10000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000c1',
   (select id from public.branches where slug = 'otr-cornich'), 'pickup_asap', 'pending', 55, 55),
  ('10000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000c2',
   (select id from public.branches where slug = 'otr-maadi-towers'), 'pickup_asap', 'pending', 60, 60);

insert into public.order_items (order_id, product_id, product_name_ar, product_name_en, product_type,
  unit_price_egp, quantity, line_total_egp)
select '10000000-0000-0000-0000-0000000000a1', p.id, p.name_ar, p.name_en, p.type, p.price_egp, 1, p.price_egp
from public.products p where p.slug = 'cappuccino';

insert into public.order_items (order_id, product_id, product_name_ar, product_name_en, product_type,
  unit_price_egp, quantity, line_total_egp)
select '10000000-0000-0000-0000-0000000000a2', p.id, p.name_ar, p.name_en, p.type, p.price_egp, 1, p.price_egp
from public.products p where p.slug = 'latte';

-- Sample receipt and earned points for customer one (in-store purchase, 1 coffee of 100 EGP → 10 points).
insert into public.receipts (id, branch_id, receipt_no, customer_id, coffee_egp, points_awarded, created_by)
values ('20000000-0000-0000-0000-0000000000a1',
  (select id from public.branches where slug = 'otr-cornich'), 'R-0001',
  '00000000-0000-0000-0000-0000000000c1', 100, 10, '00000000-0000-0000-0000-0000000000b1');

insert into public.points_ledger (customer_id, branch_id, type, delta, receipt_id, reason, actor_id)
values ('00000000-0000-0000-0000-0000000000c1',
  (select id from public.branches where slug = 'otr-cornich'), 'earn', 10,
  '20000000-0000-0000-0000-0000000000a1', null, '00000000-0000-0000-0000-0000000000b1');
