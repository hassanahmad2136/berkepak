"use client";

import React from "react";
import type { AddFormState, StockAction } from "./stockReducer";

interface AddProductModalProps {
  addForm: AddFormState;
  isUploadingImage: boolean;
  isSubmittingAdd: boolean;
  addError: string | null;
  dispatch: React.Dispatch<StockAction>;
  onSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
}

export function AddProductModal({
  addForm,
  isUploadingImage,
  isSubmittingAdd,
  addError,
  dispatch,
  onSubmit,
  onClose,
}: AddProductModalProps) {
  const handleNameChange = (val: string) => {
    const generatedSlug = val
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, "")
      .replace(/[\s_-]+/g, "-")
      .replace(/^-+|-+$/g, "");
    dispatch({ type: "ADD_FORM_NAME_WITH_SLUG", name: val, slug: generatedSlug });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white border border-stone rounded-xl shadow-lg max-w-lg w-full my-8 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="px-6 py-4 border-b border-stone flex justify-between items-center bg-stone-50/50">
          <h4 className="font-semibold text-ink text-base">Create Fabric Article</h4>
          <button
            onClick={onClose}
            id="close-add-modal-btn"
            className="text-stone-400 hover:text-ink transition-colors cursor-pointer"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={onSubmit} className="p-6 space-y-4">
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
                placeholder="e.g. Signature Wash"
                value={addForm.name}
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
                placeholder="e.g. signature-wash"
                value={addForm.slug}
                onChange={(e) =>
                  dispatch({ type: "ADD_FORM_FIELD", field: "slug", value: e.target.value })
                }
                id="new-product-slug"
                className="w-full border border-stone rounded px-3 py-2 text-sm text-ink bg-white font-mono focus:border-ink focus:outline-none transition-colors"
              />
            </div>
          </div>

          {/* Price */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-ink">Suit Price (PKR)</label>
            <input
              type="number"
              required
              min="0"
              placeholder="e.g. 7500"
              value={addForm.price}
              onChange={(e) =>
                dispatch({ type: "ADD_FORM_FIELD", field: "price", value: e.target.value })
              }
              id="new-product-price"
              className="w-full border border-stone rounded px-3 py-2 text-sm text-ink bg-white focus:border-ink focus:outline-none transition-colors"
            />
          </div>

          {/* Composition */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-ink">Composition</label>
            <input
              type="text"
              required
              placeholder="e.g. 100% Cotton"
              value={addForm.composition}
              onChange={(e) =>
                dispatch({ type: "ADD_FORM_FIELD", field: "composition", value: e.target.value })
              }
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
              value={addForm.description}
              onChange={(e) =>
                dispatch({ type: "ADD_FORM_FIELD", field: "description", value: e.target.value })
              }
              id="new-product-description"
              className="w-full border border-stone rounded px-3 py-2 text-sm text-ink bg-white focus:border-ink focus:outline-none transition-colors resize-none"
            />
          </div>

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
                dispatch({ type: "ADD_FORM_FIELD", field: "imageFile", value: file });
                if (file) {
                  const reader = new FileReader();
                  reader.onload = (ev) =>
                    dispatch({
                      type: "ADD_FORM_FIELD",
                      field: "imagePreview",
                      value: ev.target?.result as string,
                    });
                  reader.readAsDataURL(file);
                } else {
                  dispatch({ type: "ADD_FORM_FIELD", field: "imagePreview", value: null });
                }
              }}
              className="w-full border border-stone rounded px-3 py-2 text-sm text-ink bg-white focus:border-ink focus:outline-none transition-colors cursor-pointer file:mr-3 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:bg-stone-100 file:text-ink file:cursor-pointer"
            />
            {addForm.imagePreview && (
              <div className="mt-2 relative w-20 h-20 border border-stone rounded overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={addForm.imagePreview} alt="preview" className="w-full h-full object-cover" />
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
                value={addForm.weaveType}
                onChange={(e) =>
                  dispatch({ type: "ADD_FORM_FIELD", field: "weaveType", value: e.target.value })
                }
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
                value={addForm.threadCount}
                onChange={(e) =>
                  dispatch({ type: "ADD_FORM_FIELD", field: "threadCount", value: e.target.value })
                }
                className="w-full border border-stone rounded px-3 py-2 text-sm text-ink bg-white focus:border-ink focus:outline-none transition-colors"
              />
            </div>
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
              onClick={onClose}
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
              {isUploadingImage ? "Uploading image…" : isSubmittingAdd ? "Creating..." : "Create Product"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
