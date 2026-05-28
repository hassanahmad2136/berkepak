export type FabricWeave = "plain" | "twill" | "satin" | "jacquard" | "dobby";
export type FabricCategory = "cotton" | "linen" | "wool" | "silk" | "blended";
export type SaleUnit = "meter" | "suit";
export type Stitching = "none" | "bespoke";

export const BESPOKE_STITCHING_ADDON_PKR = 4500;

export interface Product {
  id: string;
  slug: string;
  name: string;
  category: FabricCategory;
  weave: FabricWeave;
  gsm: number;
  threadCount?: number;
  composition: string;
  colorName: string;
  colorHex: string;
  pricePerMeter: number;
  pricePerSuit: number;
  metersPerSuit: number;
  images: string[];
  shortDescription: string;
  description: string;
  isNew?: boolean;
  isFeatured?: boolean;
  available: boolean;
  meterVariantId?: string;
  suitVariantId?: string;
}

export interface CartLine {
  productId: string;
  productSlug?: string;
  unit: SaleUnit;
  quantity: number;
  stitching: Stitching;
  color: string;
  /** Discounted unit price stored at add-to-cart time. Overrides live product price in lineSubtotal. */
  unitPriceOverride?: number;
}

export interface Address {
  fullName: string;
  phone: string;
  line1: string;
  line2?: string;
  city: string;
  province: string;
  postalCode: string;
  country: "Pakistan";
}

export type PaymentMethod = "cod" | "bank_transfer";

export interface CheckoutDraft {
  address: Address | null;
  paymentMethod: PaymentMethod | null;
  otpVerified: boolean;
}
