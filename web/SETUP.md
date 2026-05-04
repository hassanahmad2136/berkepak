# Berke Pak — Local Setup

The project has two halves:

```
BerkePak/
  web/        ← Next.js storefront + admin (this directory)
  backend/    ← Saleor (Django/GraphQL) docker-compose
```

You can run the storefront on its own — it falls back to a static fabric
catalog and shows a "Setup required" notice on the protected pages until you
wire up Supabase. Saleor is independent of Supabase: Supabase backs the
storefront's auth/orders/receipts; Saleor will eventually back the product
catalog and inventory.

---

## 1. Storefront (`web/`)

### Install
```bash
cd BerkePak/web
npm install
```

### Bring up Supabase

Pick **one** of the two paths.

#### Path A — Supabase Cloud (no Docker; ~5 min)
1. Create a free project at <https://supabase.com/dashboard>.
2. **Project → Settings → API**, copy:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` → `SUPABASE_SERVICE_ROLE_KEY`
3. Create `BerkePak/web/.env.local` and paste them in. Also set
   `ADMIN_EMAILS=your@email.com` for the admin hub.
4. Apply the schema:
   ```bash
   npx supabase login
   npx supabase link --project-ref <your-project-ref>
   npx supabase db push
   ```
   *(Or open the SQL editor in the dashboard and paste both files in
   `supabase/migrations/` in order.)*
5. **Disable email confirmation for dev:** Auth → Providers → Email → toggle
   off "Confirm email". Otherwise sign-in is blocked until you click the
   verification link.

#### Path B — Supabase Local (Docker required)
1. Start Docker Desktop.
2. From `BerkePak/web`:
   ```bash
   npx supabase start
   ```
   First run pulls ~1.5 GB of images and takes 5–10 min. It prints the URL +
   anon key + service-role key when ready.
3. Paste those into `BerkePak/web/.env.local`:
   ```
   NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<from CLI output>
   SUPABASE_SERVICE_ROLE_KEY=<from CLI output>
   ADMIN_EMAILS=your@email.com
   ```
4. Migrations are applied automatically on `supabase start`.
5. Studio (web UI): <http://127.0.0.1:54323>. Inbucket (fake email): <http://127.0.0.1:54324>.

### Run the storefront
```bash
npm run dev
```
Open <http://localhost:3000>.

---

## 2. Saleor backend (`backend/`)

Optional today — the storefront catalog is currently served from
`web/src/lib/products.ts`. Bring Saleor up when you want to migrate the
catalog into a real PIM/inventory system, or to use the Saleor admin
dashboard.

### Bring it up
```bash
cd BerkePak/backend
make init     # docker compose up -d + migrate + seed superuser
```

First run pulls ~2 GB of images and takes 5–10 min.

URLs once running:
- GraphQL API: <http://localhost:8000/graphql/>
- Saleor Dashboard: <http://localhost:9000>  (login: `admin@example.com` / `admin` — change it)
- Mailpit (intercepts dev email): <http://localhost:8025>

### Connect it to the storefront *(later — not yet wired)*
1. Saleor dashboard → Configuration → Apps → Create App, grant `MANAGE_PRODUCTS`,
   `MANAGE_ORDERS`, `MANAGE_CHECKOUTS`. Copy the token.
2. Add to `BerkePak/web/.env.local`:
   ```
   NEXT_PUBLIC_SALEOR_API_URL=http://localhost:8000/graphql/
   SALEOR_APP_TOKEN=<token>
   ```
3. The catalog swap (replace `lib/products.ts` with Saleor GraphQL queries)
   is the next milestone.

---

## 3. Try the flows

### Customer flow
1. Sign up at `/signup` (any email — confirmation is off).
2. Browse `/shop`, open a fabric, choose **By the suit + Bespoke stitching**
   (Phase 5 toggle adds Rs 4,500/suit), Add to Cart.
3. Checkout `/checkout`:
   - **COD** path: enter address, request OTP — code prints to the **server
     console** AND shows in a dev-mode banner inside the page; verify; place
     order.
   - **Bank Transfer** path: place order → see IBAN/Raast details on
     confirmation → go to `/account/receipts` → upload any image. It lands in
     Supabase Storage under `receipts/<your-user-id>/`.
4. Inspect from `/account/orders`, `/account/profile` (save measurements for
   bespoke), `/account/wishlist`.

### Admin flow
1. Sign in with an email listed in `ADMIN_EMAILS`.
2. Go to `/admin` — overview shows pending receipts and open orders.
3. `/admin/receipts` — preview each upload (signed 10-min URL), Approve
   (flips the order to `paid` + `confirmed`) or Reject with a reason
   (returns the order to `awaiting_receipt` so the customer can re-upload).
4. `/admin/orders` — flat list of recent orders with payment status.

---

## What's stubbed (not blocking the dev flow)

- **OAuth (Google / Apple)** — buttons disabled. Wiring requires provider
  config in Supabase Auth settings.
- **SMS provider for OTP** — currently logs the code server-side and (in dev)
  returns it to the UI. Drop in Twilio / Vonage / a PK SMS gateway in
  [`src/lib/actions/otp.ts`](src/lib/actions/otp.ts) where the comment marks
  the spot.
- **Saleor → storefront integration** — backend container set up; storefront
  still uses the static fabric catalog. Catalog swap is the next milestone.
- **Abandoned cart reminders** — needs cron + email provider; not yet wired.
- **GA4 / Meta Pixel** — script injection ready; set
  `NEXT_PUBLIC_GA4_ID` and/or `NEXT_PUBLIC_META_PIXEL_ID` to activate.
