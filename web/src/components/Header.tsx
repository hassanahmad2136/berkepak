import Link from "next/link";
import { HeaderClient } from "./HeaderClient";
import { getProducts } from "@/lib/products";
import { unstable_rethrow } from "next/navigation";
import { getCurrentUserWithRole } from "@/lib/auth/guards";

const NAV_LINKS = [
  { href: "/shop", label: "Shop All" },
];

export async function Header() {
  let signedIn = false;
  let isAdmin = false;
  try {
    const { user, admin } = await getCurrentUserWithRole();
    signedIn = !!user;
    isAdmin = admin;
  } catch (err) {
    // Next signals "this route must be dynamic" by throwing; swallowing that
    // would let a signed-out header be cached for everyone.
    unstable_rethrow(err);
    console.error("Header: failed to resolve session:", err);
  }

  // Fetch all products for search and map to a lightweight data structure
  let searchableProducts: Array<{
    id: string;
    name: string;
    slug: string;
    category: string;
    weave: string;
    composition: string;
    pricePerSuit: number;
    image: string;
  }> = [];
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

