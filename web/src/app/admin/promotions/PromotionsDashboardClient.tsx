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
                  {formError}
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

              {/* Body */}
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
                        step="1"
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
                      step="1"
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
