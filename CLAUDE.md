## Architecture

Berke Pak is a storefront for **men's unstitched shalwar kameez fabric**, sold by
the suit.

- **`web/`** — Next.js app (storefront, account area, admin portal).
- **`db/`** — self-hosted Postgres 17 + MinIO via docker-compose. Schema and
  catalog seed live in `db/init/`.
- **`backend/`** — deprecated Saleor/Django. Not wired into anything.

**Supabase has been removed entirely.** There is no Supabase client, no hosted
auth, no PostgREST and no RLS. Consequences worth internalising before changing
data code:

- All database access goes through `web/src/lib/db.ts` (`pg`), server-side only.
  Client components cannot query the database; they call server actions
  (see `lib/actions/catalog.ts`).
- **There is no row-level security.** The 34 RLS policies that used to scope
  every read to `auth.uid()` are gone. Any query touching user-owned rows —
  orders, receipts, addresses, wishlist, measurements — must carry its own
  `where user_id = $1`. A missing predicate is a data leak, not a bug report.
- Auth is `web/src/lib/auth/`: argon2id passwords, server-side sessions in the
  `sessions` table, single-use email verification and reset tokens.
  `requireUser()` / `requireAdmin()` in `lib/auth/guards.ts` are the only
  sanctioned way to learn who is signed in.
- `web/src/middleware.ts` is **not** a security boundary. It cannot reach
  Postgres from the Edge runtime, so it only redirects cookie-less visitors.
  Enforcement belongs in the guards.
- Object storage is S3-compatible (`lib/storage.ts`): MinIO locally, S3/R2 in
  production.

Local setup: see `RUN_INSTRUCTIONS.md`. Database details: `db/README.md`.

## Commands

```bash
cd db  && docker compose up -d   # Postgres + MinIO + Mailpit + Adminer
cd web && npm run dev            # http://localhost:3000
cd web && npm run typecheck
cd web && npm run test
```

## Guidelines

- New storefront UI follows the existing design system and must work on mobile
  and desktop.
- Email verification is required before first login, which makes SMTP a hard
  dependency for registration. `AUTH_AUTO_VERIFY=true` bypasses it in
  development only.
- **Prices come in two books** (`web/src/lib/pricing.ts`). `product_catalog`
  stores the *net* price. `Product.pricePerSuit` is the *listed* price - net
  **grossed up** for the PayFast fee (`SITE.payments.gatewayFeePercent`), since
  the gateway takes its cut of what it charges rather than of the stored price
  - and `basePricePerSuit` is the stored one. Direct bank transfer is charged net;
  every other method is charged listed. **Never write a `Product` price back to
  the database**: it would compound the fee on every save. Admin price edits
  already go straight to SQL.
- Order totals come only from `quoteOrder()` in `web/src/lib/order-pricing.ts`.
  `placeOrder` charges from it and checkout displays from it, which is what
  keeps the advertised bank-transfer saving honest. Free shipping and coupon
  minimums are judged on the net subtotal for every method.
- `orders.payment_surcharge` is the fee inside `total`; `total -
  payment_surcharge` is what the business nets.
- Bank-transfer receipts need a transaction ID, unique across live receipts, so
  one transfer cannot be claimed against two orders.
- Schema changes go in `db/init/01-schema.sql` **and** a new numbered file in
  `db/migrations/`. `init/` only runs on an empty volume.
- Do not reintroduce material categories (cotton/linen/wool/silk) as storefront
  filters — the brand sells one category. `product_catalog.category` is retained
  only for legacy campaign targeting and defaults to `fabric`.
