import "server-only";
import { query } from "@/lib/db";
import { mapCampaignRow, type Campaign } from "./campaigns";

/**
 * Database half of campaigns. Split out from lib/campaigns.ts so that the pure
 * pricing helpers there stay importable from client components.
 */
export async function getActiveCampaigns(): Promise<Campaign[]> {
  const rows = await query(
    `select id, name, discount_type, discount_value, scope,
            category_targets, product_targets, priority,
            is_active, starts_at, ends_at, created_at
       from campaigns
      where is_active = true
        and (starts_at is null or starts_at <= now())
        and (ends_at   is null or ends_at   >= now())
      order by priority desc, created_at desc`,
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return rows.map((r) => mapCampaignRow(r as any));
}
