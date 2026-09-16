# Berke Pak — self-hosted data layer

Replaces Supabase with a stack you own. Postgres holds all application data;
MinIO provides S3-compatible object storage for receipt and product images.

## Start

```bash
cd db && docker compose up -d
```

On the **first** boot of an empty volume, Postgres runs everything in `init/`
in filename order: `01-schema.sql` builds the schema, `02-seed.sql` loads the
27-product catalog. Later boots skip it — the data is already in the volume.

| Service | Address | Credentials |
|---|---|---|
| Postgres | `localhost:5433` | `berkepak` / `berkepak_dev`, database `berkepak` |
| MinIO S3 API | http://localhost:9000 | `berkepak` / `berkepak_dev_secret` |
| MinIO console | http://localhost:9001 | same |
| Adminer (DB browser) | http://localhost:8081 | server `postgres`, rest as above |

Connection string:

```
postgresql://berkepak:berkepak_dev@localhost:5433/berkepak
```

Create the two buckets once, after MinIO first starts:

```bash
docker exec berkepak_storage mc alias set local http://localhost:9000 berkepak berkepak_dev_secret
docker exec berkepak_storage mc mb --ignore-existing local/receipts local/product-images
docker exec berkepak_storage mc anonymous set download local/product-images
```

`receipts` stays private and is read through short-lived signed URLs;
`product-images` is publicly readable.

## Migrations

`init/` runs only on an empty volume, so a schema change is written twice: into
`init/01-schema.sql` for fresh databases, and as a numbered file in
`migrations/` for existing ones. Apply one with:

```bash
docker exec -i berkepak_db psql -U berkepak -d berkepak -v ON_ERROR_STOP=1 < db/migrations/001-payfast-pricing.sql
```

| File | Adds |
|---|---|
| `001-payfast-pricing.sql` | `orders.payment_surcharge`, `receipts.transaction_id` (unique among live receipts), and the surcharge parameter on `place_order_atomic` |

## Reset

```bash
docker compose down -v && docker compose up -d
```

`-v` drops the volumes, so the next boot replays `init/` from scratch. Without
it the schema and seed do **not** re-run.

## What changed from Supabase

- **`auth.users` is gone.** `users` is now the identity table and absorbs what
  `profiles` held (`full_name`, `phone`). Sessions live in `sessions`, storing
  only a hash of the cookie token.
- **No row-level security.** The old schema leaned on 34 RLS policies keyed on
  `auth.uid()`. All queries now run server-side over a trusted connection, so
  authorization is the application's job — every query that reads or writes
  user-scoped data must filter by the session's user id itself. This is the
  single biggest correctness risk in the migration.
- **Storage buckets became tables + objects.** `files` records bucket, key,
  owner and visibility; the bytes live in MinIO (or any S3 in production).
- **`place_order_atomic` and `decrement_product_stock` carried over unchanged**
  in behaviour: order, items and stock decrement in one transaction, with a
  `FOR UPDATE` lock that makes overselling impossible.

## Data

`catalog-snapshot.json` is the raw catalog pulled from the production Supabase
project on 2026-09-02 — 27 products, 55 colour rows, real stock levels. The
seed is generated from it, and product UUIDs are preserved so existing product
links keep working.

Everything else in production was empty: no orders, users, promotions or
campaigns. No product had any image.

## Auth

Supabase Auth is gone. `users` is the identity table; sessions are server-side.

- The `bp_session` cookie holds a random opaque token; only its SHA-256 hash is
  stored in `sessions`, so a database dump yields no usable sessions.
- Passwords are argon2id (`@node-rs/argon2`). Login returns one message for both
  a wrong password and an unknown address, and runs a dummy verify when the user
  does not exist so timing cannot reveal who is registered.
- **Email verification is required before first login.** That makes SMTP a hard
  dependency for registration — set `AUTH_AUTO_VERIFY=true` in development if
  mail is unavailable.
- Verification and reset tokens are single-use, hashed at rest, and a password
  reset revokes every existing session for that user.
- Admin comes from `ADMIN_EMAILS` **or** a row in `admin_users`; both routes are
  resolved by one function so pages and middleware cannot disagree.
- `middleware.ts` is not a security boundary — it cannot reach Postgres from the
  Edge runtime, so it only redirects visitors with no cookie. Enforcement is
  `requireUser()` / `requireAdmin()` in `web/src/lib/auth/guards.ts`.

Mailpit catches all local mail: SMTP on `localhost:1025`, inbox at
http://localhost:8025.

## Production

This compose file is for local development. In production you need somewhere
to run Postgres and object storage — a VPS, or managed equivalents (Neon / RDS
for Postgres, S3 / R2 for storage). Vercel cannot host either. Change every
credential in `.env.example` before exposing the stack.
