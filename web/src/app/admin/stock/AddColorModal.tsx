"use client";

import React from "react";
import type { StockAction } from "./stockReducer";

interface AddColorModalProps {
  catalogId: string | null;
  addColorName: string;
  addColorStock: string;
  isSubmittingColor: boolean;
  addColorError: string | null;
  dispatch: React.Dispatch<StockAction>;
  onSubmit: () => void;
  onClose: () => void;
}

export function AddColorModal({
  catalogId,
  addColorName,
  addColorStock,
  isSubmittingColor,
  addColorError,
  dispatch,
  onSubmit,
  onClose,
}: AddColorModalProps) {
  if (!catalogId) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs">
      <div className="bg-white border border-stone rounded-xl shadow-lg max-w-sm w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="px-6 py-4 border-b border-stone flex justify-between items-center bg-stone-50/50">
          <h4 className="font-semibold text-ink text-base">Add Color Variant</h4>
          <button
            onClick={onClose}
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
              onChange={(e) =>
                dispatch({ type: "ADD_COLOR_FIELD", field: "addColorName", value: e.target.value })
              }
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
              onChange={(e) =>
                dispatch({ type: "ADD_COLOR_FIELD", field: "addColorStock", value: e.target.value })
              }
              className="w-full border border-stone rounded px-3 py-2 text-sm text-ink bg-white focus:border-ink focus:outline-none transition-colors"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmittingColor}
              className="px-4 py-2 text-xs font-medium text-ink bg-white border border-stone rounded-md hover:bg-stone-50 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onSubmit}
              disabled={isSubmittingColor}
              className="px-4 py-2 text-xs font-bold text-paper bg-ink hover:bg-stone-900 rounded-md transition-colors cursor-pointer flex items-center gap-1.5 active:scale-95"
            >
              {isSubmittingColor ? "Adding..." : "Add Color"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
