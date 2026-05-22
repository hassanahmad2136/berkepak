import Link from "next/link";
import { createSupabaseServer } from "@/lib/supabase/server";
import { CheckoutFlow } from "./CheckoutFlow";
import { isSupabaseConfigured, SetupNotice } from "@/components/SetupNotice";

export default async function CheckoutPage() {
  if (!isSupabaseConfigured()) {
    return <SetupNotice feature="Checkout" />;
  }
  const supabase = await createSupabaseServer();
  const { data: userData } = await supabase.auth.getUser();

  if (!userData.user) {
    return (
      <div className="mx-auto max-w-md px-4 sm:px-8 py-24 text-center">
        <p className="display text-3xl">Sign in to check out.</p>
        <p className="mt-3 text-sm text-muted">
          Track orders, save addresses, and upload receipts in one place.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link href="/login?next=/checkout" className="btn btn-primary">
            Sign In
          </Link>
          <Link href="/signup" className="btn btn-ghost">
            Create Account
          </Link>
        </div>
      </div>
    );
  }

  const [{ data: profile }, { data: defaultAddress }] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name, phone")
      .eq("id", userData.user.id)
      .maybeSingle(),
    supabase
      .from("addresses")
      .select("*")
      .eq("user_id", userData.user.id)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  return (
    <CheckoutFlow
      userEmail={userData.user.email ?? ""}
      defaults={{
        fullName: defaultAddress?.full_name ?? profile?.full_name ?? "",
        phone: defaultAddress?.phone ?? profile?.phone ?? "",
        line1: defaultAddress?.line1 ?? "",
        line2: defaultAddress?.line2 ?? "",
        city: defaultAddress?.city ?? "",
        province: defaultAddress?.province ?? "",
        postalCode: defaultAddress?.postal_code ?? "",
      }}
    />
  );
}
