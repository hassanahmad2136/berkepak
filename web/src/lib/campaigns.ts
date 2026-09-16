
export type Campaign = {
  id: string;
  name: string;
  discountType: "pct" | "fixed";
  discountValue: number;
  scope: "all" | "categories" | "products";
  categoryTargets: string[];
  productTargets: string[];
  priority: number;
  isActive: boolean;
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string;
};

export type ProductDiscount = {
  campaignId: string;
  campaignName: string;
  discountedPricePerSuit: number;
  discountedPricePerMeter: number;
  discountPct: number;
  savedAmountPerSuit: number;
  label: string;
};

interface CampaignRow {
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
}

export function mapCampaignRow(row: CampaignRow): Campaign {
  return {
    id: row.id,
    name: row.name,
    discountType: row.discount_type,
    discountValue: row.discount_value,
    scope: row.scope,
    categoryTargets: row.category_targets ?? [],
    productTargets: row.product_targets ?? [],
    priority: row.priority,
    isActive: row.is_active,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    createdAt: row.created_at,
  };
}

// Returns the highest-priority applicable campaign for a product (campaigns pre-sorted by priority desc)
export function getCampaignForProduct(
  productId: string,
  category: string,
  campaigns: Campaign[],
): Campaign | null {
  for (const c of campaigns) {
    if (c.scope === "all") return c;
    if (c.scope === "categories" && c.categoryTargets.includes(category)) return c;
    if (c.scope === "products" && c.productTargets.includes(productId)) return c;
  }
  return null;
}

export function computeDiscount(
  pricePerSuit: number,
  pricePerMeter: number,
  campaign: Campaign,
): ProductDiscount {
  let discountedPricePerSuit: number;
  let discountedPricePerMeter: number;
  let discountPct: number;
  let savedAmountPerSuit: number;
  let label: string;

  if (campaign.discountType === "pct") {
    const factor = 1 - campaign.discountValue / 100;
    discountedPricePerSuit = Math.round(pricePerSuit * factor);
    discountedPricePerMeter = Math.round(pricePerMeter * factor);
    discountPct = campaign.discountValue;
    savedAmountPerSuit = pricePerSuit - discountedPricePerSuit;
    label = `${campaign.discountValue}% OFF`;
  } else {
    discountedPricePerSuit = Math.max(0, Math.round(pricePerSuit - campaign.discountValue));
    const meterRatio = pricePerSuit > 0 ? pricePerMeter / pricePerSuit : 1;
    discountedPricePerMeter = Math.max(0, Math.round(pricePerMeter - campaign.discountValue * meterRatio));
    discountPct = pricePerSuit > 0 ? Math.round((campaign.discountValue / pricePerSuit) * 100) : 0;
    savedAmountPerSuit = Math.min(campaign.discountValue, pricePerSuit);
    label = `PKR ${campaign.discountValue.toLocaleString()} OFF`;
  }

  return {
    campaignId: campaign.id,
    campaignName: campaign.name,
    discountedPricePerSuit,
    discountedPricePerMeter,
    discountPct,
    savedAmountPerSuit,
    label,
  };
}
