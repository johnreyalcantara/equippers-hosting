You are a senior full-stack engineer. Build a mobile-first event planning and seating management web app using:

Next.js (App Router)
Supabase (Auth, Database, Realtime)
Tailwind CSS for styling

The app will be deployed on Vercel and should not require a custom backend server.

🎯 Core Requirements
1. Authentication & Roles
Use Supabase Auth
Roles:
Admin
User
Admin can:
Create users
Create and manage events
2. Event Management

Event fields:

Name
Start time
End time
Description
3. Event Status Logic
Event is CLOSED before event date
Automatically OPEN on event date (regardless of time)
CLOSED after end time

This logic should be handled in frontend + database queries.

4. Seating System Structure

Hierarchy:

Event
→ Groups
→ Rows
Groups
name/label
Rows
number_of_seats (integer)
status (available/occupied)
5. Interactive Seating (REAL-TIME REQUIRED)
Each row is a rounded rectangle with black border
Default: green (available)
Click:
turns red (occupied)
Click again:
toggles back to green
This must:
update database
sync instantly across all users (real-time, no refresh)

Use Supabase Realtime subscriptions:

Listen to changes on seating table
Update UI immediately
6. UI/UX (Mobile First)
Fully optimized for mobile
Large tap areas
Smooth transitions
Grid layout for seating
Color-coded states
7. Database Design (Supabase)

Tables:

users (id, role)
events
groups
rows (with status)

Include relationships and foreign keys.

8. Deliverables

Provide:

Full database schema (SQL)
Supabase setup guide
Next.js folder structure
Key components:
Event list
Seating UI
Real-time subscription code
Seat toggle logic
Role-based access control
⚡ Important Constraints
No custom backend server
Must work on Vercel
Must support real-time updates
Keep code clean and production-ready
Prevent double booking conflicts
Show live seat count