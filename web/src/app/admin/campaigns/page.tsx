import { createSupabaseAdmin } from "@/lib/supabase/server";
import { CampaignsDashboardClient } from "./CampaignsDashboardClient";

export const dynamic = "force-dynamic";

export type CampaignRecord = {
  id: string;
  name: string;
  discount_type: "pct" | "fixed";
  discount_value: number;
  scope: "all" | "categories" | "products";
  category_targets: string[];
  product_targets: string[];
  priority: number;
  is_active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
};

export type ProductPickerItem = {
  id: string;
  name: string;
  category: string;
};

export default async function CampaignsPage() {
  const admin = createSupabaseAdmin();

  const [campaignsRes, productsRes] = await Promise.all([
    admin
      .from("campaigns")
      .select("id, name, discount_type, discount_value, scope, category_targets, product_targets, priority, is_active, starts_at, ends_at, created_at")
      .order("priority", { ascending: false })
      .order("created_at", { ascending: false }),
    admin
      .from("product_catalog")
      .select("id, name, category")
      .eq("is_active", true)
      .order("name", { ascending: true }),
  ]);

  const campaigns = (campaignsRes.data ?? []) as CampaignRecord[];
  const products = (productsRes.data ?? []) as ProductPickerItem[];

  return (
    <CampaignsDashboardClient
      campaigns={campaigns}
      products={products}
      fetchError={campaignsRes.error?.message ?? null}
    />
  );
}
