# Hunter Cabin Scheduler

A room reservation web app for a shared cabin in Hunter, NY. Owners book their
own bedrooms instantly; anyone else requesting a room they don't own needs the
owner's approval — unless the owner has marked the room **free** for those dates.

## Reservation states

- **Reserved** — confirmed; the room is locked for that range.
- **Tentative hold** — default for a non-owner request; pending the owner's decision.
- **Free** — an owner-set availability window; booking inside it auto-confirms.

The decision rule lives in [`lib/reservations.ts`](lib/reservations.ts):

1. Requester owns the room → **Reserved**
2. Room is shared / has no owner → **Reserved**
3. Room is fully covered by a Free window → **Reserved**
4. Otherwise → **Tentative hold**, routed to the owner for approval

## Stack

- **Next.js** (App Router, TypeScript) + **Tailwind CSS**
- **Supabase** — Postgres, magic-link auth, row-level security
- Deploys on **Vercel** (web) + **Supabase** (data)

## Getting started

```bash
npm install

# 1. Create a Supabase project, then copy your keys:
cp .env.example .env.local        # fill in URL + anon key

# 2. Apply the schema in the Supabase SQL editor:
#    paste supabase/schema.sql and run it

# 3. Run the app:
npm run dev                       # http://localhost:3000
```

## Project layout

```
app/                 Next.js routes (calendar, book, requests, my-bookings, login)
app/auth/callback/   Magic-link landing route (exchanges code for a session)
lib/reservations.ts  Core booking decision logic (state machine)
lib/actions.ts        Server Actions: create/approve/deny/cancel reservation, sign out
lib/supabase/        Browser + server Supabase clients
middleware.ts        Refreshes the Supabase session cookie on each request
supabase/schema.sql  Tables, overlap constraint, RLS policies
supabase/seed.sql    Example rooms/owners
```

## Roadmap

- **Phase 1** — auth, schema, read-only calendar
- **Phase 2** — booking dialog + decision rule, owner approval inbox, conflict checks
- **Phase 3** — Free windows, email notifications, my-bookings + cancel
- **Phase 4** — admin (members/rooms), responsive polish, end-to-end rule tests

See the implementation plan document for full detail.
