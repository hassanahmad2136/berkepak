import { createSupabaseAdmin } from "@/lib/supabase/server";
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
  const admin = createSupabaseAdmin();
  const { data, error } = await admin
    .from("promotions")
    .select("id, type, title, body, code, discount_type, discount_value, min_order_amount, is_active, starts_at, ends_at, created_at")
    .order("created_at", { ascending: false });

  const promotions: PromotionRow[] = (data as PromotionRow[]) ?? [];

  return <PromotionsDashboardClient promotions={promotions} fetchError={error?.message ?? null} />;
}
