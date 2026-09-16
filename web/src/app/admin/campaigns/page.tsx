import { query } from "@/lib/db";
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
  let campaigns: CampaignRecord[] = [];
  let products: ProductPickerItem[] = [];
  let fetchError: string | null = null;

  try {
    [campaigns, products] = await Promise.all([
      query(
        `select id, name, discount_type, discount_value, scope, category_targets,
                product_targets, priority, is_active, starts_at, ends_at, created_at
           from campaigns
          order by priority desc, created_at desc`,
      ) as unknown as Promise<CampaignRecord[]>,
      query(
        `select id, name, category from product_catalog
          where is_active = true order by name asc`,
      ) as unknown as Promise<ProductPickerItem[]>,
    ]);
  } catch (err) {
    fetchError = err instanceof Error ? err.message : "Failed to load campaigns.";
  }

  return (
    <CampaignsDashboardClient
      campaigns={campaigns}
      products={products}
      fetchError={fetchError}
    />
  );
}
