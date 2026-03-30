-- ============================================
-- Equippers Hosting - Full Database Schema
-- Run this in Supabase SQL Editor
-- ============================================

-- 1. Profiles table (extends Supabase auth.users)
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text not null,
  full_name text,
  role text not null default 'user' check (role in ('admin', 'user')),
  created_at timestamptz not null default now()
);

-- 2. Events table
create table public.events (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  description text,
  start_time timestamptz not null,
  end_time timestamptz not null,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

-- 3. Groups table (sections within an event)
create table public.groups (
  id uuid default gen_random_uuid() primary key,
  event_id uuid references public.events(id) on delete cascade not null,
  name text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- 4. Rows table (seating rows within a group)
create table public.rows (
  id uuid default gen_random_uuid() primary key,
  group_id uuid references public.groups(id) on delete cascade not null,
  label text not null,
  number_of_seats integer not null default 1,
  created_at timestamptz not null default now()
);

-- 5. Seats table (individual seats within a row)
create table public.seats (
  id uuid default gen_random_uuid() primary key,
  row_id uuid references public.rows(id) on delete cascade not null,
  seat_number integer not null,
  status text not null default 'available' check (status in ('available', 'occupied')),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id)
);

-- ============================================
-- Auto-create profile on user signup
-- ============================================
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'role', 'user')
  );
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================
-- Row Level Security (RLS)
-- ============================================

-- Enable RLS on all tables
alter table public.profiles enable row level security;
alter table public.events enable row level security;
alter table public.groups enable row level security;
alter table public.rows enable row level security;
alter table public.seats enable row level security;

-- Profiles: users can read all profiles, update own
create policy "Anyone can view profiles"
  on public.profiles for select
  using (true);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Admins can insert profiles"
  on public.profiles for insert
  with check (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
    or auth.uid() = id
  );

-- Events: everyone can read, admins can write
create policy "Anyone can view events"
  on public.events for select
  using (true);

create policy "Admins can create events"
  on public.events for insert
  with check (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

create policy "Admins can update events"
  on public.events for update
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

create policy "Admins can delete events"
  on public.events for delete
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- Groups: everyone can read, admins can write
create policy "Anyone can view groups"
  on public.groups for select
  using (true);

create policy "Admins can create groups"
  on public.groups for insert
  with check (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

create policy "Admins can update groups"
  on public.groups for update
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

create policy "Admins can delete groups"
  on public.groups for delete
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- Rows: everyone can read, admins can create/delete
create policy "Anyone can view rows"
  on public.rows for select
  using (true);

create policy "Admins can create rows"
  on public.rows for insert
  with check (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

create policy "Admins can delete rows"
  on public.rows for delete
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- Seats: everyone can read and update (for toggling), admins can create/delete
create policy "Anyone can view seats"
  on public.seats for select
  using (true);

create policy "Authenticated users can update seats"
  on public.seats for update
  using (auth.uid() is not null);

create policy "Admins can create seats"
  on public.seats for insert
  with check (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

create policy "Admins can delete seats"
  on public.seats for delete
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- ============================================
-- Enable Realtime on the seats table
-- ============================================
alter publication supabase_realtime add table public.seats;

-- ============================================
-- Create first admin user (run after sign-up)
-- Replace the email with your admin email
-- ============================================
-- UPDATE public.profiles SET role = 'admin' WHERE email = 'your-admin@email.com';
