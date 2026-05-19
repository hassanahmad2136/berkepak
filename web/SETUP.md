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
3. Create `BerkePak/web/.env.local`:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
   SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...

   # Used by email-confirmation links + OAuth redirects.
   # Set to your prod URL when deploying.
   NEXT_PUBLIC_SITE_URL=http://localhost:3000

   # Comma-separated emails that get access to /admin/*
   ADMIN_EMAILS=your@email.com
   ```
4. **Configure auth URLs.** Authentication → **URL Configuration**:
   - **Site URL**: `http://localhost:3000`
   - **Redirect URLs** → add `http://localhost:3000/auth/callback`
5. **Email confirmation** is on by default — leave it on. The signup form now
   shows an embedded "Check your email" panel after submit, and the link
   in the email lands on `/auth/callback` to activate the account.
   - Free Supabase email is rate-limited (3/hour). For local dev it's fine.
   - In Auth → **Email Templates → Confirm signup**, the default template's
     `{{ .ConfirmationURL }}` will respect the `emailRedirectTo` we send.
6. Apply the schema. **SQL Editor → New query**, paste each of these in order
   and Run:
   - [supabase/migrations/20260505000000_init.sql](supabase/migrations/20260505000000_init.sql)
   - [supabase/migrations/20260505000001_stitching.sql](supabase/migrations/20260505000001_stitching.sql)

#### Path B — Supabase Local (Docker required)
Start Docker Desktop, then from `BerkePak/web`:
```bash
npx supabase start
```
First run pulls ~1.5 GB of images and takes 5–10 min. The CLI prints the API URL,
anon key, and service-role key — copy them into `.env.local` exactly as in Path A.
Migrations run automatically. Studio at <http://127.0.0.1:54323>; intercepted
emails at <http://127.0.0.1:54324>.

### Run the storefront
```bash
npm run dev
```
Open <http://localhost:3000>.

---

## 2. Social sign-in (Google + Apple)

The buttons are **live** — clicking them initiates the OAuth flow against your
Supabase project. They will surface a "provider is not enabled" error until
you complete one of the setups below.

### Google (free; ~5 min)
1. Go to <https://console.cloud.google.com/apis/credentials>. Pick or create a
   project named e.g. `berkepak`.
2. **OAuth consent screen**:
   - User type: **External**.
   - App name: `Berke Pak`. Support email: yours.
   - Scopes: leave defaults (`openid`, `email`, `profile`).
   - Test users: add your email.
3. **Credentials → Create Credentials → OAuth client ID**:
   - Type: **Web application**. Name: `Berke Pak Web`.
   - Authorized redirect URIs: add this exact URL (from Supabase →
     Authentication → Providers → Google):
     `https://<your-project-ref>.supabase.co/auth/v1/callback`
   - Click **Create**, copy the **Client ID** and **Client secret**.
4. Back in Supabase: Authentication → **Providers → Google** → toggle on,
   paste Client ID + Secret, **Save**.
5. Click **Continue with Google** in the storefront — the rest is automatic.

### Apple (~30 min; needs Apple Developer Program — $99/yr)
Requires:
- An Apple Developer account.
- A registered App ID and a Services ID (used as the "Client ID").
- A Sign in with Apple key (`.p8`) and a generated client secret JWT.

Walkthrough: <https://supabase.com/docs/guides/auth/social-login/auth-apple>.
The `Continue with Apple` button is wired and will work as soon as the
credentials are in Supabase Auth → Providers → Apple.

> Skip Apple unless you've already paid the Apple Developer fee — it's not a
> 5-minute setup like Google.

---

## 3. Saleor backend (`backend/`)

Optional today — the storefront catalog is currently served from
`web/src/lib/products.ts`. Bring Saleor up when you want to migrate the
catalog into a real PIM/inventory system.

```bash
cd BerkePak/backend
make init     # docker compose up -d + migrate + seed superuser
```

First run pulls ~2 GB of images and takes 5–10 min.

URLs once running:
- GraphQL API: <http://localhost:8000/graphql/>
- Saleor Dashboard: <http://localhost:9000>  (login: `admin@example.com` / `admin` — change it)
- Mailpit (intercepts dev email): <http://localhost:8025>

Connecting Saleor → storefront (catalog swap) is the next milestone.

---

## 4. Try the flows

### Customer flow
1. **Sign up** at `/signup`. Fields are all required; phone is validated as a
   Pakistani mobile (`03XXXXXXXXX` or `+923XXXXXXXXX`).
2. After submit you see the embedded **"Check your email"** panel. Open the
   email Supabase sent (or in local: <http://127.0.0.1:54324>) and click the
   link → you're dropped on `/account` signed in.
3. **Save measurements** at `/account/profile`.
4. **Cart + COD checkout:**
   - Open a fabric → **By the suit + Bespoke** → Add to Cart → Checkout.
   - Address pre-filled. Pick **Cash on Delivery**, **Send code** — the
     4-digit OTP is logged to the dev terminal AND printed in a dev banner.
     Verify, place order.
5. **Bank Transfer flow:** place an order with **Bank Transfer**, see IBAN/Raast
   on confirmation, go to `/account/receipts`, upload any image.

### Admin flow
1. Make sure your sign-up email is in `ADMIN_EMAILS` and restart the dev server.
2. `/admin/receipts` — preview each receipt via signed URL, **Approve** (flips
   order to `paid` + `confirmed`) or **Reject** with a reason (returns the
   order to `awaiting_receipt`).

---

## 5. What's stubbed (not blocking the dev flow)

- **SMS provider for OTP** — currently logs the code server-side and (in dev)
  returns it to the UI. Drop in Twilio / Vonage / a PK SMS gateway in
  [`src/lib/actions/otp.ts`](src/lib/actions/otp.ts) where the comment marks
  the spot.
- **Saleor → storefront integration** — backend container set up; storefront
  still uses the static fabric catalog. Catalog swap is the next milestone.
- **Abandoned cart reminders** — needs cron + email provider; not yet wired.
- **GA4 / Meta Pixel** — script injection ready; set
  `NEXT_PUBLIC_GA4_ID` and/or `NEXT_PUBLIC_META_PIXEL_ID` to activate.
