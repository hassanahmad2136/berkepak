# BerkePak Local Development Guide

## Stack
- **Frontend:** Next.js (`web/`)
- **Database:** self-hosted Postgres 17 in Docker (`db/`)
- **Object storage:** MinIO, S3-compatible (`db/`)
- **Mail:** Mailpit locally; real SMTP in production
- **Supabase and the Saleor/Django backend have both been removed.**

---

## Quick Start

Docker Desktop must be running.

### 1. Start the data layer

```bash
cd db && docker compose up -d
```

First boot builds the schema and loads the 27-product catalog from `db/init/`.
Later boots skip it — the data lives in a Docker volume.

Create the storage buckets once, after MinIO first starts:

```bash
docker exec berkepak_storage mc alias set local http://localhost:9000 berkepak berkepak_dev_secret
docker exec berkepak_storage mc mb --ignore-existing local/receipts local/product-images
docker exec berkepak_storage mc anonymous set download local/product-images
```

If your database volume predates a schema change, apply the migrations it is
missing (each is safe to re-run):

```bash
docker exec -i berkepak_db psql -U berkepak -d berkepak -v ON_ERROR_STOP=1 < db/migrations/001-payfast-pricing.sql
```

### 2. Configure the app

```bash
cp web/.env.example web/.env.local
```

The defaults already point at the local stack. Two things worth knowing:

- **`DATABASE_URL`** must be set or the app shows a setup notice instead of pages.
- **Signup requires a working SMTP**, because email verification is mandatory
  before first login. The example file points at Mailpit, which catches
  everything locally. If mail is unavailable, set `AUTH_AUTO_VERIFY=true` to
  skip verification in development.

To give yourself admin access, add your address to `ADMIN_EMAILS` in
`web/.env.local` (restart the dev server afterwards), or insert a row:

```bash
docker exec -i berkepak_db psql -U berkepak -d berkepak -c "insert into admin_users (user_id) select id from users where email='you@example.com';"
```

### 3. Start the frontend

```bash
cd web
npm install   # first time only
npm run dev
```

---

## Local Access

| Service | URL |
|---------|-----|
| Storefront | http://localhost:3000 |
| Postgres | `postgresql://berkepak:berkepak_dev@localhost:5433/berkepak` |
| Adminer (DB browser) | http://localhost:8081 |
| Mailpit (all outbound email) | http://localhost:8025 |
| MinIO console | http://localhost:9001 |

## Payments

- **Online payment** runs through `PAYMENTS_PROVIDER`. The default, `mock`,
  simulates a gateway end to end with no money moving. Set it to `payfast` with
  `PAYFAST_MERCHANT_ID` and `PAYFAST_SECURED_KEY` to use PayFast's UAT
  environment.
- PayFast has to reach `/api/payments/webhook/payfast` from the internet, so it
  cannot call back to `localhost`. The browser return route applies the same
  signed result, so a payment still settles locally, but test the server
  callback through a public URL (a Cloudflare Tunnel) before going live.
- **Listed prices are grossed up for the PayFast fee**
  (`SITE.payments.gatewayFeePercent` in `web/src/lib/site.ts`), so the fee
  leaves the stored catalog price intact. Direct bank transfer is charged the
  stored price, and checkout shows the saving.

OTP codes for Cash on Delivery are not emailed unless SMTP is configured; read
them from the `otp_codes` table, or from the server console.

---

## Stopping

```bash
# Stop Next.js: Ctrl+C in its terminal

cd db && docker compose down          # keeps data
cd db && docker compose down -v       # wipes data; next boot replays db/init/
```

---

## Troubleshooting

- **"needs a database connection":** the stack is not running, or `DATABASE_URL`
  is missing from `web/.env.local`.
- **Schema changed:** `docker compose down -v && docker compose up -d` in `db/`
  replays `db/init/` from scratch. This deletes all local data.
- **Signup does nothing:** check Mailpit at http://localhost:8025. With
  verification required, a failed send leaves the account unable to sign in.
- **Ports in use:** the stack needs 5433, 9000, 9001, 8081, 1025 and 8025.
