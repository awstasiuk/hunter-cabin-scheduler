-- Hunter Cabin Scheduler — database schema
-- Run in the Supabase SQL editor (or via the CLI) on a fresh project.
-- Auth is handled by Supabase Auth (magic link); `profiles` extends auth.users.

-- ---------------------------------------------------------------------------
-- Profiles (one row per auth user)
-- ---------------------------------------------------------------------------
create table if not exists profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  email        text not null,
  display_name text not null,
  role         text not null default 'member' check (role in ('member', 'admin')),
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Rooms
-- ---------------------------------------------------------------------------
create table if not exists rooms (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  type             text not null check (type in ('bedroom', 'shared')),
  primary_owner_id uuid references profiles (id) on delete set null,
  capacity         int,
  created_at       timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Availability ("Free") windows — owner opens a room for a date range
-- ---------------------------------------------------------------------------
create table if not exists availability_windows (
  id         uuid primary key default gen_random_uuid(),
  room_id    uuid not null references rooms (id) on delete cascade,
  start_date date not null,
  end_date   date not null,           -- exclusive checkout day
  created_by uuid not null references profiles (id),
  created_at timestamptz not null default now(),
  check (end_date > start_date)
);

-- ---------------------------------------------------------------------------
-- Reservations
-- ---------------------------------------------------------------------------
create table if not exists reservations (
  id         uuid primary key default gen_random_uuid(),
  room_id    uuid not null references rooms (id) on delete cascade,
  booked_by  uuid not null references profiles (id),
  start_date date not null,
  end_date   date not null,           -- exclusive checkout day
  state      text not null check (state in ('reserved', 'tentative')),
  decided_by uuid references profiles (id),
  note       text,
  created_at timestamptz not null default now(),
  check (end_date > start_date)
);

create index if not exists reservations_room_dates_idx
  on reservations (room_id, start_date, end_date);

-- Prevent two CONFIRMED reservations from overlapping on the same room.
-- Uses a GiST exclusion constraint over a daterange.
create extension if not exists btree_gist;

alter table reservations
  drop constraint if exists no_overlapping_confirmed;

alter table reservations
  add constraint no_overlapping_confirmed
  exclude using gist (
    room_id with =,
    daterange(start_date, end_date, '[)') with &&
  )
  where (state = 'reserved');

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------
alter table profiles             enable row level security;
alter table rooms                enable row level security;
alter table availability_windows enable row level security;
alter table reservations         enable row level security;

-- Everyone signed in can read shared data.
create policy "read profiles"  on profiles             for select using (auth.role() = 'authenticated');
create policy "read rooms"     on rooms                for select using (auth.role() = 'authenticated');
create policy "read windows"   on availability_windows for select using (auth.role() = 'authenticated');
create policy "read resv"      on reservations         for select using (auth.role() = 'authenticated');

-- A member can create a reservation for themselves.
create policy "insert own resv" on reservations
  for insert with check (booked_by = auth.uid());

-- A member can delete their own reservation; the room owner can also delete
-- (used to deny a tentative hold on their room).
create policy "delete resv" on reservations
  for delete using (
    booked_by = auth.uid()
    or exists (
      select 1 from rooms r
      where r.id = reservations.room_id and r.primary_owner_id = auth.uid()
    )
  );

-- The room owner can approve (update) a tentative hold on their room.
create policy "owner updates resv" on reservations
  for update using (
    exists (
      select 1 from rooms r
      where r.id = reservations.room_id and r.primary_owner_id = auth.uid()
    )
  );

-- Only the room's owner can open/close Free windows on it.
create policy "owner manages windows" on availability_windows
  for all using (
    exists (
      select 1 from rooms r
      where r.id = availability_windows.room_id and r.primary_owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from rooms r
      where r.id = availability_windows.room_id and r.primary_owner_id = auth.uid()
    )
  );
