import Link from "next/link";
import { createSupabaseServer } from "@/lib/supabase/server";
import { HeaderClient } from "./HeaderClient";
import { isSupabaseConfigured } from "./SetupNotice";

const NAV_LINKS = [
  { href: "/shop", label: "Shop All" },
  { href: "/shop?category=cotton", label: "Cotton" },
  { href: "/shop?category=linen", label: "Linen" },
  { href: "/shop?category=wool", label: "Wool" },
  { href: "/shop?category=silk", label: "Silk" },
];

export async function Header() {
  let signedIn = false;
  if (isSupabaseConfigured()) {
    try {
      const supabase = await createSupabaseServer();
      const { data } = await supabase.auth.getUser();
      signedIn = !!data.user;
    } catch {
      signedIn = false;
    }
  }
  return <HeaderClient navLinks={NAV_LINKS} signedIn={signedIn} />;
}

export { Link };
