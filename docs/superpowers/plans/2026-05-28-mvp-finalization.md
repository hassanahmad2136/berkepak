# MVP Finalization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement 5 MVP-completing features: comment out Apple auth, card payment boilerplate, fabric image + optional fields in admin, promotions system (popup banner + coupon), and order confirmation email.

**Architecture:** All changes in `web/`. DB via Supabase migrations. Client components follow existing patterns (local React state + server actions). `nodemailer` is already installed. SMTP creds already in `.env.local`. No new npm packages needed.

**Tech Stack:** Next.js 14+, Supabase (Postgres + Storage + Auth), React, TypeScript, Tailwind CSS, nodemailer (already in `node_modules`).

---

## File Map

**New files:**
- `web/supabase/migrations/20260528000000_promotions.sql` — promotions table, orders columns, storage bucket + policies
- `web/src/lib/actions/promotions.ts` — createPromotion, togglePromotion, deletePromotion, validateCoupon
- `web/src/app/admin/promotions/page.tsx` — server page component
- `web/src/app/admin/promotions/PromotionsDashboardClient.tsx` — admin promotions UI
- `web/src/components/PromotionPopup.tsx` — dismissible homepage popup
- `web/src/lib/email.ts` — nodemailer transport + sendEmail helper
- `web/src/lib/email-templates/order-confirmation.ts` — HTML email builder
- `web/src/lib/actions/email-actions.ts` — sendOrderConfirmationEmail server action

**Modified files:**
- `web/src/components/SocialAuthButtons.tsx` — comment out Apple button
- `web/src/app/checkout/CheckoutFlow.tsx` — card payment boilerplate + coupon code input
- `web/src/lib/validation.ts` — add promoId to PlaceOrderSchema
- `web/src/lib/actions/admin.ts` — extend adminCreateProduct with imageUrl, weaveType, threadCount
- `web/src/app/admin/stock/StockDashboardClient.tsx` — add image upload + weave/thread fields
- `web/src/lib/actions/orders.ts` — extend placeOrder with promo + email trigger
- `web/src/app/page.tsx` — fetch active banner promos + render PromotionPopup
- `web/src/app/admin/layout.tsx` — add Promotions nav link
- `web/src/app/admin/AdminHeader.tsx` — add Promotions header entry

---

## Task 1: Create Feature Branch

**Files:** none (git operations)

- [ ] **Step 1: Create and switch to feature branch**

```bash
cd /Users/abdullah/code/BerkePak
git checkout -b mvp-finalization
```

Expected: `Switched to a new branch 'mvp-finalization'`

---

## Task 2: Comment Out Apple Auth

**Files:**
- Modify: `web/src/components/SocialAuthButtons.tsx`

- [ ] **Step 1: Comment out the Apple button**

In `web/src/components/SocialAuthButtons.tsx`, wrap the Apple `<button>` element (lines ~53–61) in a comment block. The result should look like:

```tsx
      <button
        type="button"
        onClick={() => sign("google")}
        disabled={busy !== null}
        className="btn btn-ghost w-full inline-flex items-center justify-center gap-3"
      >
        <GoogleMark />
        <span>{busy === "google" ? "Redirecting…" : "Continue with Google"}</span>
      </button>

      {/* Apple auth — re-enable post-launch after configuring Apple OAuth credentials in Supabase
      <button
        type="button"
        onClick={() => sign("apple")}
        disabled={busy !== null}
        className="btn btn-ghost w-full inline-flex items-center justify-center gap-3"
      >
        <AppleMark />
        <span>{busy === "apple" ? "Redirecting…" : "Continue with Apple"}</span>
      </button>
      */}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd web && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add web/src/components/SocialAuthButtons.tsx
git commit -m "feat: comment out Apple auth button pending OAuth credentials"
```

---

## Task 3: Card Payment Disabled Boilerplate

**Files:**
- Modify: `web/src/app/checkout/CheckoutFlow.tsx`

- [ ] **Step 1: Add disabled card payment option after the bank transfer label block**

In `web/src/app/checkout/CheckoutFlow.tsx`, after the closing `</label>` of the bank transfer option (around line 348), insert:

```tsx
              {/* Card payment — wired post-launch. See docs/superpowers/specs/ for integration notes. */}
              <div
                className="block border border-stone p-5 opacity-50 cursor-not-allowed select-none"
              >
                <div className="flex items-start gap-3">
                  <input
                    type="radio"
                    name="payment"
                    disabled
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">Pay with Card</p>
                      <span className="text-[9px] uppercase font-bold tracking-wider text-stone-500 bg-stone-100 border border-stone-200 px-1.5 py-0.5 rounded">
                        Coming Soon
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted">
                      Credit and debit cards via secure payment gateway. Available soon.
                    </p>
                  </div>
                </div>
              </div>
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd web && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add web/src/app/checkout/CheckoutFlow.tsx
git commit -m "feat: add disabled card payment boilerplate with coming-soon badge"
```

---

## Task 4: Fabric Optional Fields in Admin Create Form

**Files:**
- Modify: `web/src/lib/actions/admin.ts`
- Modify: `web/src/app/admin/stock/StockDashboardClient.tsx`

`weave_type`, `thread_count`, and `images` already exist in the `product_catalog` schema. This task exposes them in the UI and server action.

- [ ] **Step 1: Extend adminCreateProduct server action**

In `web/src/lib/actions/admin.ts`, find the `adminCreateProduct` function signature (around line 343) and update it to:

```ts
export async function adminCreateProduct(
  name: string,
  slug: string,
  categoryKey: string,
  pricePerSuit: number,
  composition: string,
  description: string,
  imageUrl?: string | null,
  weaveType?: string | null,
  threadCount?: number | null,
): Promise<{ ok: boolean; productId?: string; error?: string }> {
```

In the same function, update the `.insert({...})` call to include the new optional fields:

```ts
  const { data, error } = await admin
    .from("product_catalog")
    .insert({
      slug,
      name,
      category: categoryKey,
      price_per_suit: pricePerSuit,
      price_per_meter: 0,
      composition,
      description,
      short_description:
        description.length > 120 ? description.slice(0, 117) + "..." : description,
      is_active: true,
      is_new: false,
      is_featured: false,
      images: imageUrl ? [imageUrl] : [],
      weave_type: weaveType ?? null,
      thread_count: threadCount ?? null,
    })
    .select("id")
    .single();
```

- [ ] **Step 2: Add state for new fields in StockDashboardClient**

In `web/src/app/admin/stock/StockDashboardClient.tsx`, add these state declarations after the existing `addFormDescription` state (around line 66):

```tsx
  const [addFormWeaveType, setAddFormWeaveType] = useState("");
  const [addFormThreadCount, setAddFormThreadCount] = useState("");
  const [addFormImageFile, setAddFormImageFile] = useState<File | null>(null);
  const [addFormImagePreview, setAddFormImagePreview] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
```

Also add `createSupabaseBrowser` to the imports at the top of the file:

```tsx
import { createSupabaseBrowser } from "@/lib/supabase/client";
```

- [ ] **Step 3: Update handleCreateProductSubmit to upload image and pass new fields**

Replace the existing `handleCreateProductSubmit` function body in `StockDashboardClient.tsx` with:

```tsx
  const handleCreateProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addFormName || !addFormSlug || !addFormPrice || !addFormComposition || !addFormDescription) {
      setAddError("All fields are required.");
      return;
    }

    const priceNum = parseFloat(addFormPrice);
    if (isNaN(priceNum) || priceNum <= 0) {
      setAddError("Price must be a valid positive number.");
      return;
    }

    setIsSubmittingAdd(true);
    setAddError(null);

    try {
      let imageUrl: string | null = null;

      if (addFormImageFile) {
        setIsUploadingImage(true);
        const supabase = createSupabaseBrowser();
        const ext = addFormImageFile.name.split(".").pop() ?? "jpg";
        const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from("product-images")
          .upload(path, addFormImageFile, { cacheControl: "3600", upsert: false });
        setIsUploadingImage(false);
        if (uploadErr) {
          setAddError(`Image upload failed: ${uploadErr.message}`);
          setIsSubmittingAdd(false);
          return;
        }
        const { data: { publicUrl } } = supabase.storage
          .from("product-images")
          .getPublicUrl(path);
        imageUrl = publicUrl;
      }

      const threadCountNum = addFormThreadCount ? parseInt(addFormThreadCount) : null;

      const res = await adminCreateProduct(
        addFormName,
        addFormSlug,
        addFormCategory,
        priceNum,
        addFormComposition,
        addFormDescription,
        imageUrl,
        addFormWeaveType || null,
        isNaN(threadCountNum as number) ? null : threadCountNum,
      );

      if (res.ok) {
        setAddFormName("");
        setAddFormSlug("");
        setAddFormCategory("cotton");
        setAddFormPrice("");
        setAddFormComposition("");
        setAddFormDescription("");
        setAddFormWeaveType("");
        setAddFormThreadCount("");
        setAddFormImageFile(null);
        setAddFormImagePreview(null);
        setShowAddModal(false);
        window.location.reload();
      } else {
        setAddError(res.error || "Failed to create product.");
      }
    } catch (err: unknown) {
      setAddError(err instanceof Error ? err.message : "An unexpected error occurred.");
    } finally {
      setIsSubmittingAdd(false);
      setIsUploadingImage(false);
    }
  };
```

- [ ] **Step 4: Add image + weave + thread fields to the Create Fabric modal JSX**

In `StockDashboardClient.tsx`, inside the Create Fabric Modal's `<form>`, add these fields after the `{/* Description */}` block and before the `{/* Info notice about default colors */}` block:

```tsx
              {/* Fabric Image (optional) */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-ink">
                  Fabric Image <span className="font-normal text-muted">(optional)</span>
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0] ?? null;
                    setAddFormImageFile(file);
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = (ev) => setAddFormImagePreview(ev.target?.result as string);
                      reader.readAsDataURL(file);
                    } else {
                      setAddFormImagePreview(null);
                    }
                  }}
                  className="w-full border border-stone rounded px-3 py-2 text-sm text-ink bg-white focus:border-ink focus:outline-none transition-colors cursor-pointer file:mr-3 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:bg-stone-100 file:text-ink file:cursor-pointer"
                />
                {addFormImagePreview && (
                  <div className="mt-2 relative w-20 h-20 border border-stone rounded overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={addFormImagePreview} alt="preview" className="w-full h-full object-cover" />
                  </div>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {/* Weave Type (optional) */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-ink">
                    Weave Type <span className="font-normal text-muted">(optional)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Plain, Twill, Satin"
                    value={addFormWeaveType}
                    onChange={(e) => setAddFormWeaveType(e.target.value)}
                    className="w-full border border-stone rounded px-3 py-2 text-sm text-ink bg-white focus:border-ink focus:outline-none transition-colors"
                  />
                </div>

                {/* Thread Count (optional) */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-ink">
                    Thread Count <span className="font-normal text-muted">(optional)</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    placeholder="e.g. 120"
                    value={addFormThreadCount}
                    onChange={(e) => setAddFormThreadCount(e.target.value)}
                    className="w-full border border-stone rounded px-3 py-2 text-sm text-ink bg-white focus:border-ink focus:outline-none transition-colors"
                  />
                </div>
              </div>
```

Also update the submit button to show upload state:

```tsx
                <button
                  type="submit"
                  disabled={isSubmittingAdd}
                  id="submit-add-btn"
                  className="px-4 py-2 text-xs font-bold text-paper bg-ink hover:bg-stone-900 rounded-md transition-colors cursor-pointer flex items-center gap-1.5 active:scale-95"
                >
                  {isUploadingImage ? "Uploading image…" : isSubmittingAdd ? "Creating..." : "Create Product"}
                </button>
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd web && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add web/src/lib/actions/admin.ts web/src/app/admin/stock/StockDashboardClient.tsx
git commit -m "feat: add image upload, weave type, and thread count to admin product creation"
```

---

## Task 5: DB Migration — Promotions Table + Storage Bucket

**Files:**
- Create: `web/supabase/migrations/20260528000000_promotions.sql`

- [ ] **Step 1: Create the migration file**

Create `web/supabase/migrations/20260528000000_promotions.sql` with:

```sql
-- =====================================================================
-- Berke Pak — Promotions system + product-images storage bucket
-- =====================================================================

-- 1. Promotions table
create table if not exists public.promotions (
  id               uuid        primary key default gen_random_uuid(),
  type             text        not null check (type in ('banner', 'coupon')),
  title            text        not null,
  body             text,
  code             text        unique,
  discount_type    text        check (discount_type in ('pct', 'fixed')),
  discount_value   numeric(10, 2),
  min_order_amount numeric(10, 2) not null default 0,
  is_active        boolean     not null default true,
  starts_at        timestamptz,
  ends_at          timestamptz,
  created_at       timestamptz not null default now()
);

-- 2. Add discount columns to orders
alter table public.orders
  add column if not exists discount_amount numeric(10, 2) not null default 0,
  add column if not exists promo_id        uuid references public.promotions(id);

-- 3. RLS on promotions
alter table public.promotions enable row level security;

-- Public: anyone can read active promotions (needed for homepage popup server fetch)
create policy "promotions_public_read"
  on public.promotions for select
  using (is_active = true);

-- Admin: authenticated users can do everything (RLS for write is enforced via requireAdmin() in server actions)
create policy "promotions_admin_all"
  on public.promotions for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- 4. product-images storage bucket
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images',
  'product-images',
  true,
  5242880,  -- 5MB limit
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do nothing;

-- Storage policies for product-images
create policy "product_images_public_read"
  on storage.objects for select
  using (bucket_id = 'product-images');

create policy "product_images_auth_upload"
  on storage.objects for insert
  with check (bucket_id = 'product-images' and auth.role() = 'authenticated');

create policy "product_images_auth_delete"
  on storage.objects for delete
  using (bucket_id = 'product-images' and auth.role() = 'authenticated');
```

- [ ] **Step 2: Apply the migration to local Supabase**

```bash
cd web && npx supabase db push --local
```

Expected: migration applies without error.

If local Supabase is not running, start it first:
```bash
npx supabase start
```

- [ ] **Step 3: Commit**

```bash
git add web/supabase/migrations/20260528000000_promotions.sql
git commit -m "feat: add promotions table, orders discount columns, product-images storage bucket"
```

---

## Task 6: Promotions Server Actions

**Files:**
- Create: `web/src/lib/actions/promotions.ts`

- [ ] **Step 1: Create the promotions server actions file**

Create `web/src/lib/actions/promotions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdmin, createSupabaseServer } from "@/lib/supabase/server";
import { isCurrentUserAdmin } from "@/lib/admin";

type ActionResult = { ok: true } | { ok: false; error: string };

async function requireAdmin(): Promise<ActionResult> {
  const isAdmin = await isCurrentUserAdmin();
  if (!isAdmin) return { ok: false, error: "Not an admin." };
  return { ok: true };
}

export type CreatePromotionInput = {
  type: "banner" | "coupon";
  title: string;
  body?: string;
  code?: string;
  discountType?: "pct" | "fixed";
  discountValue?: number;
  minOrderAmount?: number;
  isActive: boolean;
  startsAt?: string;
  endsAt?: string;
};

export async function createPromotion(input: CreatePromotionInput): Promise<ActionResult & { id?: string }> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  if (!input.title.trim()) return { ok: false, error: "Title is required." };
  if (input.type === "coupon") {
    if (!input.code?.trim()) return { ok: false, error: "Coupon code is required." };
    if (!input.discountType) return { ok: false, error: "Discount type is required for coupons." };
    if (!input.discountValue || input.discountValue <= 0) return { ok: false, error: "Discount value must be positive." };
    if (input.discountType === "pct" && input.discountValue > 100) return { ok: false, error: "Percentage discount cannot exceed 100." };
  }

  const admin = createSupabaseAdmin();
  const { data, error } = await admin
    .from("promotions")
    .insert({
      type: input.type,
      title: input.title.trim(),
      body: input.body?.trim() || null,
      code: input.type === "coupon" ? input.code!.toUpperCase().trim() : null,
      discount_type: input.discountType ?? null,
      discount_value: input.discountValue ?? null,
      min_order_amount: input.minOrderAmount ?? 0,
      is_active: input.isActive,
      starts_at: input.startsAt || null,
      ends_at: input.endsAt || null,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") return { ok: false, error: "Promo code already exists." };
    return { ok: false, error: error.message };
  }

  revalidatePath("/admin/promotions");
  revalidatePath("/");
  return { ok: true, id: data.id };
}

export async function togglePromotion(id: string, isActive: boolean): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const admin = createSupabaseAdmin();
  const { error } = await admin
    .from("promotions")
    .update({ is_active: isActive })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/promotions");
  revalidatePath("/");
  return { ok: true };
}

export async function deletePromotion(id: string): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const admin = createSupabaseAdmin();
  const { error } = await admin
    .from("promotions")
    .delete()
    .eq("id", id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/promotions");
  revalidatePath("/");
  return { ok: true };
}

export type ValidateCouponResult =
  | { ok: true; promoId: string; discountAmount: number; code: string }
  | { ok: false; error: string };

export async function validateCoupon(
  code: string,
  subtotal: number,
): Promise<ValidateCouponResult> {
  if (!code.trim()) return { ok: false, error: "Enter a promo code." };

  const admin = createSupabaseAdmin();
  const { data: promo, error } = await admin
    .from("promotions")
    .select("id, discount_type, discount_value, min_order_amount, is_active, starts_at, ends_at")
    .eq("code", code.toUpperCase().trim())
    .eq("type", "coupon")
    .eq("is_active", true)
    .maybeSingle();

  if (error || !promo) return { ok: false, error: "Invalid or expired promo code." };

  const now = new Date();
  if (promo.starts_at && new Date(promo.starts_at) > now) {
    return { ok: false, error: "Promo code is not yet active." };
  }
  if (promo.ends_at && new Date(promo.ends_at) < now) {
    return { ok: false, error: "Promo code has expired." };
  }
  if (Number(promo.min_order_amount) > 0 && subtotal < Number(promo.min_order_amount)) {
    return { ok: false, error: `Minimum order of PKR ${promo.min_order_amount} required.` };
  }

  const discountAmount =
    promo.discount_type === "pct"
      ? Math.floor(subtotal * (Number(promo.discount_value) / 100))
      : Math.min(Number(promo.discount_value), subtotal);

  return { ok: true, promoId: promo.id, discountAmount, code: code.toUpperCase().trim() };
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd web && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add web/src/lib/actions/promotions.ts
git commit -m "feat: add promotions server actions (create, toggle, delete, validateCoupon)"
```

---

## Task 7: Admin Promotions Page

**Files:**
- Create: `web/src/app/admin/promotions/page.tsx`
- Create: `web/src/app/admin/promotions/PromotionsDashboardClient.tsx`
- Modify: `web/src/app/admin/layout.tsx`
- Modify: `web/src/app/admin/AdminHeader.tsx`

- [ ] **Step 1: Create the server page**

Create `web/src/app/admin/promotions/page.tsx`:

```tsx
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { PromotionsDashboardClient } from "./PromotionsDashboardClient";

export const dynamic = "force-dynamic";

export type PromotionRow = {
  id: string;
  type: "banner" | "coupon";
  title: string;
  body: string | null;
  code: string | null;
  discount_type: "pct" | "fixed" | null;
  discount_value: number | null;
  min_order_amount: number;
  is_active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
};

export default async function PromotionsPage() {
  const admin = createSupabaseAdmin();
  const { data, error } = await admin
    .from("promotions")
    .select("id, type, title, body, code, discount_type, discount_value, min_order_amount, is_active, starts_at, ends_at, created_at")
    .order("created_at", { ascending: false });

  const promotions: PromotionRow[] = (data as PromotionRow[]) ?? [];

  return <PromotionsDashboardClient promotions={promotions} fetchError={error?.message ?? null} />;
}
```

- [ ] **Step 2: Create the client dashboard component**

Create `web/src/app/admin/promotions/PromotionsDashboardClient.tsx`:

```tsx
"use client";

import React, { useState } from "react";
import { createPromotion, togglePromotion, deletePromotion, type CreatePromotionInput } from "@/lib/actions/promotions";
import type { PromotionRow } from "./page";

interface Props {
  promotions: PromotionRow[];
  fetchError: string | null;
}

export function PromotionsDashboardClient({ promotions: initial, fetchError }: Props) {
  const [promos, setPromos] = useState<PromotionRow[]>(initial);
  const [showCreate, setShowCreate] = useState(false);

  // Create form state
  const [formType, setFormType] = useState<"banner" | "coupon">("banner");
  const [formTitle, setFormTitle] = useState("");
  const [formBody, setFormBody] = useState("");
  const [formCode, setFormCode] = useState("");
  const [formDiscountType, setFormDiscountType] = useState<"pct" | "fixed">("pct");
  const [formDiscountValue, setFormDiscountValue] = useState("");
  const [formMinOrder, setFormMinOrder] = useState("");
  const [formStartsAt, setFormStartsAt] = useState("");
  const [formEndsAt, setFormEndsAt] = useState("");
  const [formActive, setFormActive] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const resetForm = () => {
    setFormType("banner");
    setFormTitle("");
    setFormBody("");
    setFormCode("");
    setFormDiscountType("pct");
    setFormDiscountValue("");
    setFormMinOrder("");
    setFormStartsAt("");
    setFormEndsAt("");
    setFormActive(true);
    setFormError(null);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFormError(null);

    const input: CreatePromotionInput = {
      type: formType,
      title: formTitle,
      body: formBody || undefined,
      code: formType === "coupon" ? formCode : undefined,
      discountType: formDiscountValue ? formDiscountType : undefined,
      discountValue: formDiscountValue ? parseFloat(formDiscountValue) : undefined,
      minOrderAmount: formMinOrder ? parseFloat(formMinOrder) : undefined,
      isActive: formActive,
      startsAt: formStartsAt || undefined,
      endsAt: formEndsAt || undefined,
    };

    const res = await createPromotion(input);
    setIsSubmitting(false);
    if (!res.ok) { setFormError(res.error); return; }
    setShowCreate(false);
    resetForm();
    window.location.reload();
  };

  const handleToggle = async (id: string, current: boolean) => {
    setTogglingId(id);
    await togglePromotion(id, !current);
    setPromos((p) => p.map((r) => r.id === id ? { ...r, is_active: !current } : r));
    setTogglingId(null);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Permanently delete this promotion?")) return;
    setDeletingId(id);
    await deletePromotion(id);
    setPromos((p) => p.filter((r) => r.id !== id));
    setDeletingId(null);
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">
          Manage banners (homepage popup) and coupon codes (checkout discount).
        </p>
        <button
          onClick={() => { resetForm(); setShowCreate(true); }}
          className="px-4 py-2 text-xs font-bold text-paper bg-ink hover:bg-stone-900 rounded-md transition-colors cursor-pointer"
        >
          + New Promotion
        </button>
      </div>

      {fetchError && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-4 py-3 rounded-lg">
          Failed to load promotions: {fetchError}
        </div>
      )}

      {promos.length === 0 && !fetchError && (
        <p className="text-sm text-muted py-10 text-center border border-dashed border-stone rounded-lg">
          No promotions yet. Create your first banner or coupon above.
        </p>
      )}

      {promos.length > 0 && (
        <div className="overflow-x-auto border border-stone rounded-lg">
          <table className="w-full text-xs">
            <thead className="bg-stone-50 text-muted border-b border-stone">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Title / Code</th>
                <th className="px-4 py-3 text-left font-semibold">Type</th>
                <th className="px-4 py-3 text-left font-semibold">Discount</th>
                <th className="px-4 py-3 text-left font-semibold">Expires</th>
                <th className="px-4 py-3 text-left font-semibold">Status</th>
                <th className="px-4 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {promos.map((p) => (
                <tr key={p.id} className="border-b border-stone last:border-0 hover:bg-stone-50/50 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-ink">{p.title}</p>
                    {p.code && (
                      <p className="font-mono text-muted mt-0.5">{p.code}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`uppercase font-bold text-[9px] px-1.5 py-0.5 rounded ${
                      p.type === "banner"
                        ? "bg-blue-50 text-blue-700 border border-blue-200"
                        : "bg-green-50 text-green-700 border border-green-200"
                    }`}>
                      {p.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {p.discount_value
                      ? p.discount_type === "pct"
                        ? `${p.discount_value}% off`
                        : `PKR ${p.discount_value} off`
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {p.ends_at ? new Date(p.ends_at).toLocaleDateString("en-PK") : "Never"}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleToggle(p.id, p.is_active)}
                      disabled={togglingId === p.id}
                      className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded border cursor-pointer transition-colors ${
                        p.is_active
                          ? "bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
                          : "bg-stone-50 text-muted border-stone hover:bg-stone-100"
                      }`}
                    >
                      {togglingId === p.id ? "…" : p.is_active ? "Active" : "Inactive"}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleDelete(p.id)}
                      disabled={deletingId === p.id}
                      className="text-red-600 hover:text-red-800 font-medium cursor-pointer transition-colors"
                    >
                      {deletingId === p.id ? "…" : "Delete"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Promotion Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white border border-stone rounded-xl shadow-lg max-w-lg w-full my-8 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-stone flex justify-between items-center bg-stone-50/50">
              <h4 className="font-semibold text-ink text-base">New Promotion</h4>
              <button
                onClick={() => { setShowCreate(false); resetForm(); }}
                className="text-stone-400 hover:text-ink transition-colors cursor-pointer"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleCreate} className="p-6 space-y-4">
              {formError && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-4 py-3 rounded-lg font-medium">
                  ⚠️ {formError}
                </div>
              )}

              {/* Type */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-ink">Type</label>
                <div className="flex gap-4 text-sm">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="promoType" value="banner" checked={formType === "banner"} onChange={() => setFormType("banner")} className="accent-ink" />
                    <span>Banner (homepage popup)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="promoType" value="coupon" checked={formType === "coupon"} onChange={() => setFormType("coupon")} className="accent-ink" />
                    <span>Coupon code (checkout)</span>
                  </label>
                </div>
              </div>

              {/* Title */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-ink">Title</label>
                <input
                  required
                  type="text"
                  placeholder={formType === "banner" ? "e.g. Eid Special — 15% off all wool fabrics" : "e.g. Summer Sale"}
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full border border-stone rounded px-3 py-2 text-sm text-ink bg-white focus:border-ink focus:outline-none transition-colors"
                />
              </div>

              {/* Body (for banners) */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-ink">
                  Body text <span className="font-normal text-muted">(optional)</span>
                </label>
                <textarea
                  rows={2}
                  placeholder="Additional description shown in the popup..."
                  value={formBody}
                  onChange={(e) => setFormBody(e.target.value)}
                  className="w-full border border-stone rounded px-3 py-2 text-sm text-ink bg-white focus:border-ink focus:outline-none transition-colors resize-none"
                />
              </div>

              {/* Coupon-only fields */}
              {formType === "coupon" && (
                <>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-ink">Coupon Code</label>
                    <input
                      required
                      type="text"
                      placeholder="e.g. EID20"
                      value={formCode}
                      onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                      className="w-full border border-stone rounded px-3 py-2 text-sm text-ink bg-white font-mono focus:border-ink focus:outline-none transition-colors"
                    />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-ink">Discount Type</label>
                      <select
                        value={formDiscountType}
                        onChange={(e) => setFormDiscountType(e.target.value as "pct" | "fixed")}
                        className="w-full border border-stone rounded px-3 py-2 text-sm text-ink bg-white focus:border-ink focus:outline-none transition-colors cursor-pointer"
                      >
                        <option value="pct">% Off</option>
                        <option value="fixed">Fixed PKR Off</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-ink">
                        {formDiscountType === "pct" ? "Percentage (1–100)" : "Amount (PKR)"}
                      </label>
                      <input
                        required
                        type="number"
                        min="1"
                        max={formDiscountType === "pct" ? "100" : undefined}
                        placeholder={formDiscountType === "pct" ? "e.g. 15" : "e.g. 500"}
                        value={formDiscountValue}
                        onChange={(e) => setFormDiscountValue(e.target.value)}
                        className="w-full border border-stone rounded px-3 py-2 text-sm text-ink bg-white focus:border-ink focus:outline-none transition-colors"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-ink">
                      Minimum Order (PKR) <span className="font-normal text-muted">(optional)</span>
                    </label>
                    <input
                      type="number"
                      min="0"
                      placeholder="e.g. 5000"
                      value={formMinOrder}
                      onChange={(e) => setFormMinOrder(e.target.value)}
                      className="w-full border border-stone rounded px-3 py-2 text-sm text-ink bg-white focus:border-ink focus:outline-none transition-colors"
                    />
                  </div>
                </>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-ink">
                    Starts At <span className="font-normal text-muted">(optional)</span>
                  </label>
                  <input
                    type="datetime-local"
                    value={formStartsAt}
                    onChange={(e) => setFormStartsAt(e.target.value)}
                    className="w-full border border-stone rounded px-3 py-2 text-sm text-ink bg-white focus:border-ink focus:outline-none transition-colors"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-ink">
                    Ends At <span className="font-normal text-muted">(optional)</span>
                  </label>
                  <input
                    type="datetime-local"
                    value={formEndsAt}
                    onChange={(e) => setFormEndsAt(e.target.value)}
                    className="w-full border border-stone rounded px-3 py-2 text-sm text-ink bg-white focus:border-ink focus:outline-none transition-colors"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="formActive"
                  checked={formActive}
                  onChange={(e) => setFormActive(e.target.checked)}
                  className="accent-ink"
                />
                <label htmlFor="formActive" className="text-xs font-medium text-ink cursor-pointer">
                  Active immediately
                </label>
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => { setShowCreate(false); resetForm(); }}
                  disabled={isSubmitting}
                  className="px-4 py-2 text-xs font-medium text-ink bg-white border border-stone rounded-md hover:bg-stone-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 text-xs font-bold text-paper bg-ink hover:bg-stone-900 rounded-md transition-colors cursor-pointer"
                >
                  {isSubmitting ? "Creating…" : "Create Promotion"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Add Promotions to admin nav**

In `web/src/app/admin/layout.tsx`, add `{ href: "/admin/promotions", label: "Promotions" }` to the `NAV` array:

```tsx
const NAV = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/receipts", label: "Receipts" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/pricing", label: "Pricing" },
  { href: "/admin/stock", label: "Inventory" },
  { href: "/admin/promotions", label: "Promotions" },
];
```

- [ ] **Step 4: Add Promotions to AdminHeader map**

In `web/src/app/admin/AdminHeader.tsx`, add to `HEADER_MAP`:

```tsx
  "/admin/promotions": {
    title: "Promotions",
    desc: "Create and manage homepage popup banners and checkout coupon codes. Toggle promotions on/off and set expiry dates.",
  },
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd web && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add web/src/app/admin/promotions/page.tsx \
        web/src/app/admin/promotions/PromotionsDashboardClient.tsx \
        web/src/app/admin/layout.tsx \
        web/src/app/admin/AdminHeader.tsx
git commit -m "feat: add admin promotions management page with create/toggle/delete"
```

---

## Task 8: Homepage Promotion Popup

**Files:**
- Create: `web/src/components/PromotionPopup.tsx`
- Modify: `web/src/app/page.tsx`

- [ ] **Step 1: Create PromotionPopup component**

Create `web/src/components/PromotionPopup.tsx`:

```tsx
"use client";

import { useState, useEffect } from "react";

type BannerPromo = {
  id: string;
  title: string;
  body: string | null;
};

export function PromotionPopup({ banners }: { banners: BannerPromo[] }) {
  const [visible, setVisible] = useState(false);
  const [promo, setPromo] = useState<BannerPromo | null>(null);

  useEffect(() => {
    if (banners.length === 0) return;
    const first = banners[0];
    const dismissed = sessionStorage.getItem(`promo_dismissed_${first.id}`);
    if (!dismissed) {
      setPromo(first);
      setVisible(true);
    }
  }, [banners]);

  const dismiss = () => {
    if (promo) sessionStorage.setItem(`promo_dismissed_${promo.id}`, "1");
    setVisible(false);
  };

  if (!visible || !promo) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs"
      onClick={dismiss}
    >
      <div
        className="relative bg-white border border-stone rounded-xl shadow-xl max-w-md w-full p-8 animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={dismiss}
          className="absolute top-4 right-4 text-stone-400 hover:text-ink transition-colors cursor-pointer"
          aria-label="Dismiss"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <p className="eyebrow text-muted text-xs mb-3">Limited Offer</p>
        <h2 className="display text-2xl text-ink leading-tight">{promo.title}</h2>
        {promo.body && (
          <p className="mt-3 text-sm text-muted leading-relaxed">{promo.body}</p>
        )}

        <button
          onClick={dismiss}
          className="mt-6 btn btn-primary w-full"
        >
          Shop Now
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Fetch active banner promos in homepage and render popup**

In `web/src/app/page.tsx`, update the import and data fetch at the top:

```tsx
import Link from "next/link";
import Image from "next/image";
import { ProductCard } from "@/components/ProductCard";
import { getNewArrivalsAsync, getFeaturedAsync, getProducts } from "@/lib/products";
import { HeroSlideshow } from "@/components/HeroSlideshow";
import { PromotionPopup } from "@/components/PromotionPopup";
import { createSupabaseAdmin } from "@/lib/supabase/server";
```

Update the `HomePage` function to fetch banners and render the popup:

```tsx
export default async function HomePage() {
  const [newArrivals, featured, allProducts, bannersRes] = await Promise.all([
    getNewArrivalsAsync(),
    getFeaturedAsync(),
    getProducts(),
    createSupabaseAdmin()
      .from("promotions")
      .select("id, title, body")
      .eq("type", "banner")
      .eq("is_active", true)
      .or(`starts_at.is.null,starts_at.lte.${new Date().toISOString()}`)
      .or(`ends_at.is.null,ends_at.gte.${new Date().toISOString()}`)
      .order("created_at", { ascending: false })
      .limit(1),
  ]);

  const banners = (bannersRes.data ?? []) as Array<{ id: string; title: string; body: string | null }>;
  const fabricOfMonth = featured[0];

  return (
    <>
      <PromotionPopup banners={banners} />

      <section className="relative h-[88dvh] w-full overflow-hidden">
        <HeroSlideshow />
      </section>
      {/* ... rest of existing JSX unchanged ... */}
```

The existing JSX after `<HeroSlideshow />` stays unchanged — only add `<PromotionPopup banners={banners} />` at the very top of the return's fragment, and update the imports + the `Promise.all` data fetch.

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd web && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add web/src/components/PromotionPopup.tsx web/src/app/page.tsx
git commit -m "feat: add dismissible promotion popup on homepage for active banner promotions"
```

---

## Task 9: Checkout Coupon Code Input + placeOrder Promo Support

**Files:**
- Modify: `web/src/lib/validation.ts`
- Modify: `web/src/app/checkout/CheckoutFlow.tsx`
- Modify: `web/src/lib/actions/orders.ts`

- [ ] **Step 1: Add promoId to PlaceOrderSchema**

In `web/src/lib/validation.ts`, update `PlaceOrderSchema`:

```ts
export const PlaceOrderSchema = z.object({
  lines: z.array(CartLineSchema).min(1, "Cart is empty.").max(20),
  address: AddressSchema,
  paymentMethod: z.enum(["cod", "bank_transfer"]),
  otpVerified: z.boolean(),
  promoId: z.string().uuid().optional(),
});
```

- [ ] **Step 2: Add coupon state and UI to CheckoutFlow**

In `web/src/app/checkout/CheckoutFlow.tsx`:

Add these imports at the top of the file (after existing imports):

```tsx
import { validateCoupon } from "@/lib/actions/promotions";
```

Add these state declarations after the existing `const [placeError, setPlaceError] = useState...` line:

```tsx
  const [couponCode, setCouponCode] = useState("");
  const [couponApplied, setCouponApplied] = useState<{
    promoId: string;
    discountAmount: number;
    code: string;
  } | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [couponPending, startCouponTransition] = useTransition();
```

Add the `handleApplyCoupon` handler after the existing `handleVerifyOtp` function:

```tsx
  const handleApplyCoupon = () => {
    setCouponError(null);
    const subtotal = [...lines].reduce((sum, line) => {
      const product = productMap.get(line.productId);
      if (!product) return sum;
      return sum + lineSubtotal(line, product);
    }, 0);
    startCouponTransition(async () => {
      const res = await validateCoupon(couponCode.trim(), subtotal);
      if (res.ok) {
        setCouponApplied({ promoId: res.promoId, discountAmount: res.discountAmount, code: res.code });
      } else {
        setCouponError(res.error);
        setCouponApplied(null);
      }
    });
  };
```

In the step 2 section JSX (payment method), add the coupon block **after the address section's Continue to Payment button and before the payment method step 2 section** — specifically inside `{step === 2 && (` block, before the COD label:

```tsx
              {/* Promo code */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-ink">Promo Code <span className="font-normal text-muted">(optional)</span></p>
                {couponApplied ? (
                  <div className="flex items-center justify-between border border-green-300 bg-green-50 rounded px-4 py-3 text-sm">
                    <span className="text-green-700 font-medium">
                      ✓ {couponApplied.code} — PKR {couponApplied.discountAmount.toLocaleString()} off
                    </span>
                    <button
                      onClick={() => { setCouponApplied(null); setCouponCode(""); }}
                      className="text-xs text-muted underline cursor-pointer"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <input
                      className="input flex-1 uppercase"
                      placeholder="Enter code"
                      value={couponCode}
                      onChange={(e) => { setCouponCode(e.target.value.toUpperCase()); setCouponError(null); }}
                    />
                    <button
                      onClick={handleApplyCoupon}
                      disabled={couponPending || !couponCode.trim()}
                      className="btn btn-ghost text-sm disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {couponPending ? "…" : "Apply"}
                    </button>
                  </div>
                )}
                {couponError && <p className="text-xs text-accent">{couponError}</p>}
              </div>
```

In the order summary (step 3), find the subtotal display and add a discount line. Look for where `shipping` and `total` are displayed and add:

```tsx
              {couponApplied && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted">Promo ({couponApplied.code})</span>
                  <span className="text-green-600 font-medium">−{formatPKR(couponApplied.discountAmount)}</span>
                </div>
              )}
```

Also update the `placeOrder` call inside `startPlaceTransition` to pass `promoId`:

```tsx
      const res = await placeOrder({
        lines,
        address,
        paymentMethod: payment,
        otpVerified,
        promoId: couponApplied?.promoId,
      });
```

- [ ] **Step 3: Extend placeOrder to re-validate promo and adjust total**

In `web/src/lib/actions/orders.ts`, update the `PlaceOrderInput` type:

```ts
export type PlaceOrderInput = {
  lines: CartLine[];
  address: Address;
  paymentMethod: PaymentMethod;
  otpVerified: boolean;
  promoId?: string;
};
```

In `placeOrder`, after the `const subtotal = ...` and `const shipping = ...` lines, add the promo re-validation block:

```ts
  const subtotal = items.reduce((sum, it) => sum + it.line_total, 0);
  const shipping = subtotal >= 10_000 ? 0 : 350;

  // Re-validate promo server-side (never trust client discount amount)
  let discountAmount = 0;
  let validatedPromoId: string | null = null;
  if (validInput.promoId) {
    const adminForPromo = createSupabaseAdmin();
    const { data: promo } = await adminForPromo
      .from("promotions")
      .select("id, discount_type, discount_value, min_order_amount, is_active, starts_at, ends_at")
      .eq("id", validInput.promoId)
      .eq("type", "coupon")
      .eq("is_active", true)
      .maybeSingle();
    if (promo) {
      const now = new Date();
      const validDates =
        (!promo.starts_at || new Date(promo.starts_at) <= now) &&
        (!promo.ends_at || new Date(promo.ends_at) >= now);
      const validMin = subtotal >= Number(promo.min_order_amount ?? 0);
      if (validDates && validMin) {
        discountAmount =
          promo.discount_type === "pct"
            ? Math.floor(subtotal * (Number(promo.discount_value) / 100))
            : Math.min(Number(promo.discount_value), subtotal);
        validatedPromoId = promo.id;
      }
    }
  }

  const total = subtotal + shipping - discountAmount;
```

Update the `orders` insert to include the new columns:

```ts
  const { error: orderErr } = await supabase.from("orders").insert({
    id: orderId,
    user_id: userData.user.id,
    status: validInput.paymentMethod === "cod" ? "confirmed" : "unconfirmed",
    payment_method: validInput.paymentMethod,
    payment_status:
      validInput.paymentMethod === "bank_transfer" ? "awaiting_receipt" : "pending",
    subtotal,
    shipping,
    discount_amount: discountAmount,
    promo_id: validatedPromoId,
    total,
    shipping_address: validInput.address,
    otp_verified: validInput.otpVerified,
  });
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd web && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/validation.ts \
        web/src/app/checkout/CheckoutFlow.tsx \
        web/src/lib/actions/orders.ts
git commit -m "feat: add coupon code input at checkout with server-side re-validation"
```

---

## Task 10: Order Confirmation Email

**Files:**
- Create: `web/src/lib/email.ts`
- Create: `web/src/lib/email-templates/order-confirmation.ts`
- Create: `web/src/lib/actions/email-actions.ts`
- Modify: `web/src/lib/actions/orders.ts`

- [ ] **Step 1: Create nodemailer transport helper**

Create `web/src/lib/email.ts`:

```ts
import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST!,
  port: Number(process.env.SMTP_PORT ?? 465),
  secure: Number(process.env.SMTP_PORT ?? 465) === 465,
  auth: {
    user: process.env.SMTP_USER!,
    pass: process.env.SMTP_PASS!,
  },
});

export async function sendEmail({
  to,
  subject,
  html,
  text,
}: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}): Promise<void> {
  await transporter.sendMail({
    from: `"Berke Pak" <${process.env.SMTP_USER}>`,
    to,
    subject,
    html,
    text: text ?? html.replace(/<[^>]+>/g, ""),
  });
}
```

- [ ] **Step 2: Create order confirmation email template**

Create `web/src/lib/email-templates/order-confirmation.ts`:

```ts
type OrderItem = {
  product_name: string;
  color: string;
  unit: string;
  quantity: number;
  unit_price: number;
  stitching: string;
  stitching_addon: number;
  line_total: number;
};

type OrderData = {
  id: string;
  subtotal: number;
  shipping: number;
  discount_amount: number;
  total: number;
  payment_method: "cod" | "bank_transfer";
  created_at: string;
};

function pkr(amount: number): string {
  return new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency: "PKR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function buildOrderConfirmationEmail(order: OrderData, items: OrderItem[]): string {
  const itemRows = items
    .map(
      (it) => `
      <tr>
        <td style="padding: 10px 0; border-bottom: 1px solid #e5e5e0; font-size: 13px; color: #1a1a1a;">${it.product_name}</td>
        <td style="padding: 10px 0; border-bottom: 1px solid #e5e5e0; font-size: 13px; color: #6b6b63; text-align: center;">${it.color}</td>
        <td style="padding: 10px 0; border-bottom: 1px solid #e5e5e0; font-size: 13px; color: #6b6b63; text-align: center;">${it.quantity} ${it.unit}${it.quantity > 1 ? "s" : ""}${it.stitching === "bespoke" ? " + Bespoke" : ""}</td>
        <td style="padding: 10px 0; border-bottom: 1px solid #e5e5e0; font-size: 13px; color: #1a1a1a; text-align: right;">${pkr(it.line_total)}</td>
      </tr>`,
    )
    .join("");

  const discountRow =
    order.discount_amount > 0
      ? `<tr>
          <td colspan="3" style="padding: 8px 0; font-size: 13px; color: #6b6b63;">Promo Discount</td>
          <td style="padding: 8px 0; font-size: 13px; color: #16a34a; text-align: right;">−${pkr(order.discount_amount)}</td>
        </tr>`
      : "";

  const shippingRow =
    order.shipping === 0
      ? `<tr>
          <td colspan="3" style="padding: 8px 0; font-size: 13px; color: #6b6b63;">Shipping</td>
          <td style="padding: 8px 0; font-size: 13px; color: #16a34a; text-align: right;">Free</td>
        </tr>`
      : `<tr>
          <td colspan="3" style="padding: 8px 0; font-size: 13px; color: #6b6b63;">Shipping</td>
          <td style="padding: 8px 0; font-size: 13px; color: #1a1a1a; text-align: right;">${pkr(order.shipping)}</td>
        </tr>`;

  const bankSection =
    order.payment_method === "bank_transfer"
      ? `
      <div style="margin-top: 32px; padding: 24px; border: 1px solid #e5e5e0; border-radius: 8px; background: #f9f9f7;">
        <p style="margin: 0 0 16px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: #9b9b8a; font-weight: 600;">Bank Transfer Details</p>
        <table style="width: 100%; font-size: 13px; border-collapse: collapse;">
          <tr><td style="padding: 4px 0; color: #6b6b63; width: 140px;">Bank</td><td style="padding: 4px 0; color: #1a1a1a;">Meezan Bank</td></tr>
          <tr><td style="padding: 4px 0; color: #6b6b63;">Account Title</td><td style="padding: 4px 0; color: #1a1a1a;">Berke Pak Fabrics (Pvt) Ltd</td></tr>
          <tr><td style="padding: 4px 0; color: #6b6b63;">IBAN</td><td style="padding: 4px 0; color: #1a1a1a; font-family: monospace;">PK00MEZN0000000000000000</td></tr>
          <tr><td style="padding: 4px 0; color: #6b6b63;">Raast ID</td><td style="padding: 4px 0; color: #1a1a1a; font-family: monospace;">03000000000</td></tr>
        </table>
        <p style="margin: 16px 0 0; font-size: 12px; color: #6b6b63; line-height: 1.6;">
          Please transfer <strong style="color: #1a1a1a;">${pkr(order.total)}</strong> using the details above, then upload your receipt screenshot from your account dashboard or via WhatsApp.
        </p>
      </div>`
      : `<p style="margin-top: 24px; font-size: 13px; color: #6b6b63; line-height: 1.6;">
          You'll receive an SMS with tracking details once your order ships. No payment needed — our rider will collect on delivery.
        </p>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Order Confirmed — ${order.id}</title>
</head>
<body style="margin: 0; padding: 0; background: #f9f9f7; font-family: Georgia, 'Times New Roman', serif; color: #1a1a1a;">
  <div style="max-width: 600px; margin: 40px auto; background: #ffffff; border: 1px solid #e5e5e0; border-radius: 8px; overflow: hidden;">

    <!-- Header -->
    <div style="background: #1a1a1a; padding: 28px 40px;">
      <p style="margin: 0; font-family: sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 0.15em; text-transform: uppercase; color: #9b9b8a;">Berke Pak Fabrics</p>
    </div>

    <!-- Body -->
    <div style="padding: 40px;">
      <p style="margin: 0 0 4px; font-family: sans-serif; font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: #9b9b8a; font-weight: 600;">Order Confirmed</p>
      <h1 style="margin: 4px 0 0; font-size: 28px; font-weight: normal; color: #1a1a1a;">${order.id}</h1>
      <p style="margin: 8px 0 0; font-size: 13px; color: #6b6b63;">${new Date(order.created_at).toLocaleDateString("en-PK", { year: "numeric", month: "long", day: "numeric" })}</p>

      <!-- Items -->
      <table style="width: 100%; border-collapse: collapse; margin-top: 32px;">
        <thead>
          <tr style="border-bottom: 1px solid #1a1a1a;">
            <th style="padding-bottom: 8px; font-family: sans-serif; font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; color: #9b9b8a; text-align: left; font-weight: 600;">Product</th>
            <th style="padding-bottom: 8px; font-family: sans-serif; font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; color: #9b9b8a; text-align: center; font-weight: 600;">Colour</th>
            <th style="padding-bottom: 8px; font-family: sans-serif; font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; color: #9b9b8a; text-align: center; font-weight: 600;">Qty</th>
            <th style="padding-bottom: 8px; font-family: sans-serif; font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; color: #9b9b8a; text-align: right; font-weight: 600;">Price</th>
          </tr>
        </thead>
        <tbody>${itemRows}</tbody>
      </table>

      <!-- Totals -->
      <table style="width: 100%; border-collapse: collapse; margin-top: 16px;">
        <tr>
          <td colspan="3" style="padding: 8px 0; font-size: 13px; color: #6b6b63;">Subtotal</td>
          <td style="padding: 8px 0; font-size: 13px; color: #1a1a1a; text-align: right;">${pkr(order.subtotal)}</td>
        </tr>
        ${shippingRow}
        ${discountRow}
        <tr style="border-top: 1px solid #1a1a1a;">
          <td colspan="3" style="padding: 12px 0 0; font-size: 15px; font-weight: bold; color: #1a1a1a;">Total</td>
          <td style="padding: 12px 0 0; font-size: 15px; font-weight: bold; color: #1a1a1a; text-align: right;">${pkr(order.total)}</td>
        </tr>
      </table>

      <!-- Payment method -->
      <p style="margin: 24px 0 0; font-size: 13px; color: #6b6b63;">
        Payment: <strong style="color: #1a1a1a;">${order.payment_method === "cod" ? "Cash on Delivery" : "Bank Transfer (Raast / IBAN)"}</strong>
      </p>

      ${bankSection}
    </div>

    <!-- Footer -->
    <div style="padding: 24px 40px; background: #f9f9f7; border-top: 1px solid #e5e5e0;">
      <p style="margin: 0; font-family: sans-serif; font-size: 11px; color: #9b9b8a; line-height: 1.6; text-align: center;">
        Questions? Email us at <a href="mailto:info@berkepakfabrics.com" style="color: #1a1a1a;">info@berkepakfabrics.com</a><br>
        Berke Pak Fabrics — Lahore, Pakistan
      </p>
    </div>

  </div>
</body>
</html>`;
}
```

- [ ] **Step 3: Create the email server action**

Create `web/src/lib/actions/email-actions.ts`:

```ts
"use server";

import { createSupabaseAdmin } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email";
import { buildOrderConfirmationEmail } from "@/lib/email-templates/order-confirmation";

export async function sendOrderConfirmationEmail(
  orderId: string,
  userEmail: string,
): Promise<void> {
  const admin = createSupabaseAdmin();

  const { data: order, error: orderErr } = await admin
    .from("orders")
    .select("id, subtotal, shipping, discount_amount, total, payment_method, created_at")
    .eq("id", orderId)
    .single();

  if (orderErr || !order) {
    console.error(`sendOrderConfirmationEmail: order ${orderId} not found`, orderErr?.message);
    return;
  }

  const { data: rawItems, error: itemsErr } = await admin
    .from("order_items")
    .select("product_name, color, unit, quantity, unit_price, stitching, stitching_addon, line_total")
    .eq("order_id", orderId);

  if (itemsErr || !rawItems) {
    console.error(`sendOrderConfirmationEmail: items fetch failed for ${orderId}`, itemsErr?.message);
    return;
  }

  const html = buildOrderConfirmationEmail(
    order as Parameters<typeof buildOrderConfirmationEmail>[0],
    rawItems as Parameters<typeof buildOrderConfirmationEmail>[1],
  );

  await sendEmail({
    to: userEmail,
    subject: `Order Confirmed — ${orderId} | Berke Pak`,
    html,
  });
}
```

- [ ] **Step 4: Call email sender after successful order in placeOrder**

In `web/src/lib/actions/orders.ts`, add the import at the top:

```ts
import { sendOrderConfirmationEmail } from "@/lib/actions/email-actions";
```

At the end of the `placeOrder` function, after the stock decrement loop and before `revalidatePath`:

```ts
  revalidatePath("/account/orders");

  // Non-fatal: send confirmation email (order is already committed)
  if (userData.user.email) {
    sendOrderConfirmationEmail(orderId, userData.user.email).catch((err) =>
      console.error("Order confirmation email failed:", err),
    );
  }

  return { ok: true, orderId };
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd web && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add web/src/lib/email.ts \
        web/src/lib/email-templates/order-confirmation.ts \
        web/src/lib/actions/email-actions.ts \
        web/src/lib/actions/orders.ts
git commit -m "feat: send order confirmation email with items, totals, and bank transfer details"
```

---

## Task 11: Final Verification + Push Branch

**Files:** none (verification + git)

- [ ] **Step 1: Run full TypeScript check**

```bash
cd web && npx tsc --noEmit 2>&1
```

Expected: zero errors

- [ ] **Step 2: Start dev server and smoke test each feature**

```bash
cd web && npm run dev
```

Verify in browser (`http://localhost:3000`):

1. **Apple auth:** Visit `/login` or `/signup` — only Google button visible, no Apple button.
2. **Card payment:** Go to `/checkout` with items in cart — "Pay with Card / Coming Soon" option visible but dimmed and unselectable.
3. **Admin fabric creation:** Go to `/admin/stock`, click "+ Add Fabric" — image upload field, Weave Type, and Thread Count fields visible.
4. **Promotions admin:** Go to `/admin/promotions` — page loads, create a banner promotion.
5. **Homepage popup:** Visit `/` — popup appears for the newly created banner. Dismiss it. Refresh — popup does not reappear (sessionStorage check).
6. **Coupon code:** Create a coupon in admin. Go to checkout step 2 — promo code input visible. Enter the coupon code — discount applies. Order total reflects discount.
7. **Order email:** Place a test order (COD) — check `info@berkepakfabrics.com` sent/inbox for the confirmation email.

- [ ] **Step 3: Push branch**

```bash
git push -u origin mvp-finalization
```

---

## Spec Coverage Check

| Spec requirement | Task |
|---|---|
| Comment out Apple auth | Task 2 |
| Card payment disabled boilerplate | Task 3 |
| Fabric image upload in admin | Task 4 |
| Weave Type + Thread Count optional fields | Task 4 |
| Promotions DB table | Task 5 |
| Promotions admin page | Task 7 |
| Homepage banner popup | Task 8 |
| Coupon code at checkout + bill adjustment | Task 9 |
| placeOrder re-validates promo server-side | Task 9 |
| Order confirmation email | Task 10 |
| Email: items + totals + payment method | Task 10 |
| Email: bank transfer instructions | Task 10 |
