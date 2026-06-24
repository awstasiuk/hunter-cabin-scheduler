-- Phase 4: admin management of rooms/members.
-- Run this in the Supabase SQL editor on an existing project (it's additive
-- to supabase/schema.sql, which has also been updated with the same
-- statements for fresh installs).

-- ---------------------------------------------------------------------------
-- Auto-create a profile row when someone signs in for the first time.
-- Without this, magic-link auth creates an auth.users row but nothing in
-- `profiles`, so every join (rooms.primary_owner, reservations.booked_by)
-- breaks for new members.
-- ---------------------------------------------------------------------------
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- ---------------------------------------------------------------------------
-- Admin write access. `rooms` and `profiles` previously had read-only
-- policies — nobody (not even an admin) could create a room or change a
-- member's role. Gate writes on profiles.role = 'admin'.
-- ---------------------------------------------------------------------------
drop policy if exists "admin manages rooms" on rooms;

create policy "admin manages rooms" on rooms
  for all using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  )
  with check (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  );

drop policy if exists "admin updates profiles" on profiles;

create policy "admin updates profiles" on profiles
  for update using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  )
  with check (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  );
