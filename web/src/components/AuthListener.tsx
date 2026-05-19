"use client";

import { useEffect } from "react";
import { createSupabaseBrowser } from "@/lib/supabase/client";
import { useCart } from "@/lib/cart-store";

/**
 * Mounts once at the root. Listens for Supabase auth state changes and clears
 * the cart on SIGNED_OUT — covers explicit logout, session expiry, and
 * logout-from-another-tab.
 */
export function AuthListener() {
  const clearCart = useCart((s) => s.clear);

  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return;
    const supabase = createSupabaseBrowser();
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") clearCart();
    });
    return () => data.subscription.unsubscribe();
  }, [clearCart]);

  return null;
}
