"use client";

import { useTransition } from "react";
import { useCart } from "@/lib/cart-store";
import { logoutAction } from "@/lib/actions/auth";

export function LogoutButton() {
  const clearCart = useCart((s) => s.clear);
  const [pending, start] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        clearCart();
        start(() => logoutAction());
      }}
      className="text-left px-3 py-2 link-underline text-muted whitespace-nowrap w-full disabled:opacity-50"
    >
      {pending ? "Signing out…" : "Sign out"}
    </button>
  );
}
