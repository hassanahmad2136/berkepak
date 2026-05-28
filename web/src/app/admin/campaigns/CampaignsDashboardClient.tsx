"use client";

import React, { useState, useMemo } from "react";
import {
  createCampaign,
  updateCampaign,
  toggleCampaign,
  deleteCampaign,
  type CreateCampaignInput,
} from "@/lib/actions/campaigns";
import type { CampaignRecord, ProductPickerItem } from "./page";

const CATEGORIES = ["cotton", "linen", "wool", "silk", "blended"] as const;
type Category = (typeof CATEGORIES)[number];

interface Props {
  campaigns: CampaignRecord[];
  products: ProductPickerItem[];
  fetchError: string | null;
}

type FormState = {
  name: string;
  discountType: "pct" | "fixed";
  discountValue: string;
  scope: "all" | "categories" | "products";
  categoryTargets: Category[];
  productTargets: string[];
  priority: string;
  isActive: boolean;
  startsAt: string;
  endsAt: string;
};

const DEFAULT_FORM: FormState = {
  name: "",
  discountType: "pct",
  discountValue: "",
  scope: "all",
  categoryTargets: [],
  productTargets: [],
  priority: "0",
  isActive: true,
  startsAt: "",
  endsAt: "",
};

function campaignToForm(c: CampaignRecord): FormState {
  return {
    name: c.name,
    discountType: c.discount_type,
    discountValue: String(c.discount_value),
    scope: c.scope,
    categoryTargets: (c.category_targets ?? []) as Category[],
    productTargets: c.product_targets ?? [],
    priority: String(c.priority),
    isActive: c.is_active,
    startsAt: c.starts_at ? c.starts_at.slice(0, 16) : "",
    endsAt: c.ends_at ? c.ends_at.slice(0, 16) : "",
  };
}

function formatDate(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("en-PK", { month: "short", day: "numeric", year: "numeric" });
}

function scopeLabel(c: CampaignRecord, products: ProductPickerItem[]) {
  if (c.scope === "all") return "All Products";
  if (c.scope === "categories") {
    const cats = (c.category_targets ?? []).map((s) => s.charAt(0).toUpperCase() + s.slice(1));
    return cats.length ? cats.join(", ") : "No categories";
  }
  const count = (c.product_targets ?? []).length;
  return `${count} product${count !== 1 ? "s" : ""}`;
}

function campaignStatus(c: CampaignRecord): "active" | "scheduled" | "expired" | "inactive" {
  if (!c.is_active) return "inactive";
  const now = new Date();
  if (c.starts_at && new Date(c.starts_at) > now) return "scheduled";
  if (c.ends_at && new Date(c.ends_at) < now) return "expired";
  return "active";
}

const STATUS_STYLES = {
  active: "bg-emerald-50 text-emerald-700 border-emerald-200",
  scheduled: "bg-blue-50 text-blue-700 border-blue-200",
  expired: "bg-stone-50 text-stone-500 border-stone-200",
  inactive: "bg-stone-50 text-stone-400 border-stone-200",
};

export function CampaignsDashboardClient({ campaigns: initial, products, fetchError }: Props) {
  const [campaigns, setCampaigns] = useState<CampaignRecord[]>(initial);
  const [modalMode, setModalMode] = useState<"create" | "edit" | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [productSearch, setProductSearch] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const filteredProducts = useMemo(
    () =>
      products.filter(
        (p) =>
          !productSearch ||
          p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
          p.category.toLowerCase().includes(productSearch.toLowerCase()),
      ),
    [products, productSearch],
  );

  const openCreate = () => {
    setForm(DEFAULT_FORM);
    setProductSearch("");
    setFormError(null);
    setEditingId(null);
    setModalMode("create");
  };

  const openEdit = (c: CampaignRecord) => {
    setForm(campaignToForm(c));
    setProductSearch("");
    setFormError(null);
    setEditingId(c.id);
    setModalMode("edit");
  };

  const closeModal = () => {
    setModalMode(null);
    setEditingId(null);
    setFormError(null);
  };

  const setField = <K extends keyof FormState>(key: K, val: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: val }));

  const toggleCategory = (cat: Category) =>
    setField(
      "categoryTargets",
      form.categoryTargets.includes(cat)
        ? form.categoryTargets.filter((c) => c !== cat)
        : [...form.categoryTargets, cat],
    );

  const toggleProduct = (id: string) =>
    setField(
      "productTargets",
      form.productTargets.includes(id)
        ? form.productTargets.filter((p) => p !== id)
        : [...form.productTargets, id],
    );

  const buildInput = (): CreateCampaignInput => ({
    name: form.name,
    discountType: form.discountType,
    discountValue: parseFloat(form.discountValue) || 0,
    scope: form.scope,
    categoryTargets: form.scope === "categories" ? form.categoryTargets : [],
    productTargets: form.scope === "products" ? form.productTargets : [],
    priority: parseInt(form.priority, 10) || 0,
    isActive: form.isActive,
    startsAt: form.startsAt || undefined,
    endsAt: form.endsAt || undefined,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFormError(null);

    const input = buildInput();
    const res = modalMode === "edit" && editingId
      ? await updateCampaign(editingId, input)
      : await createCampaign(input);

    setIsSubmitting(false);
    if (!res.ok) { setFormError(res.error); return; }
    closeModal();
    window.location.reload();
  };

  const handleToggle = async (id: string, current: boolean) => {
    setTogglingId(id);
    await toggleCampaign(id, !current);
    setCampaigns((cs) => cs.map((c) => c.id === id ? { ...c, is_active: !current } : c));
    setTogglingId(null);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Permanently delete this campaign?")) return;
    setDeletingId(id);
    await deleteCampaign(id);
    setCampaigns((cs) => cs.filter((c) => c.id !== id));
    setDeletingId(null);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <p className="text-sm text-muted max-w-prose">
          Campaigns apply automatic price discounts across the storefront. Highest-priority campaign wins when multiple apply to the same product.
        </p>
        <button
          onClick={openCreate}
          className="shrink-0 px-4 py-2 text-xs font-bold text-paper bg-ink hover:bg-stone-900 rounded-md transition-colors cursor-pointer"
        >
          + New Campaign
        </button>
      </div>

      {fetchError && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-4 py-3 rounded-lg">
          Failed to load campaigns: {fetchError}
        </div>
      )}

      {/* Empty state */}
      {campaigns.length === 0 && !fetchError && (
        <div className="py-16 text-center border border-dashed border-stone rounded-xl">
          <p className="text-2xl mb-2">—</p>
          <p className="text-sm text-muted">No campaigns yet.</p>
          <p className="text-xs text-muted mt-1">Create one to start showing automatic discounts on products.</p>
        </div>
      )}

      {/* Campaign cards */}
      {campaigns.length > 0 && (
        <div className="grid gap-3">
          {campaigns.map((c) => {
            const status = campaignStatus(c);
            const startDate = formatDate(c.starts_at);
            const endDate = formatDate(c.ends_at);

            return (
              <div
                key={c.id}
                className="border border-stone rounded-xl bg-white overflow-hidden hover:border-stone-400 transition-colors"
              >
                <div className="flex items-stretch">
                  {/* Status accent bar */}
                  <div
                    className={`w-1 shrink-0 ${
                      status === "active"
                        ? "bg-emerald-400"
                        : status === "scheduled"
                        ? "bg-blue-400"
                        : "bg-stone-200"
                    }`}
                  />

                  <div className="flex-1 px-5 py-4 flex flex-wrap items-center gap-4">
                    {/* Main info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="font-semibold text-ink text-sm truncate">{c.name}</span>
                        <span
                          className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded border ${STATUS_STYLES[status]}`}
                        >
                          {status}
                        </span>
                        {c.priority > 0 && (
                          <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded border bg-amber-50 text-amber-700 border-amber-200">
                            P{c.priority}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted">
                        <span>{scopeLabel(c, products)}</span>
                        {(startDate || endDate) && (
                          <span>
                            {startDate ? `From ${startDate}` : ""}
                            {startDate && endDate ? " · " : ""}
                            {endDate ? `Until ${endDate}` : "No end date"}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Discount value */}
                    <div className="text-right shrink-0">
                      <p className="text-2xl font-bold text-ink leading-none">
                        {c.discount_type === "pct"
                          ? `${c.discount_value}%`
                          : `PKR ${Number(c.discount_value).toLocaleString()}`}
                      </p>
                      <p className="text-[10px] text-muted mt-0.5 uppercase tracking-wide">
                        {c.discount_type === "pct" ? "OFF" : "fixed off"}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-3 shrink-0">
                      <button
                        onClick={() => handleToggle(c.id, c.is_active)}
                        disabled={togglingId === c.id}
                        className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded border cursor-pointer transition-colors ${
                          c.is_active
                            ? "bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
                            : "bg-stone-50 text-muted border-stone hover:bg-stone-100"
                        }`}
                      >
                        {togglingId === c.id ? "…" : c.is_active ? "Active" : "Inactive"}
                      </button>
                      <button
                        onClick={() => openEdit(c)}
                        className="text-xs text-ink hover:underline cursor-pointer"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(c.id)}
                        disabled={deletingId === c.id}
                        className="text-xs text-red-600 hover:text-red-800 cursor-pointer transition-colors"
                      >
                        {deletingId === c.id ? "…" : "Delete"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Conflict note */}
      {campaigns.filter((c) => c.is_active).length > 1 && (
        <p className="text-xs text-muted border border-amber-200 bg-amber-50 px-4 py-2.5 rounded-lg">
          Multiple active campaigns: the one with the highest priority number applies per product. Equal priority — newest wins.
        </p>
      )}

      {/* Create / Edit Modal */}
      {modalMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white border border-stone rounded-xl shadow-lg max-w-2xl w-full my-8 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal header */}
            <div className="px-6 py-4 border-b border-stone flex justify-between items-center bg-stone-50/50">
              <h4 className="font-semibold text-ink text-base">
                {modalMode === "edit" ? "Edit Campaign" : "New Campaign"}
              </h4>
              <button
                onClick={closeModal}
                className="text-stone-400 hover:text-ink transition-colors cursor-pointer"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
              {formError && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-4 py-3 rounded-lg font-medium">
                  {formError}
                </div>
              )}

              {/* Section: Identity */}
              <fieldset className="space-y-4">
                <legend className="text-[10px] uppercase tracking-widest text-muted font-semibold">Campaign</legend>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-ink">Name</label>
                  <input
                    required
                    type="text"
                    placeholder="e.g. Eid Collection — 15% OFF"
                    value={form.name}
                    onChange={(e) => setField("name", e.target.value)}
                    className="w-full border border-stone rounded px-3 py-2 text-sm text-ink bg-white focus:border-ink focus:outline-none transition-colors"
                  />
                </div>
              </fieldset>

              {/* Section: Discount */}
              <fieldset className="space-y-4">
                <legend className="text-[10px] uppercase tracking-widest text-muted font-semibold">Discount</legend>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-ink">Type</label>
                    <select
                      value={form.discountType}
                      onChange={(e) => setField("discountType", e.target.value as "pct" | "fixed")}
                      className="w-full border border-stone rounded px-3 py-2 text-sm text-ink bg-white focus:border-ink focus:outline-none transition-colors cursor-pointer"
                    >
                      <option value="pct">% Percentage Off</option>
                      <option value="fixed">Fixed PKR Off</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-ink">
                      {form.discountType === "pct" ? "Percentage (1–100)" : "Amount (PKR)"}
                    </label>
                    <input
                      required
                      type="number"
                      min="1"
                      max={form.discountType === "pct" ? "100" : undefined}
                      step={form.discountType === "pct" ? "1" : "50"}
                      placeholder={form.discountType === "pct" ? "e.g. 15" : "e.g. 1000"}
                      value={form.discountValue}
                      onChange={(e) => setField("discountValue", e.target.value)}
                      className="w-full border border-stone rounded px-3 py-2 text-sm text-ink bg-white focus:border-ink focus:outline-none transition-colors"
                    />
                  </div>
                </div>
              </fieldset>

              {/* Section: Scope */}
              <fieldset className="space-y-4">
                <legend className="text-[10px] uppercase tracking-widest text-muted font-semibold">Scope</legend>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-ink">Applies to</label>
                  <div className="flex flex-wrap gap-3 text-sm">
                    {(["all", "categories", "products"] as const).map((s) => (
                      <label key={s} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="scope"
                          value={s}
                          checked={form.scope === s}
                          onChange={() => setField("scope", s)}
                          className="accent-ink"
                        />
                        <span className="capitalize">
                          {s === "all" ? "All products" : s === "categories" ? "Specific categories" : "Specific products"}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                {form.scope === "categories" && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-ink">Categories</p>
                    <div className="flex flex-wrap gap-2">
                      {CATEGORIES.map((cat) => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => toggleCategory(cat)}
                          className={`px-3 py-1.5 text-xs rounded-full border transition-colors cursor-pointer capitalize ${
                            form.categoryTargets.includes(cat)
                              ? "bg-ink text-paper border-ink"
                              : "border-stone hover:border-ink"
                          }`}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                    {form.categoryTargets.length === 0 && (
                      <p className="text-xs text-red-600">Select at least one category.</p>
                    )}
                  </div>
                )}

                {form.scope === "products" && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-ink">Products</p>
                      {form.productTargets.length > 0 && (
                        <span className="text-xs text-muted">{form.productTargets.length} selected</span>
                      )}
                    </div>
                    <input
                      type="text"
                      placeholder="Search products…"
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                      className="w-full border border-stone rounded px-3 py-2 text-xs text-ink bg-white focus:border-ink focus:outline-none transition-colors"
                    />
                    <div className="border border-stone rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                      {filteredProducts.length === 0 ? (
                        <p className="text-xs text-muted px-4 py-3">No products found.</p>
                      ) : (
                        filteredProducts.map((p) => (
                          <label
                            key={p.id}
                            className="flex items-center gap-3 px-3 py-2 hover:bg-stone-50 cursor-pointer border-b border-stone last:border-0 transition-colors"
                          >
                            <input
                              type="checkbox"
                              checked={form.productTargets.includes(p.id)}
                              onChange={() => toggleProduct(p.id)}
                              className="accent-ink shrink-0"
                            />
                            <span className="flex-1 text-xs text-ink truncate">{p.name}</span>
                            <span className="text-[9px] uppercase text-muted capitalize shrink-0">{p.category}</span>
                          </label>
                        ))
                      )}
                    </div>
                    {form.productTargets.length === 0 && (
                      <p className="text-xs text-red-600">Select at least one product.</p>
                    )}
                  </div>
                )}
              </fieldset>

              {/* Section: Schedule */}
              <fieldset className="space-y-4">
                <legend className="text-[10px] uppercase tracking-widest text-muted font-semibold">Schedule</legend>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-ink">
                      Starts At <span className="font-normal text-muted">(optional)</span>
                    </label>
                    <input
                      type="datetime-local"
                      value={form.startsAt}
                      onChange={(e) => setField("startsAt", e.target.value)}
                      className="w-full border border-stone rounded px-3 py-2 text-sm text-ink bg-white focus:border-ink focus:outline-none transition-colors"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-ink">
                      Ends At <span className="font-normal text-muted">(optional)</span>
                    </label>
                    <input
                      type="datetime-local"
                      value={form.endsAt}
                      onChange={(e) => setField("endsAt", e.target.value)}
                      min={form.startsAt || undefined}
                      className="w-full border border-stone rounded px-3 py-2 text-sm text-ink bg-white focus:border-ink focus:outline-none transition-colors"
                    />
                  </div>
                </div>
              </fieldset>

              {/* Section: Settings */}
              <fieldset className="space-y-4">
                <legend className="text-[10px] uppercase tracking-widest text-muted font-semibold">Settings</legend>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-ink">
                      Priority <span className="font-normal text-muted">(higher wins conflicts)</span>
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="1"
                      placeholder="0"
                      value={form.priority}
                      onChange={(e) => setField("priority", e.target.value)}
                      className="w-full border border-stone rounded px-3 py-2 text-sm text-ink bg-white focus:border-ink focus:outline-none transition-colors"
                    />
                  </div>
                  <div className="flex items-center gap-2 pt-5">
                    <input
                      type="checkbox"
                      id="campaignActive"
                      checked={form.isActive}
                      onChange={(e) => setField("isActive", e.target.checked)}
                      className="accent-ink"
                    />
                    <label htmlFor="campaignActive" className="text-xs font-medium text-ink cursor-pointer">
                      Active immediately
                    </label>
                  </div>
                </div>
              </fieldset>

              {/* Footer */}
              <div className="pt-2 flex justify-end gap-3 border-t border-stone">
                <button
                  type="button"
                  onClick={closeModal}
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
                  {isSubmitting
                    ? "Saving…"
                    : modalMode === "edit"
                    ? "Save Changes"
                    : "Create Campaign"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
