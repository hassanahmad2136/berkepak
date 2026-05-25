# Admin Add Colors Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add UI in the admin stock dashboard to add and remove color variants per product, backed by new `addProductColor` and `removeProductColor` server actions.

**Architecture:** Two new server actions in `web/src/lib/actions/admin.ts` insert/delete rows in `product_colors`. `StockDashboardClient.tsx` gains inline "Add Color" form and per-color "Remove" button. `adminCreateProduct` is fixed to actually seed White/Black colors as the existing UI note claims.

**Tech Stack:** Next.js server actions ("use server"), Supabase admin client, React state, TypeScript

---

## File Map

| File | Change |
|------|--------|
| `web/src/lib/actions/admin.ts` | Add `addProductColor`, `removeProductColor`; fix `adminCreateProduct` to seed colors |
| `web/src/app/admin/stock/StockDashboardClient.tsx` | Import new actions; add Add Color modal + Remove button per color |

---

### Task 1: Create feature branch

**Files:**
- None (git only)

- [ ] **Step 1: Create and checkout branch**

```bash
cd /Users/abdullah/code/BerkePak
git checkout -b fix/admin-add-colors
```

Expected: `Switched to a new branch 'fix/admin-add-colors'`

---

### Task 2: Add `addProductColor` server action

**Files:**
- Modify: `web/src/lib/actions/admin.ts` (after `adminDeleteProduct` at line 411, before the `// Internal helpers` comment)

- [ ] **Step 1: Add the action**

Insert the following block into `web/src/lib/actions/admin.ts` between `adminDeleteProduct` and the `// Internal helpers` section:

```typescript
export async function addProductColor(
  catalogId: string,
  colorName: string,
  initialStock: number,
): Promise<AdminResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const normalized = colorName.trim();
  if (!normalized) return { ok: false, error: "Color name is required." };
  if (initialStock < 0) return { ok: false, error: "Stock cannot be negative." };

  const admin = createSupabaseAdmin();

  // Check duplicate
  const { data: existing } = await admin
    .from("product_colors")
    .select("id")
    .eq("catalog_id", catalogId)
    .eq("color_name", normalized)
    .maybeSingle();

  if (existing) return { ok: false, error: `Color "${normalized}" already exists for this product.` };

  const { error } = await admin.from("product_colors").insert({
    catalog_id: catalogId,
    color_name: normalized,
    stock: initialStock,
    image_url: null,
  });

  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/stock");
  revalidatePath("/shop");

  await notifyAdminsOfChange(
    "Add Product Color",
    `Catalog ID: ${catalogId}\nColor: ${normalized}\nInitial Stock: ${initialStock}`,
  );

  return { ok: true };
}

export async function removeProductColor(colorId: string): Promise<AdminResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const admin = createSupabaseAdmin();
  const { error } = await admin.from("product_colors").delete().eq("id", colorId);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/stock");
  revalidatePath("/shop");

  await notifyAdminsOfChange("Remove Product Color", `Color ID: ${colorId} deleted.`);

  return { ok: true };
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/abdullah/code/BerkePak/web && npx tsc --noEmit 2>&1 | head -20
```

Expected: No output (zero errors).

- [ ] **Step 3: Commit**

```bash
git add web/src/lib/actions/admin.ts
git commit -m "feat: add addProductColor and removeProductColor server actions"
```

---

### Task 3: Fix `adminCreateProduct` to seed White and Black colors

**Files:**
- Modify: `web/src/lib/actions/admin.ts` — `adminCreateProduct` function (currently lines 343–386)

- [ ] **Step 1: Update `adminCreateProduct` to seed default colors after insert**

Replace the block after `const { data, error } = await admin.from("product_catalog").insert(...)...single();` — currently:

```typescript
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/stock");
```

With:

```typescript
  if (error) return { ok: false, error: error.message };

  // Seed default White and Black color variants
  await admin.from("product_colors").insert([
    { catalog_id: data.id, color_name: "White", stock: 10, image_url: null },
    { catalog_id: data.id, color_name: "Black", stock: 10, image_url: null },
  ]);

  revalidatePath("/admin/stock");
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/abdullah/code/BerkePak/web && npx tsc --noEmit 2>&1 | head -20
```

Expected: No output.

- [ ] **Step 3: Commit**

```bash
git add web/src/lib/actions/admin.ts
git commit -m "fix: adminCreateProduct now seeds White and Black color variants on creation"
```

---

### Task 4: Update StockDashboardClient to add/remove colors

**Files:**
- Modify: `web/src/app/admin/stock/StockDashboardClient.tsx`

The goal:
- Import `addProductColor`, `removeProductColor` from `@/lib/actions/admin`
- Add per-product "Add Color" button that opens an inline form (color name + initial stock)
- Add "Remove" (trash icon) button on each color card
- Replace the misleading "Add colors in Pricing panel first" empty state with the Add Color button

- [ ] **Step 1: Update imports at top of file**

Replace:
```typescript
import { 
  updateProductColorStock, 
  toggleProductVisibility, 
  adminCreateProduct, 
  adminDeleteProduct 
} from "@/lib/actions/admin";
```

With:
```typescript
import { 
  updateProductColorStock, 
  toggleProductVisibility, 
  adminCreateProduct, 
  adminDeleteProduct,
  addProductColor,
  removeProductColor,
} from "@/lib/actions/admin";
```

- [ ] **Step 2: Add add-color and remove-color state variables**

After the existing state declarations (after line `const [addError, setAddError] = useState<string | null>(null);`), add:

```typescript
  // Add color states
  const [showAddColorModal, setShowAddColorModal] = useState<string | null>(null); // stores catalogId
  const [addColorName, setAddColorName] = useState("");
  const [addColorStock, setAddColorStock] = useState("10");
  const [isSubmittingColor, setIsSubmittingColor] = useState(false);
  const [addColorError, setAddColorError] = useState<string | null>(null);

  // Remove color states
  const [removingColorId, setRemovingColorId] = useState<string | null>(null);
```

- [ ] **Step 3: Add `handleAddColor` and `handleRemoveColor` handler functions**

After `handleCreateProductSubmit`, before the `return (` JSX, add:

```typescript
  const handleAddColor = async (catalogId: string) => {
    const name = addColorName.trim();
    const stock = parseInt(addColorStock);
    if (!name) { setAddColorError("Color name is required."); return; }
    if (isNaN(stock) || stock < 0) { setAddColorError("Stock must be 0 or greater."); return; }

    setIsSubmittingColor(true);
    setAddColorError(null);

    try {
      const res = await addProductColor(catalogId, name, stock);
      if (res.ok) {
        // Optimistically add to local colors list with a temporary id
        setColors((prev) => [
          ...prev,
          { id: `temp-${Date.now()}`, catalog_id: catalogId, color_name: name, image_url: null, stock },
        ]);
        setAddColorName("");
        setAddColorStock("10");
        setShowAddColorModal(null);
        window.location.reload(); // get real id from server
      } else {
        setAddColorError((res as any).error || "Failed to add color.");
      }
    } catch (err: any) {
      setAddColorError(err.message || "Unexpected error.");
    } finally {
      setIsSubmittingColor(false);
    }
  };

  const handleRemoveColor = async (colorId: string, catalogId: string) => {
    if (!confirm("Remove this color variant? This cannot be undone.")) return;
    setRemovingColorId(colorId);
    try {
      const res = await removeProductColor(colorId);
      if (res.ok) {
        setColors((prev) => prev.filter((c) => c.id !== colorId));
      } else {
        alert((res as any).error || "Failed to remove color.");
      }
    } catch (err: any) {
      alert(err.message || "Unexpected error.");
    } finally {
      setRemovingColorId(null);
    }
  };
```

- [ ] **Step 4: Update the product header row to include "Add Color" button**

In the product card header (the `<div className="flex items-center gap-4 sm:self-center shrink-0 ...">` section), after the `{/* Colors Count badge */}` block and before the `{/* Delete button */}` block, add:

```tsx
                    {/* Add Color button */}
                    <button
                      onClick={() => {
                        setShowAddColorModal(p.id);
                        setAddColorName("");
                        setAddColorStock("10");
                        setAddColorError(null);
                      }}
                      className="p-1.5 text-stone-400 hover:text-emerald-700 rounded-md hover:bg-stone-100 transition-colors cursor-pointer active:scale-95"
                      title="Add Color Variant"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    </button>
```

- [ ] **Step 5: Replace empty-state message and add Remove button to color cards**

Replace the entire no-colors empty state paragraph:
```tsx
                    <p className="text-xs text-muted py-2 flex items-center gap-1.5">
                      <svg className="w-4 h-4 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>
                        No colors configured. Add colors in{" "}
                        <Link href="/admin/pricing" className="underline font-semibold hover:text-ink transition-colors">
                          Pricing panel
                        </Link>{" "}
                        first.
                      </span>
                    </p>
```

With:
```tsx
                    <div className="py-4 text-center">
                      <p className="text-xs text-muted mb-3">No color variants yet.</p>
                      <button
                        onClick={() => {
                          setShowAddColorModal(p.id);
                          setAddColorName("");
                          setAddColorStock("10");
                          setAddColorError(null);
                        }}
                        className="px-4 py-2 bg-ink hover:bg-stone-900 text-paper rounded-md text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 mx-auto"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                        </svg>
                        Add First Color
                      </button>
                    </div>
```

Then inside each color card, add a remove button. After the color name/stock badge row `<div className="flex items-center justify-between gap-1">`, inside the `<div className="flex-1 min-w-0">` — add a remove button at bottom of the color card after the error/success messages. Add after the `{isError && ...}` block:

```tsx
                                <button
                                  type="button"
                                  onClick={() => handleRemoveColor(c.id, c.catalog_id)}
                                  disabled={removingColorId === c.id}
                                  className="mt-2 text-[10px] text-stone-400 hover:text-red-600 transition-colors cursor-pointer disabled:opacity-50"
                                  title="Remove this color"
                                >
                                  {removingColorId === c.id ? "Removing..." : "Remove color"}
                                </button>
```

- [ ] **Step 6: Add the Add Color modal at end of JSX (before closing `</div>`)**

Before the final closing `</div>` of the return statement (after the Create Fabric Modal block), add:

```tsx
      {/* Add Color Modal */}
      {showAddColorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs">
          <div className="bg-white border border-stone rounded-xl shadow-lg max-w-sm w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-stone flex justify-between items-center bg-stone-50/50">
              <h4 className="font-semibold text-ink text-base">Add Color Variant</h4>
              <button
                onClick={() => setShowAddColorModal(null)}
                className="text-stone-400 hover:text-ink transition-colors cursor-pointer"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-4">
              {addColorError && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-4 py-3 rounded-lg font-medium">
                  ⚠️ {addColorError}
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs font-semibold text-ink">Color Name</label>
                <input
                  type="text"
                  placeholder="e.g. Navy Blue"
                  value={addColorName}
                  onChange={(e) => setAddColorName(e.target.value)}
                  className="w-full border border-stone rounded px-3 py-2 text-sm text-ink bg-white focus:border-ink focus:outline-none transition-colors"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-ink">Initial Stock</label>
                <input
                  type="number"
                  min="0"
                  placeholder="10"
                  value={addColorStock}
                  onChange={(e) => setAddColorStock(e.target.value)}
                  className="w-full border border-stone rounded px-3 py-2 text-sm text-ink bg-white focus:border-ink focus:outline-none transition-colors"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddColorModal(null)}
                  disabled={isSubmittingColor}
                  className="px-4 py-2 text-xs font-medium text-ink bg-white border border-stone rounded-md hover:bg-stone-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleAddColor(showAddColorModal)}
                  disabled={isSubmittingColor}
                  className="px-4 py-2 text-xs font-bold text-paper bg-ink hover:bg-stone-900 rounded-md transition-colors cursor-pointer flex items-center gap-1.5 active:scale-95"
                >
                  {isSubmittingColor ? "Adding..." : "Add Color"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
```

- [ ] **Step 7: Verify TypeScript compiles**

```bash
cd /Users/abdullah/code/BerkePak/web && npx tsc --noEmit 2>&1 | head -30
```

Expected: No output.

- [ ] **Step 8: Commit**

```bash
git add web/src/app/admin/stock/StockDashboardClient.tsx
git commit -m "feat: add Add Color and Remove Color UI to stock dashboard"
```

---

### Task 5: Remove unused Link import from StockDashboardClient

**Files:**
- Modify: `web/src/app/admin/stock/StockDashboardClient.tsx`

After Task 4 removes the only usage of `<Link>` in the empty-state, the import becomes unused.

- [ ] **Step 1: Check if Link is still used**

```bash
grep -n "Link" /Users/abdullah/code/BerkePak/web/src/app/admin/stock/StockDashboardClient.tsx
```

If only the import line appears (no `<Link` JSX usage), remove the import line:
```typescript
import Link from "next/link";
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd /Users/abdullah/code/BerkePak/web && npx tsc --noEmit 2>&1 | head -20
```

Expected: No output.

- [ ] **Step 3: Commit**

```bash
git add web/src/app/admin/stock/StockDashboardClient.tsx
git commit -m "chore: remove unused Link import from StockDashboardClient"
```

---

### Task 6: Manual verification in browser

**Files:** None (verification only)

- [ ] **Step 1: Start dev server**

```bash
cd /Users/abdullah/code/BerkePak/web && npm run dev
```

- [ ] **Step 2: Navigate to admin stock dashboard**

Open: `http://localhost:3000/admin/stock`

- [ ] **Step 3: Verify these behaviors**

1. Each product card header shows a `+` (add color) button next to the color count badge
2. Products with no colors show "No color variants yet." + "Add First Color" button (not the old Pricing panel link)
3. Clicking the `+` or "Add First Color" opens the Add Color modal
4. Submit with a valid name and stock → color appears in the grid
5. Each color card shows a "Remove color" text button at the bottom
6. Clicking "Remove color" → confirm dialog → color disappears from grid
7. Creating a new product → after creation, it auto-has White and Black at stock 10

- [ ] **Step 4: Stop dev server** (Ctrl+C)

---

### Task 7: Push branch and open PR

- [ ] **Step 1: Push branch**

```bash
git push -u origin fix/admin-add-colors
```

- [ ] **Step 2: Open PR**

```bash
gh pr create --title "fix: add missing Add/Remove Color UI to admin stock dashboard" --body "$(cat <<'EOF'
## Summary
- Adds `addProductColor` and `removeProductColor` server actions to `admin.ts`
- Fixes `adminCreateProduct` to actually seed White/Black color variants (was documented in UI but not implemented)
- Replaces misleading "Add colors in Pricing panel" empty-state with inline Add Color form
- Adds Remove button to each color card in the stock dashboard

## Test plan
- [ ] Navigate to `/admin/stock`
- [ ] Verify + button appears in each product header
- [ ] Add a color via the modal, verify it appears
- [ ] Remove a color, verify it disappears
- [ ] Create a new product, verify White and Black are auto-created
- [ ] `npx tsc --noEmit` passes with zero errors

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```
