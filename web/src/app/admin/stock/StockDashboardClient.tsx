"use client";

import React, { useState, useEffect } from "react";
import {
  updateProductColorStock,
  toggleProductVisibility,
  adminCreateProduct,
  adminDeleteProduct,
  addProductColor,
  removeProductColor,
} from "@/lib/actions/admin";

interface ProductItem {
  id: string;
  name: string;
  slug: string;
  sku: string;
  price: number;
  variantId: string;
  available: boolean;
}

interface ProductColor {
  id: string;
  catalog_id: string;
  color_name: string;
  image_url: string | null;
  stock: number;
  product_name?: string;
}

interface StockDashboardClientProps {
  products: ProductItem[];
  initialColors: ProductColor[];
}

export function StockDashboardClient({
  products,
  initialColors,
}: StockDashboardClientProps) {
  const [localProducts, setLocalProducts] = useState<ProductItem[]>(products);
  const [colors, setColors] = useState<ProductColor[]>(initialColors);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Quick stock editing states
  const [editingStock, setEditingStock] = useState<Record<string, number>>({});
  const [savingIds, setSavingIds] = useState<Record<string, boolean>>({});
  const [successIds, setSuccessIds] = useState<Record<string, boolean>>({});
  const [errorIds, setErrorIds] = useState<Record<string, string | null>>({});

  // Toggling visibility state
  const [isTogglingVisibility, setIsTogglingVisibility] = useState<Record<string, boolean>>({});

  // Delete product modal states
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [isDeletingProductId, setIsDeletingProductId] = useState<string | null>(null);

  // Add product form states
  const [showAddModal, setShowAddModal] = useState(false);
  const [addFormName, setAddFormName] = useState("");
  const [addFormSlug, setAddFormSlug] = useState("");
  const [addFormCategory, setAddFormCategory] = useState("cotton");
  const [addFormPrice, setAddFormPrice] = useState("");
  const [addFormComposition, setAddFormComposition] = useState("");
  const [addFormDescription, setAddFormDescription] = useState("");
  const [isSubmittingAdd, setIsSubmittingAdd] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Add color states
  const [showAddColorModal, setShowAddColorModal] = useState<string | null>(null);
  const [addColorName, setAddColorName] = useState("");
  const [addColorStock, setAddColorStock] = useState("10");
  const [isSubmittingColor, setIsSubmittingColor] = useState(false);
  const [addColorError, setAddColorError] = useState<string | null>(null);

  // Remove color states
  const [removingColorId, setRemovingColorId] = useState<string | null>(null);

  // Sync state changes on escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowAddModal(false);
        setShowDeleteConfirm(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Sync local products with props when they change
  useEffect(() => {
    setLocalProducts(products);
  }, [products]);

  // Sync local colors with props when they change
  useEffect(() => {
    setColors(initialColors);
  }, [initialColors]);

  // Filter products by search query
  const filteredProducts = localProducts.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.sku.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleNameChange = (val: string) => {
    setAddFormName(val);
    // Auto-generate slug from name
    const generatedSlug = val
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, "")
      .replace(/[\s_-]+/g, "-")
      .replace(/^-+|-+$/g, "");
    setAddFormSlug(generatedSlug);
  };

  const handleStockInputChange = (colorId: string, val: string) => {
    const num = parseInt(val);
    if (isNaN(num) || num < 0) {
      const next = { ...editingStock };
      delete next[colorId];
      setEditingStock(next);
      return;
    }
    setEditingStock({
      ...editingStock,
      [colorId]: num,
    });
    setSuccessIds({ ...successIds, [colorId]: false });
    setErrorIds({ ...errorIds, [colorId]: null });
  };

  const handleSaveStock = async (c: ProductColor) => {
    const newStock = editingStock[c.id];
    if (newStock === undefined || newStock === c.stock) return;

    setSavingIds((prev) => ({ ...prev, [c.id]: true }));
    setErrorIds((prev) => ({ ...prev, [c.id]: null }));
    setSuccessIds((prev) => ({ ...prev, [c.id]: false }));

    try {
      const res = await updateProductColorStock(c.catalog_id, c.color_name, newStock);
      if (res.ok) {
        setColors((prev) =>
          prev.map((item) => (item.id === c.id ? { ...item, stock: newStock } : item))
        );
        setSuccessIds((prev) => ({ ...prev, [c.id]: true }));
        const nextInput = { ...editingStock };
        delete nextInput[c.id];
        setEditingStock(nextInput);
      } else {
        setErrorIds((prev) => ({ ...prev, [c.id]: (res as any).error || "Failed." }));
      }
    } catch (err: any) {
      setErrorIds((prev) => ({ ...prev, [c.id]: err.message || "Error occurred." }));
    } finally {
      setSavingIds((prev) => ({ ...prev, [c.id]: false }));
    }
  };

  const handleToggleVisibility = async (productId: string, visible: boolean) => {
    setIsTogglingVisibility((prev) => ({ ...prev, [productId]: true }));
    try {
      const res = await toggleProductVisibility(productId, visible);
      if (res.ok) {
        setLocalProducts((prev) =>
          prev.map((p) => (p.id === productId ? { ...p, available: visible } : p))
        );
      } else {
        alert(res.error || "Failed to toggle visibility status.");
      }
    } catch (err: any) {
      alert(err.message || "An error occurred.");
    } finally {
      setIsTogglingVisibility((prev) => ({ ...prev, [productId]: false }));
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    setIsDeletingProductId(productId);
    try {
      const res = await adminDeleteProduct(productId);
      if (res.ok) {
        setLocalProducts((prev) => prev.filter((p) => p.id !== productId));
        setColors((prev) => prev.filter((c) => c.catalog_id !== productId));
        setShowDeleteConfirm(null);
      } else {
        alert(res.error || "Failed to delete product.");
      }
    } catch (err: any) {
      alert(err.message || "An error occurred during deletion.");
    } finally {
      setIsDeletingProductId(null);
    }
  };

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
      const res = await adminCreateProduct(
        addFormName,
        addFormSlug,
        addFormCategory,
        priceNum,
        addFormComposition,
        addFormDescription
      );

      if (res.ok) {
        setAddFormName("");
        setAddFormSlug("");
        setAddFormCategory("cotton");
        setAddFormPrice("");
        setAddFormComposition("");
        setAddFormDescription("");
        setShowAddModal(false);
        // Refresh the page to retrieve automatically seeded defaults (White and Black colors)
        window.location.reload();
      } else {
        setAddError(res.error || "Failed to create product.");
      }
    } catch (err: any) {
      setAddError(err.message || "An unexpected error occurred.");
    } finally {
      setIsSubmittingAdd(false);
    }
  };

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
        setAddColorName("");
        setAddColorStock("10");
        setShowAddColorModal(null);
        window.location.reload();
      } else {
        setAddColorError((res as any).error || "Failed to add color.");
      }
    } catch (err: any) {
      setAddColorError(err.message || "Unexpected error.");
    } finally {
      setIsSubmittingColor(false);
    }
  };

  const handleRemoveColor = async (colorId: string) => {
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

  return (
    <div className="space-y-8">
      {/* Header and Control Panel */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold text-ink">Inventory Management</h3>
          <p className="text-xs text-muted mt-0.5">
            Audit and adjust fabric stock levels by color, configure visibility, and maintain real-time Supabase / Saleor catalogs.
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
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full border border-stone rounded-md pl-9 pr-4 py-2 text-sm text-ink bg-white focus:border-ink focus:outline-none transition-colors"
            />
          </div>

          <button
            onClick={() => setShowAddModal(true)}
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

                    {/* Delete button */}
                    <button
                      onClick={() => setShowDeleteConfirm(p.id)}
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

                {/* Colors Grid for Product */}
                <div className="p-6">
                  {productColors.length === 0 ? (
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
                  ) : (
                    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                      {productColors.map((c) => {
                        const isSaving = savingIds[c.id] || false;
                        const isSuccess = successIds[c.id] || false;
                        const isError = errorIds[c.id] || null;
                        const inputVal = editingStock[c.id];
                        const displayStock = inputVal !== undefined ? inputVal : c.stock;
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
                                      const newVal = Math.max(0, currentVal - 1);
                                      handleStockInputChange(c.id, newVal.toString());
                                    }}
                                    className="w-8 h-7 flex items-center justify-center text-stone-500 hover:text-ink hover:bg-stone-50 border-r border-stone active:bg-stone-100 disabled:opacity-50 transition-colors shrink-0 cursor-pointer text-xs font-semibold"
                                  >
                                    -
                                  </button>

                                  {/* Centered borderless input */}
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
                                      const newVal = currentVal + 1;
                                      handleStockInputChange(c.id, newVal.toString());
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

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs">
          <div className="bg-white border border-stone rounded-xl shadow-lg max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-6">
              <div className="flex items-center gap-3 text-red-600 mb-2">
                <svg className="w-6 h-6 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <h4 className="font-semibold text-ink text-lg">Confirm Deletion</h4>
              </div>
              <p className="text-sm text-muted">
                Are you sure you want to permanently delete this product? This action will:
              </p>
              <ul className="list-disc list-inside text-xs text-muted mt-2 space-y-1 ml-1">
                <li>Permanently remove it from Saleor catalog.</li>
                <li>Delete it from the Supabase database.</li>
                <li>Cascade and delete all color variations and stock records.</li>
                <li>Send an administrative alert email notification.</li>
              </ul>
              <p className="text-xs font-bold text-red-600 mt-3">
                This action is irreversible.
              </p>
            </div>
            <div className="bg-stone-50 px-6 py-4 flex justify-end gap-3 border-t border-stone">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(null)}
                disabled={isDeletingProductId !== null}
                id="cancel-delete-btn"
                className="px-4 py-2 text-xs font-medium text-ink bg-white border border-stone rounded-md hover:bg-stone-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => localProducts.find(p => p.id === showDeleteConfirm) && handleDeleteProduct(showDeleteConfirm)}
                disabled={isDeletingProductId !== null}
                id="confirm-delete-btn"
                className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-md transition-colors cursor-pointer flex items-center gap-1.5 active:scale-95"
              >
                {isDeletingProductId !== null ? "Deleting..." : "Permanently Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

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

      {/* Create Fabric Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white border border-stone rounded-xl shadow-lg max-w-lg w-full my-8 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-stone flex justify-between items-center bg-stone-50/50">
              <h4 className="font-semibold text-ink text-base">Create Fabric Article</h4>
              <button
                onClick={() => setShowAddModal(false)}
                id="close-add-modal-btn"
                className="text-stone-400 hover:text-ink transition-colors cursor-pointer"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleCreateProductSubmit} className="p-6 space-y-4">
              {addError && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-4 py-3 rounded-lg font-medium">
                  ⚠️ {addError}
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                {/* Name */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-ink">Fabric Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Imperial Cotton"
                    value={addFormName}
                    onChange={(e) => handleNameChange(e.target.value)}
                    id="new-product-name"
                    className="w-full border border-stone rounded px-3 py-2 text-sm text-ink bg-white focus:border-ink focus:outline-none transition-colors"
                  />
                </div>

                {/* Slug */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-ink">Slug / Identifier</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. imperial-cotton"
                    value={addFormSlug}
                    onChange={(e) => setAddFormSlug(e.target.value)}
                    id="new-product-slug"
                    className="w-full border border-stone rounded px-3 py-2 text-sm text-ink bg-white font-mono focus:border-ink focus:outline-none transition-colors"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {/* Category */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-ink">Category</label>
                  <select
                    value={addFormCategory}
                    onChange={(e) => setAddFormCategory(e.target.value)}
                    id="new-product-category"
                    className="w-full border border-stone rounded px-3 py-2 text-sm text-ink bg-white focus:border-ink focus:outline-none transition-colors cursor-pointer"
                  >
                    <option value="cotton">Cotton</option>
                    <option value="linen">Linen</option>
                    <option value="wool">Wool</option>
                    <option value="silk">Silk</option>
                    <option value="blended">Blended</option>
                  </select>
                </div>

                {/* Price */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-ink">Suit Price (PKR)</label>
                  <input
                    type="number"
                    required
                    min="0"
                    placeholder="e.g. 7500"
                    value={addFormPrice}
                    onChange={(e) => setAddFormPrice(e.target.value)}
                    id="new-product-price"
                    className="w-full border border-stone rounded px-3 py-2 text-sm text-ink bg-white focus:border-ink focus:outline-none transition-colors"
                  />
                </div>
              </div>

              {/* Composition */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-ink">Composition</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 100% Egyptian Giza Cotton"
                  value={addFormComposition}
                  onChange={(e) => setAddFormComposition(e.target.value)}
                  id="new-product-composition"
                  className="w-full border border-stone rounded px-3 py-2 text-sm text-ink bg-white focus:border-ink focus:outline-none transition-colors"
                />
              </div>

              {/* Description */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-ink">Description</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Describe the fabric's look, texture, feel, and recommended season..."
                  value={addFormDescription}
                  onChange={(e) => setAddFormDescription(e.target.value)}
                  id="new-product-description"
                  className="w-full border border-stone rounded px-3 py-2 text-sm text-ink bg-white focus:border-ink focus:outline-none transition-colors resize-none"
                />
              </div>

              {/* Info notice about default colors */}
              <div className="bg-stone-50 border border-stone/50 rounded-lg p-3 text-xs text-muted flex items-start gap-2">
                <svg className="w-4 h-4 text-stone-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <span className="font-semibold text-ink">Note:</span> Creating this article will automatically seed default <strong>White</strong> and <strong>Black</strong> color variations, each with an initial stock level of <strong>10</strong> to simplify catalog setup.
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  disabled={isSubmittingAdd}
                  id="cancel-add-btn"
                  className="px-4 py-2 text-xs font-medium text-ink bg-white border border-stone rounded-md hover:bg-stone-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingAdd}
                  id="submit-add-btn"
                  className="px-4 py-2 text-xs font-bold text-paper bg-ink hover:bg-stone-900 rounded-md transition-colors cursor-pointer flex items-center gap-1.5 active:scale-95"
                >
                  {isSubmittingAdd ? "Creating..." : "Create Product"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
