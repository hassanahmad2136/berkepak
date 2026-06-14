import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock next/cache
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

// Mock next/headers (used by checkRateLimit)
vi.mock("next/headers", () => ({
  headers: vi.fn(() => ({
    get: vi.fn(() => "127.0.0.1"),
  })),
}));

// Mock supabase clients
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServer: vi.fn(),
  createSupabaseAdmin: vi.fn(),
}));

// Mock rate limiting — allow by default
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ success: true }),
}));

// Mock product fetching
vi.mock("@/lib/products", () => ({
  getProductByIdAsync: vi.fn(),
}));

// Mock campaigns
vi.mock("@/lib/campaigns", () => ({
  getActiveCampaigns: vi.fn().mockResolvedValue([]),
  getCampaignForProduct: vi.fn().mockReturnValue(null),
  computeDiscount: vi.fn(),
}));

// Mock email
vi.mock("@/lib/actions/email-actions", () => ({
  sendOrderConfirmationEmail: vi.fn().mockResolvedValue(undefined),
}));

import { placeOrder } from "@/lib/actions/orders";
import { createSupabaseServer, createSupabaseAdmin } from "@/lib/supabase/server";
import { getProductByIdAsync } from "@/lib/products";
import { getActiveCampaigns } from "@/lib/campaigns";
import { checkRateLimit } from "@/lib/rate-limit";

const mockCreateSupabaseServer = vi.mocked(createSupabaseServer);
const mockCreateSupabaseAdmin = vi.mocked(createSupabaseAdmin);
const mockGetProductByIdAsync = vi.mocked(getProductByIdAsync);
const mockGetActiveCampaigns = vi.mocked(getActiveCampaigns);
const mockCheckRateLimit = vi.mocked(checkRateLimit);

// ── Shared test fixtures ──────────────────────────────────────────────────────

const validAddress = {
  fullName: "Test User",
  phone: "+921234567890",
  line1: "123 Test Street, Lahore",
  city: "Lahore",
  province: "Punjab",
  postalCode: "54000",
  country: "Pakistan" as const,
};

const validProduct = {
  id: "5f5f38e1-6b67-4c37-a62f-da340ce667f2",
  slug: "test-fabric",
  name: "Test Fabric",
  category: "cotton" as const,
  weave: "plain" as const,
  gsm: 200,
  composition: "100% Cotton",
  colorName: "White",
  colorHex: "#FFFFFF",
  pricePerMeter: 500,
  pricePerSuit: 12000,
  metersPerSuit: 3.5,
  images: [],
  shortDescription: "A test fabric",
  description: "A test fabric description",
  available: true,
};

const validLine = {
  productId: "5f5f38e1-6b67-4c37-a62f-da340ce667f2",
  quantity: 1,
  unit: "suit" as const,
  stitching: "none" as const,
  color: "White",
};

function makeServerClient(user: { id: string; email?: string } | null) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user } }),
    },
  } as any;
}

function makeAdminClient({
  otpRow = null as any,
  rpcError = null as any,
  promoData = null as any,
} = {}) {
  // otpRow is for OTP check, promoData for promotions
  const maybeSingleMock = vi.fn();

  // We need from() to behave differently based on table name
  return {
    from: vi.fn().mockImplementation((table: string) => {
      if (table === "otp_codes") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          not: vi.fn().mockReturnThis(),
          gte: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: otpRow, error: null }),
        };
      }
      if (table === "promotions") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: promoData, error: null }),
        };
      }
      // Default fallback
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        not: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        maybeSingle: maybeSingleMock.mockResolvedValue({ data: null, error: null }),
      };
    }),
    rpc: vi.fn().mockResolvedValue({ error: rpcError }),
  } as any;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("placeOrder", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckRateLimit.mockResolvedValue({ success: true });
    mockGetActiveCampaigns.mockResolvedValue([]);
  });

  it("returns ok:false when user is not authenticated", async () => {
    mockCreateSupabaseServer.mockResolvedValue(makeServerClient(null));
    mockCreateSupabaseAdmin.mockReturnValue(makeAdminClient());

    const result = await placeOrder({
      lines: [validLine],
      address: validAddress,
      paymentMethod: "bank_transfer",
    });

    expect(result.ok).toBe(false);
    expect((result as any).error).toMatch(/sign in/i);
  });

  it("returns ok:false when cart is empty", async () => {
    mockCreateSupabaseServer.mockResolvedValue(
      makeServerClient({ id: "user-1", email: "buyer@example.com" }),
    );
    mockCreateSupabaseAdmin.mockReturnValue(makeAdminClient());

    // PlaceOrderSchema requires min 1 item, so validation rejects before auth check
    const result = await placeOrder({
      lines: [],
      address: validAddress,
      paymentMethod: "bank_transfer",
    });

    expect(result.ok).toBe(false);
    // Zod validation fires first: "Cart is empty."
    expect((result as any).error).toBeTruthy();
  });

  it("returns ok:false when COD payment has no recent consumed OTP", async () => {
    mockCreateSupabaseServer.mockResolvedValue(
      makeServerClient({ id: "user-2", email: "buyer@example.com" }),
    );
    // otpRow = null → no consumed OTP found
    mockCreateSupabaseAdmin.mockReturnValue(makeAdminClient({ otpRow: null }));

    const result = await placeOrder({
      lines: [validLine],
      address: validAddress,
      paymentMethod: "cod",
    });

    expect(result.ok).toBe(false);
    expect((result as any).error).toMatch(/verified/i);
  });

  it("returns ok:true with orderId and total for a valid bank_transfer order (no campaign, no promo)", async () => {
    mockCreateSupabaseServer.mockResolvedValue(
      makeServerClient({ id: "user-3", email: "buyer@example.com" }),
    );
    mockCreateSupabaseAdmin.mockReturnValue(makeAdminClient({ rpcError: null }));
    mockGetProductByIdAsync.mockResolvedValue(validProduct);

    const result = await placeOrder({
      lines: [validLine],
      address: validAddress,
      paymentMethod: "bank_transfer",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.orderId).toMatch(/^BPK-/);
      // 1 suit at 12000, original subtotal >= 10000 → free shipping
      expect(result.total).toBe(12000);
    }
  });

  it("returns ok:false when place_order_atomic RPC returns an error", async () => {
    mockCreateSupabaseServer.mockResolvedValue(
      makeServerClient({ id: "user-4", email: "buyer@example.com" }),
    );
    mockCreateSupabaseAdmin.mockReturnValue(
      makeAdminClient({ rpcError: { message: "Insufficient stock" } }),
    );
    mockGetProductByIdAsync.mockResolvedValue(validProduct);

    const result = await placeOrder({
      lines: [validLine],
      address: validAddress,
      paymentMethod: "bank_transfer",
    });

    expect(result.ok).toBe(false);
    expect((result as any).error).toMatch(/insufficient stock/i);
  });
});
