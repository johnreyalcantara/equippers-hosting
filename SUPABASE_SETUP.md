# Supabase Setup Guide

## 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Note your **Project URL** and **anon public key** from Settings > API

## 2. Configure Environment Variables

Create a `.env.local` file in the project root:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

## 3. Run the Database Schema

1. Go to **SQL Editor** in your Supabase dashboard
2. Paste the contents of `supabase-schema.sql`
3. Click **Run** to create all tables, policies, and triggers

## 4. Enable Realtime

1. Go to **Database > Replication** in the dashboard
2. Ensure the `seats` table has Realtime enabled (the SQL script does this, but verify)
3. Under **Replication**, make sure `UPDATE` events are enabled for `public.seats`

## 5. Create Your First Admin User

1. Go to **Authentication > Users** in the dashboard
2. Click **Add User** > **Create New User**
3. Enter your email and password
4. After the user is created, go to **SQL Editor** and run:

```sql
UPDATE public.profiles SET role = 'admin' WHERE email = 'your-email@example.com';
```

## 6. Auth Settings

1. Go to **Authentication > Providers**
2. Ensure **Email** provider is enabled
3. For development, you may want to disable **Confirm email** under Authentication > Settings

## 7. Deploy to Vercel

1. Push code to GitHub
2. Import the repo in [Vercel](https://vercel.com)
3. Add environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Deploy

## Database Schema Overview

```
profiles (id, email, full_name, role, created_at)
    ↑ extends auth.users

events (id, name, description, start_time, end_time, created_by, created_at)
    ↓
groups (id, event_id, name, sort_order, created_at)
    ↓
rows (id, group_id, label, number_of_seats, created_at)
    ↓
seats (id, row_id, seat_number, status, updated_at, updated_by)
```

## Event Status Logic

- **CLOSED** — Before the event start date
- **OPEN** — On the event date (regardless of time), until end_time
- **CLOSED** — After end_time

## Real-time Seating

- The `seats` table is subscribed to via Supabase Realtime
- Each individual seat can be toggled independently
- When any user toggles a seat, all other users see the change instantly
- Double-booking is prevented with an optimistic lock (`WHERE status = current_status`)
