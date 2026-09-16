"use client";

import React from "react";

interface DeleteConfirmModalProps {
  productId: string | null;
  isDeleting: boolean;
  onConfirm: (id: string) => void;
  onClose: () => void;
}

export function DeleteConfirmModal({
  productId,
  isDeleting,
  onConfirm,
  onClose,
}: DeleteConfirmModalProps) {
  if (!productId) return null;

  return (
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
            <li>Permanently remove it from the product catalog.</li>
            <li>Delete it from the database.</li>
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
            onClick={onClose}
            disabled={isDeleting}
            id="cancel-delete-btn"
            className="px-4 py-2 text-xs font-medium text-ink bg-white border border-stone rounded-md hover:bg-stone-50 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(productId)}
            disabled={isDeleting}
            id="confirm-delete-btn"
            className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-md transition-colors cursor-pointer flex items-center gap-1.5 active:scale-95"
          >
            {isDeleting ? "Deleting..." : "Permanently Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}
