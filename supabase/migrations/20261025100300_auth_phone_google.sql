-- Google sign-in and phone verification.
-- A phone number is stored on the profile only after Supabase Auth verified it (auth.users.phone).
-- The profile phone follows auth.users.phone through a trigger.

-- The guard now allows a phone change only if it matches the phone Auth verified.
create or replace function public.guard_profile_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_verified text;
begin
  if auth.uid() is not null and not public.is_admin() then
    if new.role is distinct from old.role or new.branch_id is distinct from old.branch_id then
      raise exception 'Only an admin can change role or branch';
    end if;
    if new.phone is distinct from old.phone then
      select case
               when u.phone is null or u.phone = '' then null
               when left(u.phone, 1) = '+' then u.phone
               else '+' || u.phone
             end
      into v_verified
      from auth.users u where u.id = old.id;
      if new.phone is distinct from v_verified then
        raise exception 'Phone numbers must be verified before they are saved';
      end if;
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.sync_profile_phone()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.phone is distinct from old.phone then
    update public.profiles
    set phone = case
                  when new.phone is null or new.phone = '' then null
                  when left(new.phone, 1) = '+' then new.phone
                  else '+' || new.phone
                end
    where id = new.id;
  end if;
  return new;
end;
$$;

create trigger on_auth_user_phone_changed
  after update of phone on auth.users
  for each row execute function public.sync_profile_phone();
