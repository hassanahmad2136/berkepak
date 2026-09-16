import { query } from "@/lib/db";
import { PromotionsDashboardClient } from "./PromotionsDashboardClient";

export const dynamic = "force-dynamic";

export type PromotionRow = {
  id: string;
  type: "banner" | "coupon";
  title: string;
  body: string | null;
  code: string | null;
  discount_type: "pct" | "fixed" | null;
  discount_value: number | null;
  min_order_amount: number;
  is_active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
};

export default async function PromotionsPage() {
  let promotions: PromotionRow[] = [];
  let fetchError: string | null = null;
  try {
    promotions = (await query(
      `select id, type, title, body, code, discount_type, discount_value,
              min_order_amount, is_active, starts_at, ends_at, created_at
         from promotions
        order by created_at desc`,
    )) as unknown as PromotionRow[];
  } catch (err) {
    fetchError = err instanceof Error ? err.message : "Failed to load promotions.";
  }

  return <PromotionsDashboardClient promotions={promotions} fetchError={fetchError} />;
}
