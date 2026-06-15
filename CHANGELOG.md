# Changelog

All notable changes to BerkePak are documented here.  
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).  
Versioning follows [Semantic Versioning](https://semver.org/).

---

## [0.2.0] — 2026-06-16

Post-MVP security hardening, order integrity, design system overhaul, and code quality pass. All changes shipped on branch `fix/sprint1-security` and merged to `main`.

### Security

- **Admin auth hardened** — removed `user_metadata` trust, replaced with `admin_users` table lookup via service role (`createSupabaseAdmin`). Privilege escalation via JWT manipulation no longer possible.
- **Middleware edge-safe** — rewrote admin route guard using `@supabase/ssr` `createServerClient` (replaces dynamic import pattern that was incompatible with the Edge runtime).
- **OTP server-side verification** — `placeOrder` now calls `verifyOtp` on the server. Removed `otpVerified` client-trust flag entirely.
- **OTP reuse fix** — `verifyOtp` now propagates `consumed_at` DB write error and returns `ok: false` if marking the code as consumed fails. Previously the error was silently discarded, allowing potential OTP reuse.
- **OTP `devCode` removed** — development shortcut code stripped from `sendOtp` response.
- **SMTP `rejectUnauthorized: false` removed** — SMTP transport no longer bypasses TLS certificate validation.
- **IBAN env var** — hardcoded IBAN replaced with `BANK_TRANSFER_IBAN` environment variable.
- **Per-phone OTP rate limit** — `checkRateLimitByKey` added; `sendOtp` now rate-limits per target (phone/email) independently of IP, preventing rotating-IP bypass attacks.
- **RLS policies hardened** — `promotions`, `campaigns`, and `product-images` storage write policies replaced. `auth.role() = 'authenticated'` predicates replaced with `admin_users` subquery checks.
- **`createSupabaseAdmin` guard** — throws at startup if `SUPABASE_SERVICE_ROLE_KEY` or `SUPABASE_URL` env vars are missing.

### Features

- **Mobile filter drawer** — shop page (`/shop`) now has a bottom-sheet filter drawer on mobile (`< lg`). Surfaces weave and sort controls previously hidden behind `hidden lg:block`. Trigger button shows active filter count badge. Follows CartDrawer z-index / `aria-modal` / `prefers-reduced-motion` pattern.
- **`place_order_atomic` PostgreSQL function** — order placement (INSERT order + order_items + stock decrement) runs in a single transaction. Eliminates partial-write race conditions on concurrent orders.

### Changed

- **Typography** — replaced Inter with Bricolage Grotesque (`--font-display`) + Hanken Grotesk (`--font-sans`).
- **Design system** — `focus-visible` rings on all interactive elements; hover styles gated behind `@media (hover: hover) and (pointer: fine)`; animations guarded with `prefers-reduced-motion: no-preference`; z-index layering formalized (header `z-30`, backdrop `z-40`, drawers `z-50`); background color `--color-paper: #faf9f7`.
- **Hero** — `min-h-[88dvh]`, CTA copy updated from "Discover" to "Shop Fabric".
- **CartDrawer** — `aria-modal="true"` added.
- **`bulkUpdatePrices`** — rewrote from N individual upserts to single `.upsert()` call.
- **Shipping threshold** — calculated on `originalSubtotal` (pre-discount), not discounted total.
- **StockDashboard refactor** — `StockDashboardClient.tsx` reduced from 951 to ~280 lines. State extracted to `useReducer` (`stockReducer.ts`). Three modals extracted to standalone components: `AddProductModal`, `DeleteConfirmModal`, `AddColorModal`. Types extracted to `types.ts`.
- **`ADMIN_EMAILS` startup warning** — console warns at boot if the env var is unset.

### Tests

- Vitest configured (`vitest.config.ts`) with `@/*` path alias.
- 27 tests across 4 suites: `isCurrentUserAdmin` (6), `verifyOtp` (5 → updated to assert `ok:false` on consumed_at write failure), `sendOtp` (6), `placeOrder` (5), `checkRateLimitByKey` (3).

### Database Migrations

| File | Description |
|------|-------------|
| `20260614000000_fix_rls_write_policies.sql` | Harden RLS write policies for promotions, campaigns, product-images |
| `20260614000001_rls_audit_notes.sql` | Audit notes and policy documentation |
| `20260614000002_place_order_atomic.sql` | `place_order_atomic` PostgreSQL function |

---

## [0.1.0] — 2026-05-28

Initial MVP release. Campaigns, promotions, order emails, cart re-validation, COD + bank transfer checkout, Supabase-only architecture (Saleor fully deprecated).

---

[0.2.0]: https://github.com/Itskindastrange/berkepak/compare/Production...v0.2.0
[0.1.0]: https://github.com/Itskindastrange/berkepak/releases/tag/Production
