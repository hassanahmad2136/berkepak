# Berke Pak - Project Context & Guidelines

## Overview
Berke Pak sells **men's unstitched shalwar kameez fabric**, by the suit. The
project is a Next.js monolith backed by a self-hosted Postgres database. Both
the original Saleor backend and the later Supabase layer have been removed.

### 1. Storefront (`web/`)
- **Framework:** Next.js (React)
- **Features:** catalog, authentication, checkout (direct bank transfer with
  transaction ID + screenshot, and Cash on Delivery; PayFast is built but
  switched off via `NEXT_PUBLIC_ONLINE_PAYMENTS`), order fulfilment, and an
  admin portal for orders, stock, pricing, promotions and receipt approvals.
- **Pricing:** while online payment is on, listed prices are grossed up for
  the PayFast fee so it leaves the stored price intact and bank transfer is
  charged the stored net price. While it is off (the current setting), listed
  equals the stored price for every method. See
  `src/lib/pricing.ts` and the root `CLAUDE.md`.
- **Data:** Postgres via `pg`, accessed only from the server through
  `src/lib/db.ts`. Client components use server actions.
- **Auth:** own implementation in `src/lib/auth/` — argon2id passwords,
  server-side sessions, single-use verification and reset tokens. Email
  verification is required before first login.
- **Storage:** S3-compatible (`src/lib/storage.ts`) — MinIO locally.
- **OTP** for Cash on Delivery is stubbed: without SMTP/Twilio credentials the
  code is printed to the server console and stored in `otp_codes`.

### 2. Data layer (`db/`)
- `docker-compose.yml` runs Postgres 17, MinIO, Mailpit and Adminer.
- `init/01-schema.sql` is the complete schema; `init/02-seed.sql` loads the
  27-product catalog. Both run on first boot of an empty volume.

### 3. Backend Engine (`backend/` - Deprecated)
- Saleor (Django). Inactive; kept for historical context only.

## Local Development Flow
1. `cd db && docker compose up -d`
2. `cp web/.env.example web/.env.local`
3. `cd web && npm install && npm run dev`
4. http://localhost:3000 — mail at http://localhost:8025

Full detail in `RUN_INSTRUCTIONS.md`.

## Critical: no row-level security
Supabase's RLS used to scope every read to the signed-in user. It is gone. Every
query against orders, receipts, addresses, wishlist or measurements must include
its own `where user_id = $1`. Use `requireUser()` / `requireAdmin()` from
`src/lib/auth/guards.ts` to identify the caller; they do not filter for you.
`src/middleware.ts` is a UX redirect, not a security boundary.

## Future Milestones & Work
- **SMS Integration:** drop in a real SMS provider for OTP (`lib/actions/otp.ts`).
- **Abandoned Cart:** cron + email reminders.
- **Product photography:** the catalog has no images; the storefront renders
  `placeholder-fabric.svg` until they are uploaded via the admin stock page.
- **Production hosting:** Postgres and object storage need a host. Vercel cannot
  run either — a VPS, or managed Postgres (Neon/RDS) plus S3/R2.
