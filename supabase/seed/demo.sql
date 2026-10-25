-- Demo data for a local run. One branch, one staff member, one admin, one customer, and the loyalty rules.
-- Add products, more branches and availability from the admin panel. That is the point of the demo.
--   admin:     admin@ontherun.test         password demo1234  (email login)
--   staff:     staff.cornich@ontherun.test password demo1234  (Cornich branch)
--   customer:  +201000000001               code 123456        (phone login, dev only)

insert into public.branches (slug, name_ar, name_en, address_ar, address_en, prep_minutes)
values ('otr-cornich', 'Cornich', 'Cornich', '1017 كورنيش النيل', '1017 Cornich El Nile St, Maadi, Cairo', 15)
on conflict (slug) do nothing;

insert into public.categories (slug, name_ar, name_en, sort_order) values
  ('coffee', 'قهوة', 'Coffee', 1),
  ('food', 'أكل', 'Food', 2),
  ('snacks', 'سناكس', 'Snacks', 3),
  ('drinks', 'مشروبات', 'Drinks', 4)
on conflict (slug) do nothing;

insert into public.loyalty_rule_versions (
  coffee_points_per_egp, food_points_per_egp, redeem_egp_per_point,
  min_redeem_points, large_order_total_egp, large_order_quantity, min_reservation_lead_minutes
) values (0.1000, 0.0500, 0.1000, 50, 1500, 10, 240);

insert into auth.users (id, aud, role, email, phone, raw_app_meta_data, raw_user_meta_data, dev_password) values
  ('00000000-0000-0000-0000-0000000000a1', 'authenticated', 'authenticated', 'admin@ontherun.test', null,
   '{"provider":"email"}', '{}', 'demo1234'),
  ('00000000-0000-0000-0000-0000000000b1', 'authenticated', 'authenticated', 'staff.cornich@ontherun.test', null,
   '{"provider":"email"}', '{}', 'demo1234'),
  ('00000000-0000-0000-0000-0000000000c1', 'authenticated', 'authenticated', null, '201000000001',
   '{"provider":"phone"}', '{}', null);

update public.profiles set role = 'admin', full_name = 'Admin' where id = '00000000-0000-0000-0000-0000000000a1';
update public.profiles
set role = 'branch_staff', full_name = 'Cornich Staff',
    branch_id = (select id from public.branches where slug = 'otr-cornich')
where id = '00000000-0000-0000-0000-0000000000b1';
update public.profiles set full_name = 'Demo Customer' where id = '00000000-0000-0000-0000-0000000000c1';
