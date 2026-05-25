# Security Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden BerkePak's auth, authorization, rate limiting, and input handling to production security standards.

**Architecture:** Next.js App Router + Supabase BaaS. All mutations go through server actions (no API routes). Rate limiting is currently in-memory (broken on Vercel serverless multi-instance). Security headers and input validation are absent. Several known bugs create real security vectors.

**Tech Stack:** Next.js 16, Supabase (RLS + RPC), Upstash Redis (`@upstash/ratelimit`), Zod, Nodemailer.

---

## File Map

| File | Change |
|------|--------|
| `web/next.config.ts` | Add security response headers (CSP, X-Frame-Options, etc.) |
| `web/src/lib/actions/auth.ts` | Fix open-redirect + add rate limiting to login/signup/forgot-password |
| `web/src/app/auth/callback/route.ts` | Fix open-redirect on `next` param |
| `web/src/lib/rate-limit.ts` | Replace in-memory Map with Upstash Redis sliding window |
| `web/src/lib/validation.ts` | NEW — Zod schemas for all critical server action inputs |
| `web/src/lib/actions/orders.ts` | Fix hardcoded `color='White'` → use `line.color` |
| `web/src/lib/actions/admin.ts` | Fix email XSS + add price bounds validation |
| `web/src/lib/actions/receipts.ts` | Add MIME type allowlist check |
| `web/src/lib/actions/newsletter.ts` | Add rate limit |
| `web/supabase/migrations/20260525000000_fix_rls_admin_write.sql` | NEW — fix product_catalog RLS policy (any auth user → admin_users only) |
| `web/supabase/migrations/20260525000001_stock_floor_guard.sql` | NEW — add GREATEST floor to decrement_product_stock RPC |

---

## Task 1: Fix Open-Redirect Vulnerabilities

**Scope:** Two vectors. `loginAction` passes `next` directly to `redirect()`. Auth callback uses `new URL(next, origin)` which resolves absolute URLs, ignoring the base.

**Files:**
- Modify: `web/src/lib/actions/auth.ts`
- Modify: `web/src/app/auth/callback/route.ts`

- [ ] **Step 1: Add safeRedirectPath helper to auth.ts**

In `web/src/lib/actions/auth.ts`, after line 12 (`const PK_MOBILE_RE = ...`), add:

```typescript
function safeRedirectPath(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return "/account";
  return next;
}
```

- [ ] **Step 2: Use safeRedirectPath in loginAction**

Replace `web/src/lib/actions/auth.ts:87`:
```typescript
  redirect(next);
```
With:
```typescript
  redirect(safeRedirectPath(next));
```

- [ ] **Step 3: Fix auth callback open-redirect**

Replace `web/src/app/auth/callback/route.ts:35`:
```typescript
  return NextResponse.redirect(new URL(next, url.origin));
```
With:
```typescript
  const safePath = next && next.startsWith("/") && !next.startsWith("//") ? next : "/account";
  return NextResponse.redirect(new URL(safePath, url.origin));
```

- [ ] **Step 4: Verify by manual test**

Start dev server (`npm run dev` in `web/`). Navigate to:
```
http://localhost:3000/login?next=https://evil.com
```
Expected: after successful login, you are redirected to `/account`, NOT `https://evil.com`.

Also test:
```
http://localhost:3000/auth/callback?next=https://evil.com
```
Expected: redirects to `http://localhost:3000/account`.

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/actions/auth.ts web/src/app/auth/callback/route.ts
git commit -m "fix: prevent open-redirect on login next param and auth callback"
```

---

## Task 2: Add Rate Limiting to Auth Endpoints

**Scope:** `loginAction`, `signupAction`, and `forgotPasswordAction` have no rate limiting. Attacker can brute-force passwords or spam password reset emails.

**Files:**
- Modify: `web/src/lib/actions/auth.ts`

- [ ] **Step 1: Add rate limiting to signupAction**

At the top of `signupAction` (after the `const fullName = ...` block, before the `if (!fullName)` check), add:

```typescript
  const rl = await checkRateLimit("auth_signup", 5, 60000);
  if (!rl.success) return { error: "Too many signup attempts. Please wait a minute." };
```

Add the import at the top of the file (after existing imports):
```typescript
import { checkRateLimit } from "@/lib/rate-limit";
```

- [ ] **Step 2: Add rate limiting to loginAction**

At the top of `loginAction` body (before `const supabase = ...`):
```typescript
  const rl = await checkRateLimit("auth_login", 10, 60000);
  if (!rl.success) return { error: "Too many login attempts. Please wait a minute." };
```

- [ ] **Step 3: Add rate limiting to forgotPasswordAction**

At the top of `forgotPasswordAction` body (before `try {`):
```typescript
  const rl = await checkRateLimit("auth_forgot", 3, 300000);
  if (!rl.success) return { error: "Too many password reset requests. Please wait 5 minutes." };
```

- [ ] **Step 4: Commit**

```bash
git add web/src/lib/actions/auth.ts
git commit -m "feat: add rate limiting to signup, login, and forgot-password actions"
```

---

## Task 3: Replace In-Memory Rate Limit with Upstash Redis

**Scope:** `web/src/lib/rate-limit.ts` uses a module-level `Map`. On Vercel, each serverless function invocation may be a different cold instance — the Map is NOT shared. Brute-force attacks split across instances bypass limits entirely.

**Solution:** Use `@upstash/ratelimit` (sliding window, edge-compatible). Falls back gracefully if env vars are missing (dev mode).

**Files:**
- Modify: `web/src/lib/rate-limit.ts`
- Modify: `web/package.json` (via npm install)

**Prerequisites:** Create a free Upstash Redis database at https://console.upstash.com. Add `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` to `.env.local` and Vercel project environment variables.

- [ ] **Step 1: Install packages**

```bash
cd web && npm install @upstash/ratelimit @upstash/redis
```

Expected output: packages added to `node_modules`, `package.json` updated.

- [ ] **Step 2: Rewrite rate-limit.ts**

Replace the entire contents of `web/src/lib/rate-limit.ts` with:

```typescript
import { headers } from "next/headers";

// Upstash Redis-backed rate limiting — works across Vercel serverless instances.
// Falls back to in-memory if UPSTASH_REDIS_REST_URL is not set (dev/local).

// ---- Upstash path ----
let upstashRatelimit: ((key: string, limit: number, windowMs: number) => Promise<{ success: boolean }>) | null = null;

async function initUpstash() {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return null;
  }
  try {
    const { Ratelimit } = await import("@upstash/ratelimit");
    const { Redis } = await import("@upstash/redis");
    const redis = Redis.fromEnv();

    return async (key: string, limit: number, windowMs: number) => {
      const limiter = new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(limit, `${windowMs}ms`),
        prefix: "berkepak_rl",
      });
      const result = await limiter.limit(key);
      return { success: result.success };
    };
  } catch {
    return null;
  }
}

// ---- In-memory fallback ----
interface RateLimitRecord {
  timestamps: number[];
}
const cache = new Map<string, RateLimitRecord>();

if (typeof global !== "undefined") {
  const g = global as any;
  if (!g.__rateLimitCleanupInterval) {
    g.__rateLimitCleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [key, record] of cache.entries()) {
        record.timestamps = record.timestamps.filter((t) => now - t < 60000);
        if (record.timestamps.length === 0) cache.delete(key);
      }
    }, 300000);
  }
}

function inMemoryCheck(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  let record = cache.get(key);
  if (!record) {
    record = { timestamps: [] };
    cache.set(key, record);
  }
  record.timestamps = record.timestamps.filter((t) => now - t < windowMs);
  if (record.timestamps.length >= limit) return false;
  record.timestamps.push(now);
  return true;
}

// ---- Public API ----
export async function checkRateLimit(
  keyPrefix: string,
  limit: number,
  windowMs: number = 60000,
): Promise<{ success: boolean; error?: string }> {
  try {
    const headersList = await headers();
    const rawIp = headersList.get("x-forwarded-for") || headersList.get("x-real-ip") || "127.0.0.1";
    const ip = rawIp.split(",")[0].trim();
    const key = `${keyPrefix}:${ip}`;

    const upstash = await initUpstash();
    if (upstash) {
      const result = await upstash(key, limit, windowMs);
      if (!result.success) {
        console.warn(`[RateLimit/Upstash] Blocked: ${key}`);
        return { success: false, error: "Too many requests. Please wait a moment and try again." };
      }
      return { success: true };
    }

    // Fallback: in-memory (single-instance only)
    const allowed = inMemoryCheck(key, limit, windowMs);
    if (!allowed) {
      console.warn(`[RateLimit/InMemory] Blocked: ${key}`);
      return { success: false, error: "Too many requests. Please wait a moment and try again." };
    }
    return { success: true };
  } catch (err) {
    console.warn("[RateLimit] Error, bypassing:", err);
    return { success: true };
  }
}
```

- [ ] **Step 3: Add env vars to .env.local**

```bash
# Add to web/.env.local
UPSTASH_REDIS_REST_URL=https://YOUR-UPSTASH-URL.upstash.io
UPSTASH_REDIS_REST_TOKEN=YOUR_UPSTASH_TOKEN
```

(Replace with real values from Upstash console. Omit to keep in-memory fallback for local dev.)

- [ ] **Step 4: Verify rate limit in dev**

Start dev server. Trigger login 11 times in rapid succession. Expected: 11th attempt returns "Too many login attempts" error. Check terminal for `[RateLimit/InMemory] Blocked:` or `[RateLimit/Upstash] Blocked:` log.

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/rate-limit.ts web/package.json web/package-lock.json
git commit -m "feat: replace in-memory rate limiting with Upstash Redis sliding window"
```

---

## Task 4: Add Security Response Headers

**Scope:** No HTTP security headers on any response. Browsers have no CSP, clickjacking protection, or MIME sniffing guards.

**Files:**
- Modify: `web/next.config.ts`

- [ ] **Step 1: Add headers() function to next.config.ts**

Replace entire contents of `web/next.config.ts` with:

```typescript
import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-XSS-Protection", value: "1; mode=block" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      // Next.js inline scripts (required for hydration)
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      // Supabase + Unsplash images
      "img-src 'self' data: blob: https://images.unsplash.com https://plus.unsplash.com https://*.supabase.co",
      // Supabase API + auth
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
      // Fonts & styles
      "style-src 'self' 'unsafe-inline'",
      "font-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "plus.unsplash.com" },
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
```

Note: Removed `dangerouslyAllowLocalIP: true` and stale Saleor localhost entries.

- [ ] **Step 2: Verify headers in dev**

```bash
cd web && npm run dev
# In another terminal:
curl -I http://localhost:3000 | grep -E "X-Frame|X-Content|CSP|Strict-Transport"
```

Expected output includes:
```
x-frame-options: DENY
x-content-type-options: nosniff
content-security-policy: default-src 'self'; ...
```

- [ ] **Step 3: Commit**

```bash
git add web/next.config.ts
git commit -m "feat: add security response headers (CSP, X-Frame-Options, HSTS, etc.)"
```

---

## Task 5: Fix HTML Email XSS in Admin Notifications

**Scope:** `notifyAdminsOfChange(actionName, details)` in `admin.ts` interpolates both params directly into HTML. If `actionName` or `details` contains `<script>` tags or other HTML, it renders in the email client.

**Files:**
- Modify: `web/src/lib/actions/admin.ts`

- [ ] **Step 1: Add escapeHtml helper**

Add the following function immediately before `notifyAdminsOfChange` (around line 410):

```typescript
function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
```

- [ ] **Step 2: Escape all interpolated values in the email template**

In `notifyAdminsOfChange`, find the html template string. Replace the three raw interpolations:

```typescript
// BEFORE:
subject: `⚠️ Admin Action Alert: ${actionName}`,
html: `
  ...
  <p ...><strong>Action:</strong> ${actionName}</p>
  ...
  ${details}
  ...
`,

// AFTER:
subject: `Admin Action Alert: ${escapeHtml(actionName)}`,
html: `
  ...
  <p ...><strong>Action:</strong> ${escapeHtml(actionName)}</p>
  ...
  ${escapeHtml(details)}
  ...
`,
```

The full corrected `sendMail` call in `notifyAdminsOfChange`:

```typescript
await transporter.sendMail({
  from: `"BerkePak Fabrics" <${smtpUser}>`,
  to: "admin@berkepakfabrics.com, abdullahahmad@berkepakfabrics.com",
  subject: `Admin Action Alert: ${escapeHtml(actionName)}`,
  html: `
    <div style="font-family:sans-serif;padding:20px;background:#fafaf9;color:#1c1917;">
      <div style="max-width:600px;margin:0 auto;background:#fff;padding:30px;border-radius:8px;border:1px solid #e7e5e4;">
        <h2 style="font-size:20px;font-weight:700;color:#b91c1c;margin-bottom:20px;border-bottom:2px solid #f5f5f4;padding-bottom:10px;">
          Admin Action Logged
        </h2>
        <p style="font-size:14px;margin-bottom:12px;"><strong>Action:</strong> ${escapeHtml(actionName)}</p>
        <p style="font-size:14px;margin-bottom:12px;"><strong>Timestamp:</strong> ${new Date().toLocaleString()}</p>
        <div style="background:#f5f5f4;padding:15px;border-radius:6px;font-family:monospace;font-size:13px;white-space:pre-wrap;margin-top:15px;border-left:4px solid #b91c1c;">
          ${escapeHtml(details)}
        </div>
      </div>
    </div>
  `,
});
```

- [ ] **Step 3: Commit**

```bash
git add web/src/lib/actions/admin.ts
git commit -m "fix: HTML-escape admin notification email content to prevent XSS"
```

---

## Task 6: Fix Hardcoded Color in orders.ts + Add Price Bounds

**Scope:** Two bugs in `admin.ts` and `orders.ts`.

1. `orders.ts:62` has `const color = "White"` — ignores `CartLine.color`. Stock is always decremented for White regardless of what the customer chose.
2. `updateSingleProductPrice` accepts `newPrice` of `0`, negative, `NaN`, or `Infinity`. Admin can zero-price all products.

**Files:**
- Modify: `web/src/lib/actions/orders.ts`
- Modify: `web/src/lib/actions/admin.ts`

- [ ] **Step 1: Fix hardcoded color in orders.ts**

In `web/src/lib/actions/orders.ts`, find lines 61-63:
```typescript
    const color = "White"; // CartLine has no color field; default to White
```

Replace with:
```typescript
    const color = line.color || "White";
```

- [ ] **Step 2: Add price bounds to updateSingleProductPrice**

In `web/src/lib/actions/admin.ts`, find `updateSingleProductPrice` function. After the `requireAdmin()` check (around line 142), add:

```typescript
  if (!Number.isFinite(newPrice) || newPrice < 100) {
    return { ok: false, error: "Price must be at least 100 PKR." };
  }
  if (newPrice > 1_000_000) {
    return { ok: false, error: "Price cannot exceed 1,000,000 PKR." };
  }
```

- [ ] **Step 3: Add bounds to bulkUpdatePrices**

In `bulkUpdatePrices`, find the line:
```typescript
    const roundedPrice = Math.max(0, Math.round(newPrice / 10) * 10);
```

Replace with:
```typescript
    const roundedPrice = Math.min(1_000_000, Math.max(100, Math.round(newPrice / 10) * 10));
```

- [ ] **Step 4: Commit**

```bash
git add web/src/lib/actions/orders.ts web/src/lib/actions/admin.ts
git commit -m "fix: use CartLine.color for stock decrement; add price bounds validation"
```

---

## Task 7: Receipt File Type Validation

**Scope:** `uploadReceipt` in `receipts.ts` only checks file size. Attacker can upload `.php` or `.html` files with image extensions. Supabase Storage serves them with the content-type the client provides, which could allow stored XSS or code execution in some contexts.

**Files:**
- Modify: `web/src/lib/actions/receipts.ts`

- [ ] **Step 1: Add MIME type allowlist**

In `uploadReceipt`, after the `file.size > 10 * 1024 * 1024` check (around line 19), add:

```typescript
  const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp", "image/heic", "application/pdf"];
  if (!ALLOWED_MIME.includes(file.type)) {
    return { ok: false, error: "Only JPEG, PNG, WebP, HEIC, or PDF files are accepted." };
  }
```

- [ ] **Step 2: Force safe content-type on upload**

Still in `uploadReceipt`, find the storage upload call (line 41):
```typescript
    .upload(path, file, { contentType: file.type, upsert: false });
```

Replace with:
```typescript
    .upload(path, file, {
      contentType: ALLOWED_MIME.includes(file.type) ? file.type : "application/octet-stream",
      upsert: false,
    });
```

- [ ] **Step 3: Commit**

```bash
git add web/src/lib/actions/receipts.ts
git commit -m "feat: add MIME type allowlist to receipt file upload"
```

---

## Task 8: Rate Limit Newsletter Subscription

**Scope:** `subscribeToNewsletter` has no rate limiting. Open endpoint — any IP can spam the database and trigger admin notification emails.

**Files:**
- Modify: `web/src/lib/actions/newsletter.ts`

- [ ] **Step 1: Read current file**

```bash
cat web/src/lib/actions/newsletter.ts
```

- [ ] **Step 2: Add rate limit**

At the top of the `subscribeToNewsletter` function body, after initial email validation, add:

```typescript
  import { checkRateLimit } from "@/lib/rate-limit";
  // (add this import at the top of the file alongside other imports)
  
  const rl = await checkRateLimit("newsletter_subscribe", 3, 60000);
  if (!rl.success) return { error: "Too many requests. Please try again later." };
```

The complete import block at top of file should include:
```typescript
import { checkRateLimit } from "@/lib/rate-limit";
```

- [ ] **Step 3: Commit**

```bash
git add web/src/lib/actions/newsletter.ts
git commit -m "feat: add rate limiting to newsletter subscription endpoint"
```

---

## Task 9: Fix RLS — product_catalog Admin Write Policy

**Scope:** The `product_catalog` table has an RLS policy `admin_write` using `auth.role() = 'authenticated'`. This grants every signed-in user (i.e., every shopper) INSERT, UPDATE, DELETE on products and prices. A shopper can set `price_per_suit = 0` for all products via Supabase SDK.

**Fix:** Replace the policy with one that checks against an `admin_users` lookup table.

**Files:**
- Create: `web/supabase/migrations/20260525000000_fix_rls_admin_write.sql`

- [ ] **Step 1: Create the migration file**

Create `web/supabase/migrations/20260525000000_fix_rls_admin_write.sql`:

```sql
-- Fix: product_catalog admin_write policy was granting write access to ALL
-- authenticated users. Replace with admin-only check via admin_users table.
-- If admin_users table doesn't exist, fall back to a service-role-only policy.

-- Drop the unsafe policy
DROP POLICY IF EXISTS admin_write ON product_catalog;

-- Create admin_users table if it doesn't exist (idempotent)
CREATE TABLE IF NOT EXISTS admin_users (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Only service role can manage admin_users
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS admin_users_service_only ON admin_users;
CREATE POLICY admin_users_service_only ON admin_users
  USING (false)
  WITH CHECK (false);

-- New write policy: only users listed in admin_users can mutate product_catalog
DROP POLICY IF EXISTS admin_write_safe ON product_catalog;
CREATE POLICY admin_write_safe ON product_catalog
  FOR ALL
  USING (
    auth.uid() IN (SELECT user_id FROM admin_users)
  )
  WITH CHECK (
    auth.uid() IN (SELECT user_id FROM admin_users)
  );

-- Seed admin_users from ADMIN_EMAILS env var is not possible in pure SQL.
-- Use this snippet in Supabase SQL editor (replace the UUID with your admin's user ID):
-- INSERT INTO admin_users (user_id) VALUES ('YOUR-ADMIN-USER-UUID') ON CONFLICT DO NOTHING;
```

- [ ] **Step 2: Apply migration locally**

```bash
cd web && npx supabase db push
```

Expected: migration applied successfully.

- [ ] **Step 3: Add admin user to admin_users table**

In Supabase Dashboard → SQL Editor, run:
```sql
-- Find your admin user UUID:
SELECT id, email FROM auth.users WHERE email = 'abdullahahmad@berkepakfabrics.com';

-- Then insert into admin_users:
INSERT INTO admin_users (user_id) VALUES ('<UUID-FROM-ABOVE>') ON CONFLICT DO NOTHING;
```

- [ ] **Step 4: Verify fix**

Log in as a non-admin user. In browser dev tools console, run:
```javascript
const { createClient } = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm");
const sb = createClient(window.__NEXT_DATA__.props.pageProps.supabaseUrl, window.__NEXT_DATA__.props.pageProps.anonKey);
// Or just use hardcoded public env var values from .env.local
const r = await sb.from("product_catalog").update({ price_per_suit: 1 }).eq("slug", "any-slug");
console.log(r.error); // Expected: RLS violation error, NOT null
```

- [ ] **Step 5: Commit**

```bash
git add web/supabase/migrations/20260525000000_fix_rls_admin_write.sql
git commit -m "fix: replace product_catalog admin_write RLS — restrict to admin_users table only"
```

---

## Task 10: Stock Decrement Floor Guard

**Scope:** `decrement_product_stock` SQL function has no floor guard. Concurrent orders for the last N units can both succeed, driving stock negative. No `FOR UPDATE` row lock prevents phantom reads between the check and the update.

**Files:**
- Create: `web/supabase/migrations/20260525000001_stock_floor_guard.sql`

- [ ] **Step 1: Create the migration**

Create `web/supabase/migrations/20260525000001_stock_floor_guard.sql`:

```sql
-- Replace decrement_product_stock with a version that:
-- 1. Acquires a row-level lock (FOR UPDATE) to prevent race conditions
-- 2. Returns false if insufficient stock, so callers can handle overselling
-- 3. Floors stock at 0 (never goes negative)

CREATE OR REPLACE FUNCTION decrement_product_stock(
  p_product_id UUID,
  p_color_name TEXT,
  p_quantity INT
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_stock INT;
BEGIN
  -- Lock the row to prevent concurrent race on the same product+color
  SELECT stock INTO current_stock
  FROM product_colors
  WHERE catalog_id = p_product_id
    AND color_name = p_color_name
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN FALSE; -- product/color combo doesn't exist
  END IF;

  IF current_stock < p_quantity THEN
    RETURN FALSE; -- insufficient stock
  END IF;

  UPDATE product_colors
  SET stock = GREATEST(stock - p_quantity, 0)
  WHERE catalog_id = p_product_id
    AND color_name = p_color_name;

  RETURN TRUE;
END;
$$;
```

- [ ] **Step 2: Update orders.ts to handle stock failure**

In `web/src/lib/actions/orders.ts`, find the stock decrement loop (around line 122):

```typescript
  for (const it of items) {
    const { error: decErr } = await adminClient.rpc("decrement_product_stock", {
      p_product_id: it.product_id,
      p_color_name: it.color,
      p_quantity: it.quantity,
    });
    if (decErr) {
      console.error(`Stock decrement failed for product ${it.product_id}:`, decErr.message);
    }
  }
```

Replace with:
```typescript
  for (const it of items) {
    const { data: stockOk, error: decErr } = await adminClient.rpc("decrement_product_stock", {
      p_product_id: it.product_id,
      p_color_name: it.color,
      p_quantity: it.quantity,
    });
    if (decErr) {
      console.error(`Stock decrement error for product ${it.product_id}:`, decErr.message);
    } else if (!stockOk) {
      console.warn(`Stock insufficient for product ${it.product_id} color ${it.color} — order saved but stock not decremented`);
    }
  }
```

- [ ] **Step 3: Apply migration**

```bash
cd web && npx supabase db push
```

- [ ] **Step 4: Commit**

```bash
git add web/supabase/migrations/20260525000001_stock_floor_guard.sql web/src/lib/actions/orders.ts
git commit -m "fix: add row-level lock and floor guard to decrement_product_stock RPC"
```

---

## Task 11: Input Validation with Zod

**Scope:** Server actions have manual `if (!field)` checks but no type coercion or schema validation. Malformed inputs (wrong types, extra-long strings, unexpected shapes) can cause uncaught errors or unexpected DB behavior.

**Files:**
- Create: `web/src/lib/validation.ts`
- Modify: `web/src/lib/actions/auth.ts`
- Modify: `web/src/lib/actions/orders.ts`

- [ ] **Step 1: Install Zod**

```bash
cd web && npm install zod
```

- [ ] **Step 2: Create validation.ts**

Create `web/src/lib/validation.ts`:

```typescript
import { z } from "zod";

const PK_MOBILE_RE = /^(?:\+92|0)3\d{9}$/;

export const SignupSchema = z.object({
  fullName: z.string().min(2).max(100).trim(),
  email: z.string().email().toLowerCase(),
  phone: z.string().refine((v) => PK_MOBILE_RE.test(v.replace(/[\s-]/g, "")), {
    message: "Enter a valid Pakistani mobile number (e.g. 03001234567).",
  }),
  password: z.string().min(8).max(128),
});

export const LoginSchema = z.object({
  email: z.string().email().toLowerCase(),
  password: z.string().min(1).max(128),
});

export const AddressSchema = z.object({
  name: z.string().min(2).max(100),
  phone: z.string().min(7).max(20),
  line1: z.string().min(5).max(200),
  line2: z.string().max(200).optional(),
  city: z.string().min(2).max(100),
  province: z.string().min(2).max(100),
});

export const CartLineSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().min(1).max(50),
  unit: z.enum(["suit", "meter"]),
  stitching: z.enum(["none", "bespoke"]),
  color: z.string().min(1).max(50),
});

export const PlaceOrderSchema = z.object({
  lines: z.array(CartLineSchema).min(1).max(20),
  address: AddressSchema,
  paymentMethod: z.enum(["cod", "bank_transfer"]),
  otpVerified: z.boolean(),
});

export const PriceSchema = z.number().finite().min(100).max(1_000_000);
```

- [ ] **Step 3: Use SignupSchema and LoginSchema in auth.ts**

At top of `web/src/lib/actions/auth.ts`, add import:
```typescript
import { SignupSchema, LoginSchema } from "@/lib/validation";
```

In `signupAction`, replace the manual field extraction + validation block with:

```typescript
  const raw = {
    fullName: String(formData.get("fullName") ?? "").trim(),
    email: String(formData.get("email") ?? "").trim(),
    phone: normalizePhone(String(formData.get("phone") ?? "").trim()),
    password: String(formData.get("password") ?? ""),
  };
  const parsed = SignupSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.errors[0].message };
  }
  const { fullName, email, phone, password } = parsed.data;
```

In `loginAction`, replace manual extraction with:
```typescript
  const raw = {
    email: String(formData.get("email") ?? "").trim(),
    password: String(formData.get("password") ?? ""),
  };
  const parsed = LoginSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: "Invalid email or password format." };
  }
  const { email, password } = parsed.data;
  const next = String(formData.get("next") ?? "/account");
```

- [ ] **Step 4: Use PlaceOrderSchema in orders.ts**

At top of `web/src/lib/actions/orders.ts`, add:
```typescript
import { PlaceOrderSchema } from "@/lib/validation";
```

In `placeOrder`, immediately after the rate limit check, add:
```typescript
  const parsed = PlaceOrderSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0].message };
  }
  const validInput = parsed.data;
```

Then use `validInput` instead of `input` for the rest of the function (replace `input.lines` with `validInput.lines`, `input.address` with `validInput.address`, etc.).

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd web && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add web/src/lib/validation.ts web/src/lib/actions/auth.ts web/src/lib/actions/orders.ts web/package.json web/package-lock.json
git commit -m "feat: add Zod schemas for server action input validation"
```

---

## Self-Review Checklist

**Spec coverage:**
- [x] Open-redirect fix (Task 1)
- [x] Auth rate limiting (Task 2)
- [x] Production-grade rate limiting with Upstash (Task 3)
- [x] Security response headers (Task 4)
- [x] Email XSS (Task 5)
- [x] Hardcoded color bug (Task 6)
- [x] Price bounds (Task 6)
- [x] Receipt MIME validation (Task 7)
- [x] Newsletter rate limit (Task 8)
- [x] RLS admin_write fix (Task 9)
- [x] Stock floor guard (Task 10)
- [x] Zod input validation (Task 11)

**Known gaps (intentional defers):**
- `catalog_id NOT NULL` migration (depends on data migration being complete first — flagged in previous session as a separate follow-up)
- SMS OTP provider (stubbed, tracked in CLAUDE.md milestones)
- Password complexity (8-char min is Supabase's default; stronger policy requires Supabase Auth config, not code)
