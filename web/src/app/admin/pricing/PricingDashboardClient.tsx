"use client";

import React, { useState, useTransition } from "react";
import { formatPKR } from "@/lib/format";
import {
  updateSingleProductPrice,
  bulkUpdatePrices,
  AdminResult,
  addProductColor,
  uploadProductColorImage,
  getProductColors,
  syncProductsToSupabase,
} from "@/lib/actions/admin";

interface ProductItem {
  id: string;
  name: string;
  slug: string;
  sku: string;
  price: number;
  variantId: string;
}

interface PricingDashboardClientProps {
  initialProducts: ProductItem[];
}

export function PricingDashboardClient({ initialProducts }: PricingDashboardClientProps) {
  const [products, setProducts] = useState<ProductItem[]>(initialProducts);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Bulk states
  const [bulkType, setBulkType] = useState<"flat" | "percent">("flat");
  const [bulkDirection, setBulkDirection] = useState<"increase" | "decrease">("increase");
  const [bulkAmount, setBulkAmount] = useState<number | "">("");
  const [bulkStep, setBulkStep] = useState<"idle" | "confirm">("idle");
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [bulkSuccess, setBulkSuccess] = useState<string | null>(null);

  // Sync states
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncSuccess, setSyncSuccess] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  // Per-product override inputs
  const [newPrices, setNewPrices] = useState<Record<string, number>>({});
  const [savingIds, setSavingIds] = useState<Record<string, boolean>>({});
  const [individualErrors, setIndividualErrors] = useState<Record<string, string | null>>({});
  const [individualSuccesses, setIndividualSuccesses] = useState<Record<string, boolean>>({});

  const [isPending, startTransition] = useTransition();

  // Drawer & Color states
  const [selectedProductForColors, setSelectedProductForColors] = useState<ProductItem | null>(null);
  const [productColors, setProductColors] = useState<Array<{
    id: string;
    product_id: string;
    color_name: string;
    image_url: string | null;
    stock: number;
  }>>([]);
  const [loadingColors, setLoadingColors] = useState(false);
  const [colorError, setColorError] = useState<string | null>(null);

  // Form states inside color drawer
  const [newColorName, setNewColorName] = useState("");
  const [newColorStock, setNewColorStock] = useState<number>(10);
  const [applyColorToAll, setApplyColorToAll] = useState(false);
  const [addingColor, setAddingColor] = useState(false);

  // Upload states inside color drawer
  const [uploadingColorId, setUploadingColorId] = useState<string | null>(null);

  const handleOpenColors = async (p: ProductItem) => {
    setSelectedProductForColors(p);
    setLoadingColors(true);
    setColorError(null);
    setProductColors([]);
    setNewColorName("");
    setNewColorStock(10);
    setApplyColorToAll(false);
    
    try {
      const res = await getProductColors(p.id);
      if (res.ok && res.colors) {
        setProductColors(res.colors);
      } else {
        setColorError(res.error || "Failed to load colors.");
      }
    } catch (err: any) {
      setColorError(err.message || "Failed to load colors.");
    } finally {
      setLoadingColors(false);
    }
  };

  const handleAddColor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductForColors || !newColorName.trim()) return;

    setAddingColor(true);
    setColorError(null);

    try {
      const res = await addProductColor(
        selectedProductForColors.id,
        newColorName.trim(),
        newColorStock,
        applyColorToAll,
        selectedProductForColors.name,
        selectedProductForColors.slug,
      );

      if (res.ok) {
        // Reload colors
        const fresh = await getProductColors(selectedProductForColors.id);
        if (fresh.ok && fresh.colors) {
          setProductColors(fresh.colors);
        }
        setNewColorName("");
        setNewColorStock(10);
        setApplyColorToAll(false);
      } else {
        setColorError(res.error || "Failed to add color.");
      }
    } catch (err: any) {
      setColorError(err.message || "An error occurred.");
    } finally {
      setAddingColor(false);
    }
  };

  const handleImageUpload = async (colorName: string, e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedProductForColors || !e.target.files?.[0]) return;
    const file = e.target.files[0];
    
    setUploadingColorId(colorName);
    setColorError(null);
    
    const formData = new FormData();
    formData.append("file", file);
    
    try {
      const res = await uploadProductColorImage(selectedProductForColors.id, colorName, formData);
      if (res.ok && res.url) {
        setProductColors(prev =>
          prev.map(c => c.color_name === colorName ? { ...c, image_url: res.url! } : c)
        );
      } else {
        setColorError(res.error || "Failed to upload image.");
      }
    } catch (err: any) {
      setColorError(err.message || "Upload failed.");
    } finally {
      setUploadingColorId(null);
    }
  };

  // Filtered products list
  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.sku.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Handle individual price input change
  const handlePriceChange = (variantId: string, val: string) => {
    const num = parseFloat(val);
    if (isNaN(num) || num < 0) {
      // Allow clearing or set empty
      const next = { ...newPrices };
      delete next[variantId];
      setNewPrices(next);
      return;
    }
    setNewPrices({
      ...newPrices,
      [variantId]: num,
    });
    // Clear previous status
    setIndividualSuccesses({ ...individualSuccesses, [variantId]: false });
    setIndividualErrors({ ...individualErrors, [variantId]: null });
  };

  // Perform single product pricing update
  const handleSaveSingle = async (p: ProductItem) => {
    const newPrice = newPrices[p.variantId];
    if (newPrice === undefined || newPrice === p.price) return;

    setSavingIds((prev) => ({ ...prev, [p.variantId]: true }));
    setIndividualErrors((prev) => ({ ...prev, [p.variantId]: null }));
    setIndividualSuccesses((prev) => ({ ...prev, [p.variantId]: false }));

    try {
      const res = await updateSingleProductPrice(p.id, p.variantId, p.slug, p.name, newPrice);
      if (res.ok) {
        setProducts((prev) =>
          prev.map((item) =>
            item.variantId === p.variantId ? { ...item, price: newPrice } : item
          )
        );
        setIndividualSuccesses((prev) => ({ ...prev, [p.variantId]: true }));
        // Clean up input
        const nextInput = { ...newPrices };
        delete nextInput[p.variantId];
        setNewPrices(nextInput);
      } else {
        setIndividualErrors((prev) => ({ ...prev, [p.variantId]: (res as any).error || "Save failed." }));
      }
    } catch (err: any) {
      setIndividualErrors((prev) => ({ ...prev, [p.variantId]: err.message || "An unexpected error occurred." }));
    } finally {
      setSavingIds((prev) => ({ ...prev, [p.variantId]: false }));
    }
  };

  // Perform bulk adjustments update
  const handleApplyBulk = async () => {
    if (bulkAmount === "" || bulkAmount <= 0) {
      setBulkError("Please specify a valid amount greater than 0.");
      return;
    }

    if (bulkStep === "idle") {
      setBulkStep("confirm");
      return;
    }

    setBulkLoading(true);
    setBulkError(null);
    setBulkSuccess(null);

    try {
      const res = await bulkUpdatePrices(bulkType, bulkAmount, bulkDirection);
      if (res.ok) {
        // Calculate and apply local state updates to show them immediately
        setProducts((prev) =>
          prev.map((p) => {
            let adj = 0;
            if (bulkType === "flat") {
              adj = bulkAmount;
            } else {
              adj = p.price * (bulkAmount / 100);
            }
            let nextVal = bulkDirection === "increase" ? p.price + adj : p.price - adj;
            
            // Rounding Strategy: nearest 10 PKR
            let roundedVal = Math.round(nextVal / 10) * 10;
            roundedVal = Math.max(0, roundedVal);
            
            return {
              ...p,
              price: roundedVal,
            };
          })
        );
        setBulkSuccess(
          `Successfully applied bulk ${bulkDirection} of ${bulkAmount}${
            bulkType === "percent" ? "%" : " PKR"
          } to all fabrics (rounded to nearest 10 PKR).`
        );
        setBulkAmount("");
        setBulkStep("idle");
      } else {
        setBulkError((res as any).error || "Failed to perform bulk update.");
      }
    } catch (err: any) {
      setBulkError(err.message || "An unexpected error occurred during bulk operations.");
    } finally {
      setBulkLoading(false);
    }
  };

  const handleSyncToSupabase = async () => {
    setSyncLoading(true);
    setSyncSuccess(null);
    setSyncError(null);
    try {
      const res = await syncProductsToSupabase();
      if (res.ok) {
        setSyncSuccess(`Successfully synchronized ${res.synced} products & details from Saleor to Supabase.`);
      } else {
        setSyncError((res as any).error || "Failed to sync products.");
      }
    } catch (err: any) {
      setSyncError(err.message || "An unexpected error occurred during sync.");
    } finally {
      setSyncLoading(false);
    }
  };

  return (
    <div className="space-y-10">
      {/* 1. Global Bulk Operations Panel */}
      <div className="bg-mist/40 border border-stone p-6 rounded-xl shadow-sm space-y-6">
        <div>
          <h3 className="text-lg font-medium text-ink">Bulk Adjustment Panel</h3>
          <p className="text-xs text-muted mt-1">
            Apply automated price shifts (percentage reductions, markups, or flat increments) across the entire inventory at once.
          </p>
        </div>

        {bulkError && (
          <div className="text-xs text-red-700 bg-red-50 border border-red-200 px-4 py-2.5 rounded-lg flex justify-between items-start">
            <span>{bulkError}</span>
            <button onClick={() => setBulkError(null)} className="text-red-950 font-bold ml-2">×</button>
          </div>
        )}

        {bulkSuccess && (
          <div className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-4 py-2.5 rounded-lg flex justify-between items-start">
            <span>{bulkSuccess}</span>
            <button onClick={() => setBulkSuccess(null)} className="text-emerald-950 font-bold ml-2">×</button>
          </div>
        )}

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 items-end">
          {/* Adjustment Type Selector */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted">Adjustment Type</label>
            <div className="flex border border-stone rounded-md overflow-hidden bg-white">
              <button
                type="button"
                onClick={() => setBulkType("flat")}
                className={`flex-1 py-2 text-xs font-medium transition-colors ${
                  bulkType === "flat" ? "bg-ink text-paper" : "text-ink-soft hover:bg-stone-50"
                }`}
              >
                Flat (PKR)
              </button>
              <button
                type="button"
                onClick={() => setBulkType("percent")}
                className={`flex-1 py-2 text-xs font-medium transition-colors ${
                  bulkType === "percent" ? "bg-ink text-paper" : "text-ink-soft hover:bg-stone-50"
                }`}
              >
                Percent (%)
              </button>
            </div>
          </div>

          {/* Direction Selector */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted">Price Action</label>
            <div className="flex border border-stone rounded-md overflow-hidden bg-white">
              <button
                type="button"
                onClick={() => setBulkDirection("increase")}
                className={`flex-1 py-2 text-xs font-medium transition-colors ${
                  bulkDirection === "increase" ? "bg-emerald-700 text-white" : "text-ink-soft hover:bg-stone-50"
                }`}
              >
                Markup (+)
              </button>
              <button
                type="button"
                onClick={() => setBulkDirection("decrease")}
                className={`flex-1 py-2 text-xs font-medium transition-colors ${
                  bulkDirection === "decrease" ? "bg-amber-600 text-white" : "text-ink-soft hover:bg-stone-50"
                }`}
              >
                Discount (-)
              </button>
            </div>
          </div>

          {/* Amount Field */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted">
              Value Amount {bulkType === "percent" ? "(%)" : "(PKR)"}
            </label>
            <input
              type="number"
              min="0"
              step={bulkType === "percent" ? "1" : "50"}
              value={bulkAmount}
              onChange={(e) => setBulkAmount(e.target.value === "" ? "" : parseFloat(e.target.value))}
              placeholder={bulkType === "percent" ? "e.g. 10%" : "e.g. 500 PKR"}
              disabled={bulkLoading}
              className="w-full border border-stone rounded-md px-3 py-2 text-sm text-ink bg-white focus:border-ink focus:outline-none transition-colors"
            />
          </div>

          {/* Action Trigger Button */}
          <div>
            {bulkStep === "idle" ? (
              <button
                type="button"
                disabled={bulkLoading || bulkAmount === "" || bulkAmount <= 0}
                onClick={handleApplyBulk}
                className="w-full btn btn-primary !border-ink !bg-ink !text-paper hover:!bg-stone-900 disabled:!opacity-40 disabled:!cursor-not-allowed transition-all"
              >
                Run Bulk Shift
              </button>
            ) : (
              <div className="flex gap-2 w-full">
                <button
                  type="button"
                  disabled={bulkLoading}
                  onClick={handleApplyBulk}
                  className="flex-1 bg-red-600 text-white border border-red-600 hover:bg-red-700 font-medium py-2 rounded-md text-xs tracking-wider transition-colors"
                >
                  {bulkLoading ? "Syncing..." : "Confirm Bulk Update"}
                </button>
                <button
                  type="button"
                  disabled={bulkLoading}
                  onClick={() => setBulkStep("idle")}
                  className="px-3 border border-stone bg-white hover:bg-stone-50 text-ink text-xs font-semibold rounded-md transition-colors"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2. Interactive Products Table */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-lg font-medium text-ink">Per-Article Adjustments</h3>
            <p className="text-xs text-muted">Manage individual product pricing and sync details with Supabase.</p>
          </div>
          
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full sm:w-auto">
            {/* Sync to Supabase Button */}
            <button
              onClick={handleSyncToSupabase}
              disabled={syncLoading}
              className={`flex items-center justify-center gap-2 px-4 py-2 border rounded-md text-xs font-semibold shadow-sm transition-all duration-200 ${
                syncLoading
                  ? "bg-stone-50 border-stone text-muted cursor-not-allowed"
                  : "bg-paper hover:bg-stone-50 border-stone text-ink cursor-pointer"
              }`}
            >
              {syncLoading ? (
                <>
                  <svg className="animate-spin h-3.5 w-3.5 text-muted" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Syncing Catalog...
                </>
              ) : (
                <>
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 7.89M9 11l3 3L22 4" />
                  </svg>
                  Sync Products from Saleor
                </>
              )}
            </button>

            {/* Beautiful Search Input */}
            <div className="relative w-full sm:max-w-xs">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-4 w-4 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </span>
              <input
                type="text"
                placeholder="Search fabrics..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full border border-stone rounded-md pl-9 pr-4 py-2 text-sm text-ink bg-white focus:border-ink focus:outline-none transition-colors"
              />
            </div>
          </div>
        </div>

        {/* Sync Success/Error Banners */}
        {syncError && (
          <div className="text-xs text-red-700 bg-red-50 border border-red-200 px-4 py-2.5 rounded-lg flex justify-between items-start">
            <span>{syncError}</span>
            <button onClick={() => setSyncError(null)} className="text-red-950 font-bold ml-2">×</button>
          </div>
        )}

        {syncSuccess && (
          <div className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-4 py-2.5 rounded-lg flex justify-between items-start">
            <span>{syncSuccess}</span>
            <button onClick={() => setSyncSuccess(null)} className="text-emerald-950 font-bold ml-2">×</button>
          </div>
        )}

        {filteredProducts.length === 0 ? (
          <div className="border border-stone py-12 text-center text-sm text-muted">
            No fabrics found matching &quot;{searchQuery}&quot;.
          </div>
        ) : (
          <div className="border border-stone overflow-hidden rounded-xl shadow-sm bg-white">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-stone-50 border-b border-stone text-xs font-semibold text-muted uppercase tracking-wider">
                  <th className="p-4 pl-6">Fabric Article</th>
                  <th className="p-4">SKU / ID</th>
                  <th className="p-4 text-right">Current Price</th>
                  <th className="p-4 text-center">New Custom Price (PKR)</th>
                  <th className="p-4">Difference Preview</th>
                  <th className="p-4 pr-6 text-right">Sync Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone text-sm text-ink">
                {filteredProducts.map((p) => {
                  const currentPriceVal = p.price;
                  const newPriceVal = newPrices[p.variantId];
                  const hasChanged = newPriceVal !== undefined && newPriceVal !== currentPriceVal;
                  
                  // Difference calculations
                  const diff = hasChanged ? newPriceVal - currentPriceVal : 0;
                  const diffPercent = hasChanged ? (diff / currentPriceVal) * 100 : 0;

                  const isSaving = savingIds[p.variantId] || false;
                  const itemError = individualErrors[p.variantId];
                  const itemSuccess = individualSuccesses[p.variantId];

                  return (
                    <tr key={p.variantId} className="hover:bg-stone-50/50 transition-colors">
                      <td className="p-4 pl-6 font-medium">
                        {p.name}
                        {itemError && (
                          <p className="text-[11px] text-red-700 mt-1 font-normal max-w-xs">{itemError}</p>
                        )}
                        {itemSuccess && (
                          <p className="text-[11px] text-emerald-700 mt-1 font-semibold flex items-center gap-1">
                            ✓ Synced with Saleor &amp; Supabase
                          </p>
                        )}
                      </td>
                      <td className="p-4 text-muted text-xs font-mono">{p.sku || "—"}</td>
                      <td className="p-4 text-right font-medium">{formatPKR(currentPriceVal)}</td>
                      <td className="p-4 text-center">
                        <div className="inline-flex items-center gap-2">
                          <input
                            type="number"
                            min="0"
                            step="10"
                            placeholder={String(currentPriceVal)}
                            value={newPriceVal === undefined ? "" : newPriceVal}
                            onChange={(e) => handlePriceChange(p.variantId, e.target.value)}
                            disabled={isSaving}
                            className="w-28 border border-stone rounded px-2.5 py-1 text-sm text-right text-ink focus:border-ink focus:outline-none bg-white transition-colors"
                          />
                        </div>
                      </td>
                      <td className="p-4">
                        {hasChanged && (
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                              diff > 0
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : "bg-rose-50 text-rose-700 border-rose-200"
                            }`}
                          >
                            {diff > 0 ? "+" : ""}
                            {formatPKR(diff)} ({diffPercent > 0 ? "+" : ""}
                            {diffPercent.toFixed(1)}%)
                          </span>
                        )}
                      </td>
                      <td className="p-4 pr-6 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleOpenColors(p)}
                            className="px-3.5 py-1.5 border border-stone bg-white hover:bg-stone-50 text-ink rounded font-semibold text-xs transition-all"
                          >
                            Manage Colors
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSaveSingle(p)}
                            disabled={!hasChanged || isSaving}
                            className="px-4 py-1.5 border border-ink bg-ink text-paper hover:bg-stone-900 rounded font-semibold text-xs disabled:opacity-30 disabled:hover:bg-ink disabled:cursor-not-allowed transition-all"
                          >
                            {isSaving ? "Syncing..." : "Sync DBs"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 3. Sliding Admin Color Management Drawer */}
      {selectedProductForColors && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs transition-opacity duration-300">
          <div className="absolute inset-0" onClick={() => setSelectedProductForColors(null)} />
          <div className="relative w-full max-w-lg bg-white h-full shadow-2xl flex flex-col p-6 overflow-y-auto border-l border-stone">
            
            {/* Drawer Header */}
            <div className="flex justify-between items-start border-b border-stone pb-4 mb-6">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-widest text-muted">Fabric Color Management</span>
                <h3 className="text-xl font-medium text-ink mt-0.5">{selectedProductForColors.name}</h3>
                <p className="text-xs text-muted font-mono mt-0.5">{selectedProductForColors.sku || "No SKU"}</p>
              </div>
              <button
                onClick={() => setSelectedProductForColors(null)}
                className="p-1 hover:bg-stone-100 rounded text-ink transition-colors cursor-pointer"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Error notifications */}
            {colorError && (
              <div className="bg-red-50 text-red-700 text-xs border border-red-200 p-3 rounded-lg flex justify-between items-center mb-6">
                <span>{colorError}</span>
                <button onClick={() => setColorError(null)} className="font-bold text-red-950">×</button>
              </div>
            )}

            {/* Existing Colors List */}
            <div className="space-y-4 flex-1">
              <h4 className="text-xs uppercase font-bold tracking-wider text-muted mb-3">Configured Colors</h4>
              {loadingColors ? (
                <div className="text-center py-8 text-sm text-muted">Loading colors...</div>
              ) : productColors.length === 0 ? (
                <div className="text-center py-8 text-sm text-muted border border-stone border-dashed rounded-lg">
                  No colors configured. Use the form below to add colors.
                </div>
              ) : (
                <div className="grid gap-4">
                  {productColors.map((c) => (
                    <div key={c.id} className="border border-stone rounded-lg p-4 flex gap-4 items-center bg-stone-50/50">
                      {/* Image Thumbnail */}
                      <div className="w-16 h-16 rounded border border-stone bg-white flex items-center justify-center overflow-hidden shrink-0 relative">
                        {c.image_url ? (
                          <img src={c.image_url} alt={c.color_name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="text-[10px] text-muted text-center p-1 font-mono">No Pic</div>
                        )}
                        {uploadingColorId === c.color_name && (
                          <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
                            <span className="text-[9px] font-bold text-ink animate-pulse">Uploading...</span>
                          </div>
                        )}
                      </div>

                      {/* Color Details & Controls */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm text-ink truncate">{c.color_name}</span>
                          <span className="inline-block w-2.5 h-2.5 rounded-full border border-stone" style={{
                            backgroundColor: c.color_name.toLowerCase() === "white" ? "#ffffff" : 
                                             c.color_name.toLowerCase() === "black" ? "#000000" :
                                             c.color_name.toLowerCase() === "blue" ? "#0000ff" : 
                                             c.color_name.toLowerCase() === "red" ? "#ff0000" :
                                             c.color_name.toLowerCase() === "green" ? "#008000" :
                                             c.color_name.toLowerCase() === "beige" ? "#f5f5dc" :
                                             c.color_name.toLowerCase() === "gray" || c.color_name.toLowerCase() === "grey" ? "#808080" : 
                                             "#dddddd"
                          }} />
                        </div>
                        <p className="text-xs text-muted mt-0.5">Stock Level: <span className="font-semibold text-ink">{c.stock} units</span></p>
                        
                        {/* File Upload Selector */}
                        <div className="mt-2">
                          <label className="inline-flex items-center cursor-pointer px-2.5 py-1 rounded border border-stone bg-white text-[11px] font-semibold text-ink hover:bg-stone-50 transition-colors">
                            {c.image_url ? "Change Photo" : "Upload Photo"}
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              disabled={uploadingColorId !== null}
                              onChange={(e) => handleImageUpload(c.color_name, e)}
                            />
                          </label>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Add New Color Form */}
            <div className="border-t border-stone pt-6 mt-8">
              <h4 className="text-xs uppercase font-bold tracking-wider text-muted mb-4">Add Fabric Color</h4>
              <form onSubmit={handleAddColor} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-muted">Color Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Navy Blue"
                      value={newColorName}
                      onChange={(e) => setNewColorName(e.target.value)}
                      required
                      className="w-full border border-stone rounded-md px-3 py-1.5 text-sm text-ink bg-white focus:border-ink focus:outline-none transition-colors"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-muted">Default Stock</label>
                    <input
                      type="number"
                      min="0"
                      value={newColorStock}
                      onChange={(e) => setNewColorStock(parseInt(e.target.value) || 0)}
                      required
                      className="w-full border border-stone rounded-md px-3 py-1.5 text-sm text-ink bg-white focus:border-ink focus:outline-none transition-colors"
                    />
                  </div>
                </div>

                <label className="flex items-center gap-2 cursor-pointer py-1">
                  <input
                    type="checkbox"
                    checked={applyColorToAll}
                    onChange={(e) => setApplyColorToAll(e.target.checked)}
                    className="rounded border-stone text-ink focus:ring-ink"
                  />
                  <span className="text-xs text-ink-soft select-none">Bulk Option: Apply color to all fabrics in catalog</span>
                </label>

                <button
                  type="submit"
                  disabled={addingColor || !newColorName.trim()}
                  className="w-full py-2.5 bg-ink text-paper hover:bg-stone-900 border border-ink font-semibold text-xs tracking-wider rounded transition-all disabled:opacity-40 cursor-pointer"
                >
                  {addingColor ? "Adding Color..." : "Configure Color"}
                </button>
              </form>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
