"use client";

import React, { useReducer, useEffect } from "react";
import {
  updateProductColorStock,
  toggleProductVisibility,
  adminCreateProduct,
  adminDeleteProduct,
  addProductColor,
  removeProductColor,
  adminAddProductImage,
  adminRemoveProductImage,
} from "@/lib/actions/admin";
import { createSupabaseBrowser } from "@/lib/supabase/client";
import { stockReducer, initialStockState } from "./stockReducer";
import { DeleteConfirmModal } from "./DeleteConfirmModal";
import { AddProductModal } from "./AddProductModal";
import { AddColorModal } from "./AddColorModal";
import type { ProductItem, ProductColor } from "./types";

interface StockDashboardClientProps {
  products: ProductItem[];
  initialColors: ProductColor[];
}

export function StockDashboardClient({
  products,
  initialColors,
}: StockDashboardClientProps) {
  const [state, dispatch] = useReducer(stockReducer, initialStockState(products, initialColors));

  const {
    localProducts, colors, searchQuery,
    editingStock, savingIds, successIds, errorIds,
    isTogglingVisibility,
    showDeleteConfirm, isDeletingProductId,
    showAddModal, addForm, isUploadingImage, isSubmittingAdd, addError,
    showAddColorModal, addColorName, addColorStock, isSubmittingColor, addColorError,
    removingColorId,
    productImages, imageUploading, imageRemoving, imageErrors,
  } = state;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        dispatch({ type: "ADD_MODAL_CLOSE" });
        dispatch({ type: "DELETE_CONFIRM_CLOSE" });
        dispatch({ type: "ADD_COLOR_MODAL_CLOSE" });
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    dispatch({ type: "SET_PRODUCTS", products });
  }, [products]);

  useEffect(() => {
    dispatch({ type: "SET_COLORS", colors: initialColors });
  }, [initialColors]);

  const filteredProducts = localProducts.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.sku.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleStockInputChange = (colorId: string, val: string) => {
    const num = parseInt(val);
    if (isNaN(num) || num < 0) {
      dispatch({ type: "STOCK_EDIT_CLEAR", colorId });
      return;
    }
    dispatch({ type: "STOCK_EDIT_CHANGE", colorId, value: num });
  };

  const handleSaveStock = async (c: ProductColor) => {
    const newStock = editingStock[c.id];
    if (newStock === undefined || newStock === c.stock) return;

    dispatch({ type: "STOCK_SAVE_START", colorId: c.id });
    try {
      const res = await updateProductColorStock(c.catalog_id, c.color_name, newStock);
      if (res.ok) {
        dispatch({ type: "STOCK_SAVE_SUCCESS", colorId: c.id, newStock });
      } else {
        dispatch({ type: "STOCK_SAVE_ERROR", colorId: c.id, error: (res as any).error || "Failed." });
      }
    } catch (err: any) {
      dispatch({ type: "STOCK_SAVE_ERROR", colorId: c.id, error: err.message || "Error occurred." });
    } finally {
      dispatch({ type: "STOCK_SAVE_DONE", colorId: c.id });
    }
  };

  const handleToggleVisibility = async (productId: string, visible: boolean) => {
    dispatch({ type: "VISIBILITY_TOGGLE_START", productId });
    try {
      const res = await toggleProductVisibility(productId, visible);
      if (res.ok) {
        dispatch({ type: "VISIBILITY_TOGGLE_DONE", productId, visible });
      } else {
        dispatch({ type: "VISIBILITY_TOGGLE_DONE", productId });
        alert(res.error || "Failed to toggle visibility status.");
      }
    } catch (err: any) {
      dispatch({ type: "VISIBILITY_TOGGLE_DONE", productId });
      alert(err.message || "An error occurred.");
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    dispatch({ type: "DELETE_START", productId });
    try {
      const res = await adminDeleteProduct(productId);
      if (res.ok) {
        dispatch({ type: "DELETE_DONE", productId });
      } else {
        dispatch({ type: "DELETE_CONFIRM_CLOSE" });
        alert(res.error || "Failed to delete product.");
      }
    } catch (err: any) {
      dispatch({ type: "DELETE_CONFIRM_CLOSE" });
      alert(err.message || "An error occurred during deletion.");
    }
  };

  const handleCreateProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addForm.name || !addForm.slug || !addForm.price || !addForm.composition || !addForm.description) {
      dispatch({ type: "ADD_SET_ERROR", error: "All fields are required." });
      return;
    }
    const priceNum = parseFloat(addForm.price);
    if (isNaN(priceNum) || priceNum <= 0) {
      dispatch({ type: "ADD_SET_ERROR", error: "Price must be a valid positive number." });
      return;
    }

    dispatch({ type: "ADD_SUBMIT_START" });
    try {
      let imageUrl: string | null = null;
      if (addForm.imageFile) {
        dispatch({ type: "ADD_UPLOAD_START" });
        const supabase = createSupabaseBrowser();
        const ext = addForm.imageFile.name.split(".").pop() ?? "jpg";
        const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from("product-images")
          .upload(path, addForm.imageFile, { cacheControl: "3600", upsert: false });
        if (uploadErr) {
          dispatch({ type: "ADD_SET_ERROR", error: `Image upload failed: ${uploadErr.message}` });
          return;
        }
        dispatch({ type: "ADD_UPLOAD_DONE" });
        const { data: { publicUrl } } = supabase.storage.from("product-images").getPublicUrl(path);
        imageUrl = publicUrl;
      }

      const threadCountNum = addForm.threadCount ? parseInt(addForm.threadCount, 10) : null;
      const res = await adminCreateProduct(
        addForm.name,
        addForm.slug,
        addForm.category,
        priceNum,
        addForm.composition,
        addForm.description,
        imageUrl,
        addForm.weaveType || null,
        threadCountNum !== null && isNaN(threadCountNum) ? null : threadCountNum,
      );

      if (res.ok) {
        dispatch({ type: "ADD_RESET_FORM" });
        window.location.reload();
      } else {
        dispatch({ type: "ADD_SET_ERROR", error: res.error || "Failed to create product." });
      }
    } catch (err: unknown) {
      dispatch({ type: "ADD_SET_ERROR", error: err instanceof Error ? err.message : "An unexpected error occurred." });
    } finally {
      dispatch({ type: "ADD_SUBMIT_DONE" });
    }
  };

  const handleAddColor = async (catalogId: string) => {
    const name = addColorName.trim();
    const stock = parseInt(addColorStock);
    if (!name) { dispatch({ type: "ADD_COLOR_SET_ERROR", error: "Color name is required." }); return; }
    if (isNaN(stock) || stock < 0) { dispatch({ type: "ADD_COLOR_SET_ERROR", error: "Stock must be 0 or greater." }); return; }

    dispatch({ type: "ADD_COLOR_SUBMIT_START" });
    try {
      const res = await addProductColor(catalogId, name, stock);
      if (res.ok) {
        dispatch({ type: "ADD_COLOR_SUBMIT_DONE" });
        window.location.reload();
      } else {
        dispatch({ type: "ADD_COLOR_SET_ERROR", error: (res as any).error || "Failed to add color." });
      }
    } catch (err: any) {
      dispatch({ type: "ADD_COLOR_SET_ERROR", error: err.message || "Unexpected error." });
    }
  };

  const handleUploadImage = async (productId: string, file: File) => {
    dispatch({ type: "IMAGE_UPLOAD_START", productId });
    try {
      const supabase = createSupabaseBrowser();
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${productId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from("product-images")
        .upload(path, file, { cacheControl: "3600", upsert: false });
      if (uploadErr) {
        dispatch({ type: "IMAGE_UPLOAD_ERROR", productId, error: `Upload failed: ${uploadErr.message}` });
        return;
      }
      const { data: { publicUrl } } = supabase.storage.from("product-images").getPublicUrl(path);
      const res = await adminAddProductImage(productId, publicUrl);
      if (res.ok) {
        dispatch({ type: "IMAGE_UPLOAD_DONE", productId, imageUrl: publicUrl });
      } else {
        dispatch({ type: "IMAGE_UPLOAD_ERROR", productId, error: res.error || "Failed to save image." });
      }
    } catch (err: unknown) {
      dispatch({ type: "IMAGE_UPLOAD_ERROR", productId, error: err instanceof Error ? err.message : "Unexpected error." });
    }
  };

  const handleRemoveImage = async (productId: string, imageUrl: string) => {
    if (!confirm("Remove this image?")) return;
    dispatch({ type: "IMAGE_REMOVE_START", productId, imageUrl });
    try {
      const res = await adminRemoveProductImage(productId, imageUrl);
      if (res.ok) {
        dispatch({ type: "IMAGE_REMOVE_DONE", productId, imageUrl });
      } else {
        dispatch({ type: "IMAGE_REMOVE_ERROR", productId, imageUrl, error: res.error || "Failed to remove image." });
      }
    } catch (err: unknown) {
      dispatch({ type: "IMAGE_REMOVE_ERROR", productId, imageUrl, error: err instanceof Error ? err.message : "Unexpected error." });
    }
  };

  const handleRemoveColor = async (colorId: string) => {
    if (!confirm("Remove this color variant? This cannot be undone.")) return;
    dispatch({ type: "COLOR_REMOVE_START", colorId });
    try {
      const res = await removeProductColor(colorId);
      if (res.ok) {
        dispatch({ type: "COLOR_REMOVE_DONE", colorId });
      } else {
        dispatch({ type: "COLOR_REMOVE_DONE", colorId });
        alert((res as any).error || "Failed to remove color.");
      }
    } catch (err: any) {
      dispatch({ type: "COLOR_REMOVE_DONE", colorId });
      alert(err.message || "Unexpected error.");
    }
  };

  return (
    <div className="space-y-8">
      {/* Header and Control Panel */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold text-ink">Inventory Management</h3>
          <p className="text-xs text-muted mt-0.5">
            Audit and adjust fabric stock levels by color, configure visibility, and maintain real-time catalog data.
          </p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto shrink-0">
          <div className="relative flex-1 sm:flex-none sm:w-64">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-4 w-4 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </span>
            <input
              type="text"
              placeholder="Search fabrics..."
              id="admin-search-input"
              value={searchQuery}
              onChange={(e) => dispatch({ type: "SET_SEARCH", query: e.target.value })}
              className="w-full border border-stone rounded-md pl-9 pr-4 py-2 text-sm text-ink bg-white focus:border-ink focus:outline-none transition-colors"
            />
          </div>

          <button
            onClick={() => dispatch({ type: "ADD_MODAL_OPEN" })}
            id="admin-create-fabric-btn"
            className="px-4 py-2 bg-ink hover:bg-stone-900 text-paper rounded-md text-sm font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 shadow-sm active:scale-[0.98]"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            <span>Create Fabric</span>
          </button>
        </div>
      </div>

      {filteredProducts.length === 0 ? (
        <div className="border border-stone py-16 text-center text-sm text-muted rounded-xl bg-white shadow-xs">
          <svg className="w-8 h-8 text-stone-300 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
          No fabrics found matching &quot;{searchQuery}&quot;.
        </div>
      ) : (
        <div className="space-y-6">
          {filteredProducts.map((p) => {
            const productColors = colors.filter((c) => c.catalog_id === p.id);

            return (
              <div
                key={p.id}
                className="bg-white border border-stone rounded-xl overflow-hidden shadow-xs hover:shadow-sm transition-all"
              >
                {/* Product Section Header */}
                <div className="bg-stone-50/50 px-6 py-4 border-b border-stone flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <h4 className="font-semibold text-ink text-base">{p.name}</h4>
                    <p className="text-xs text-muted font-mono mt-0.5">SKU: {p.sku || "No SKU"}</p>
                  </div>

                  <div className="flex items-center gap-4 sm:self-center shrink-0 justify-between sm:justify-start">
                    {/* Storefront Visibility Toggle */}
                    <div className="flex items-center gap-2 border-r border-stone/60 pr-4">
                      <span className="text-[11px] font-bold text-ink uppercase tracking-wider">
                        {p.available ? "Visible" : "Hidden"}
                      </span>
                      <button
                        onClick={() => handleToggleVisibility(p.id, !p.available)}
                        disabled={isTogglingVisibility[p.id]}
                        id={`toggle-visibility-${p.id}`}
                        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-1 focus:ring-ink ${
                          p.available ? "bg-emerald-800" : "bg-stone-200"
                        } ${isTogglingVisibility[p.id] ? "opacity-50 cursor-not-allowed" : ""}`}
                        title={p.available ? "Hide from storefront" : "Show on storefront"}
                      >
                        <span
                          aria-hidden="true"
                          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            p.available ? "translate-x-4" : "translate-x-0"
                          }`}
                        />
                      </button>
                    </div>

                    {/* Colors Count badge */}
                    <div className="text-xs font-semibold text-ink bg-stone-100 px-3 py-1 rounded-full border border-stone/40">
                      Total Colors: {productColors.length}
                    </div>

                    {/* Add Color button */}
                    <button
                      onClick={() => dispatch({ type: "ADD_COLOR_MODAL_OPEN", catalogId: p.id })}
                      className="p-1.5 text-stone-400 hover:text-emerald-700 rounded-md hover:bg-stone-100 transition-colors cursor-pointer active:scale-95"
                      title="Add Color Variant"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    </button>

                    {/* Delete button */}
                    <button
                      onClick={() => dispatch({ type: "DELETE_CONFIRM_OPEN", productId: p.id })}
                      id={`delete-product-${p.id}`}
                      className="p-1.5 text-stone-400 hover:text-red-600 rounded-md hover:bg-stone-100 transition-colors cursor-pointer active:scale-95"
                      title="Delete Fabric Article"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Product Images */}
                <div className="px-6 py-4 border-b border-stone bg-white">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-bold uppercase tracking-wider text-muted">
                      Product Images ({(productImages[p.id] ?? []).length})
                    </p>
                    <label className="cursor-pointer px-3 py-1.5 bg-ink hover:bg-stone-900 text-paper rounded text-xs font-bold transition-all active:scale-[0.98] flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                      </svg>
                      {imageUploading[p.id] ? "Uploading…" : "Add Image"}
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        className="sr-only"
                        disabled={imageUploading[p.id]}
                        onChange={async (e) => {
                          const files = Array.from(e.target.files ?? []);
                          for (const file of files) {
                            await handleUploadImage(p.id, file);
                          }
                          e.target.value = "";
                        }}
                      />
                    </label>
                  </div>

                  {imageErrors[p.id] && (
                    <p className="text-xs text-red-600 mb-2">{imageErrors[p.id]}</p>
                  )}

                  {(productImages[p.id] ?? []).length === 0 ? (
                    <p className="text-xs text-muted italic">No images yet. Upload fabric photos above.</p>
                  ) : (
                    <div className="flex flex-wrap gap-3">
                      {(productImages[p.id] ?? []).map((url, idx) => {
                        const isRemoving = imageRemoving[p.id + url];
                        return (
                          <div key={url} className="relative group w-20 h-20 rounded border border-stone overflow-hidden shadow-xs">
                            <img src={url} alt={`${p.name} ${idx + 1}`} className="w-full h-full object-cover" />
                            <button
                              onClick={() => handleRemoveImage(p.id, url)}
                              disabled={isRemoving}
                              className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center disabled:opacity-30 cursor-pointer"
                              title="Remove image"
                            >
                              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Colors Grid for Product */}
                <div className="p-6">
                  {productColors.length === 0 ? (
                    <div className="py-4 text-center">
                      <p className="text-xs text-muted mb-3">No color variants yet.</p>
                      <button
                        onClick={() => dispatch({ type: "ADD_COLOR_MODAL_OPEN", catalogId: p.id })}
                        className="px-4 py-2 bg-ink hover:bg-stone-900 text-paper rounded-md text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 mx-auto"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                        </svg>
                        Add First Color
                      </button>
                    </div>
                  ) : (
                    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                      {productColors.map((c) => {
                        const isSaving = savingIds[c.id] || false;
                        const isSuccess = successIds[c.id] || false;
                        const isError = errorIds[c.id] || null;
                        const inputVal = editingStock[c.id];
                        const isLowStock = c.stock <= 2;
                        const isOutOfStock = c.stock === 0;

                        return (
                          <div
                            key={c.id}
                            className={`border rounded-lg p-4 flex gap-4 items-center transition-all ${
                              isOutOfStock
                                ? "border-red-200 bg-red-50/10"
                                : isLowStock
                                ? "border-amber-200 bg-amber-50/10"
                                : "border-stone bg-stone-50/20"
                            }`}
                          >
                            {/* Color Avatar/Image Preview */}
                            <div className="w-14 h-14 rounded border border-stone bg-white overflow-hidden shrink-0 relative flex items-center justify-center shadow-xs">
                              {c.image_url ? (
                                <img
                                  src={c.image_url}
                                  alt={c.color_name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <span className="inline-block w-6 h-6 rounded-full border border-stone/50 shadow-inner" style={{
                                  backgroundColor: c.color_name.toLowerCase() === "white" ? "#ffffff" :
                                                   c.color_name.toLowerCase() === "black" ? "#000000" :
                                                   c.color_name.toLowerCase() === "blue" ? "#0000ff" :
                                                   c.color_name.toLowerCase() === "red" ? "#ff0000" :
                                                   c.color_name.toLowerCase() === "green" ? "#008000" :
                                                   c.color_name.toLowerCase() === "beige" ? "#f5f5dc" :
                                                   c.color_name.toLowerCase() === "gray" || c.color_name.toLowerCase() === "grey" ? "#808080" :
                                                   "#dddddd"
                                }} />
                              )}
                            </div>

                            {/* Color Details & Stock Input */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-1">
                                <span className="font-semibold text-sm text-ink truncate">
                                  {c.color_name}
                                </span>
                                {isOutOfStock ? (
                                  <span className="text-[10px] font-bold text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full shrink-0">
                                    Out of stock
                                  </span>
                                ) : isLowStock ? (
                                  <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full shrink-0">
                                    Low stock ({c.stock})
                                  </span>
                                ) : (
                                  <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full shrink-0">
                                    In stock ({c.stock})
                                  </span>
                                )}
                              </div>

                              {/* Save Actions & Status Alerts */}
                              <div className="mt-2.5 flex items-center gap-2">
                                <div className="relative flex items-center border border-stone rounded bg-white overflow-hidden w-28 shrink-0 shadow-inner">
                                  {/* Minus Button */}
                                  <button
                                    type="button"
                                    disabled={isSaving}
                                    onClick={() => {
                                      const currentVal = editingStock[c.id] !== undefined ? editingStock[c.id] : c.stock;
                                      handleStockInputChange(c.id, String(Math.max(0, currentVal - 1)));
                                    }}
                                    className="w-8 h-7 flex items-center justify-center text-stone-500 hover:text-ink hover:bg-stone-50 border-r border-stone active:bg-stone-100 disabled:opacity-50 transition-colors shrink-0 cursor-pointer text-xs font-semibold"
                                  >
                                    -
                                  </button>

                                  <input
                                    type="number"
                                    min="0"
                                    placeholder={String(c.stock)}
                                    value={inputVal === undefined ? "" : inputVal}
                                    onChange={(e) => handleStockInputChange(c.id, e.target.value)}
                                    disabled={isSaving}
                                    id={`stock-input-${c.id}`}
                                    className="w-full text-center py-1 text-xs text-ink bg-transparent focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none font-medium"
                                  />

                                  {/* Plus Button */}
                                  <button
                                    type="button"
                                    disabled={isSaving}
                                    onClick={() => {
                                      const currentVal = editingStock[c.id] !== undefined ? editingStock[c.id] : c.stock;
                                      handleStockInputChange(c.id, String(currentVal + 1));
                                    }}
                                    className="w-8 h-7 flex items-center justify-center text-stone-500 hover:text-ink hover:bg-stone-50 border-l border-stone active:bg-stone-100 disabled:opacity-50 transition-colors shrink-0 cursor-pointer text-xs font-semibold"
                                  >
                                    +
                                  </button>
                                </div>

                                {/* Save Button */}
                                <button
                                  type="button"
                                  onClick={() => handleSaveStock(c)}
                                  id={`save-stock-btn-${c.id}`}
                                  disabled={inputVal === undefined || inputVal === c.stock || isSaving}
                                  className="px-3 py-1 bg-ink hover:bg-stone-900 text-paper rounded text-[11px] font-bold disabled:opacity-30 disabled:hover:bg-ink disabled:cursor-not-allowed transition-all shrink-0 cursor-pointer"
                                >
                                  {isSaving ? "..." : "Save"}
                                </button>
                              </div>

                              {isSuccess && (
                                <p className="text-[10px] text-emerald-700 font-semibold mt-1 flex items-center gap-0.5">
                                  ✓ Stock synced
                                </p>
                              )}
                              {isError && (
                                <p className="text-[10px] text-red-700 mt-1 truncate">
                                  {isError}
                                </p>
                              )}
                              <button
                                type="button"
                                onClick={() => handleRemoveColor(c.id)}
                                disabled={removingColorId === c.id}
                                className="mt-2 text-[10px] text-stone-400 hover:text-red-600 transition-colors cursor-pointer disabled:opacity-50"
                                title="Remove this color"
                              >
                                {removingColorId === c.id ? "Removing..." : "Remove color"}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <DeleteConfirmModal
        productId={showDeleteConfirm}
        isDeleting={isDeletingProductId !== null}
        onConfirm={handleDeleteProduct}
        onClose={() => dispatch({ type: "DELETE_CONFIRM_CLOSE" })}
      />

      <AddColorModal
        catalogId={showAddColorModal}
        addColorName={addColorName}
        addColorStock={addColorStock}
        isSubmittingColor={isSubmittingColor}
        addColorError={addColorError}
        dispatch={dispatch}
        onSubmit={() => showAddColorModal && handleAddColor(showAddColorModal)}
        onClose={() => dispatch({ type: "ADD_COLOR_MODAL_CLOSE" })}
      />

      {showAddModal && (
        <AddProductModal
          addForm={addForm}
          isUploadingImage={isUploadingImage}
          isSubmittingAdd={isSubmittingAdd}
          addError={addError}
          dispatch={dispatch}
          onSubmit={handleCreateProductSubmit}
          onClose={() => dispatch({ type: "ADD_MODAL_CLOSE" })}
        />
      )}
    </div>
  );
}
