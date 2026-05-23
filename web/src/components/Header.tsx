import Link from "next/link";
import { createSupabaseServer } from "@/lib/supabase/server";
import { HeaderClient } from "./HeaderClient";
import { isSupabaseConfigured } from "./SetupNotice";
import { getProducts } from "@/lib/products";
import { isCurrentUserAdmin } from "@/lib/admin";

const NAV_LINKS = [
  { href: "/shop", label: "Shop All" },
  { href: "/shop?category=cotton", label: "Cotton" },
  { href: "/shop?category=linen", label: "Linen" },
  { href: "/shop?category=wool", label: "Wool" },
  { href: "/shop?category=silk", label: "Silk" },
];

export async function Header() {
  let signedIn = false;
  let isAdmin = false;
  if (isSupabaseConfigured()) {
    try {
      const supabase = await createSupabaseServer();
      const { data } = await supabase.auth.getUser();
      signedIn = !!data.user;
      if (signedIn) {
        isAdmin = await isCurrentUserAdmin();
      }
    } catch {
      signedIn = false;
    }
  }

  // Fetch all products for search and map to a lightweight data structure
  let searchableProducts: any[] = [];
  try {
    const rawProducts = await getProducts();
    searchableProducts = (rawProducts ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      category: p.category,
      weave: p.weave,
      composition: p.composition,
      pricePerSuit: p.pricePerSuit,
      image: p.images?.[0] ?? "",
    }));
  } catch (err) {
    console.error("Failed to load products for search in Header:", err);
  }

  return (
    <HeaderClient
      navLinks={NAV_LINKS}
      signedIn={signedIn}
      isAdmin={isAdmin}
      products={searchableProducts}
    />
  );
}

export { Link };

