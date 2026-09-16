import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("next/headers", () => ({
  headers: vi.fn(() => ({ get: vi.fn(() => "127.0.0.1") })),
}));

vi.mock("@/lib/db", () => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  transaction: vi.fn(),
  pool: {},
}));

vi.mock("@/lib/auth/guards", () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock("@/lib/products", () => ({
  getProductByIdAsync: vi.fn(),
}));

vi.mock("@/lib/campaigns.server", () => ({
  getActiveCampaigns: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/lib/campaigns", () => ({
  getCampaignForProduct: vi.fn().mockReturnValue(null),
  computeDiscount: vi.fn(),
}));

vi.mock("@/lib/actions/email-actions", () => ({
  sendOrderConfirmationEmail: vi.fn().mockResolvedValue(undefined),
}));

import { placeOrder } from "@/lib/actions/orders";
import { listedPrice } from "@/lib/pricing";
import { query, queryOne } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/guards";
import { getProductByIdAsync } from "@/lib/products";
import { checkRateLimit } from "@/lib/rate-limit";

const mockQuery = vi.mocked(query);
const mockQueryOne = vi.mocked(queryOne);
const mockGetCurrentUser = vi.mocked(getCurrentUser);
const mockGetProductByIdAsync = vi.mocked(getProductByIdAsync);
const mockCheckRateLimit = vi.mocked(checkRateLimit);

// ── Shared fixtures ─────────────────────────────────────────────────────────

const validAddress = {
  fullName: "Test User",
  phone: "+921234567890",
  line1: "123 Test Street, Lahore",
  city: "Lahore",
  province: "Punjab",
  postalCode: "54000",
  country: "Pakistan" as const,
};

const signedInUser = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "customer@berkepak.test",
  fullName: "Test User",
  phone: "+921234567890",
  emailVerifiedAt: new Date(),
};

// The catalog stores the net price; the storefront and every method but bank
// transfer charge the listed price with the gateway fee folded in.
const NET_SUIT = 4400;
const LISTED_SUIT = listedPrice(NET_SUIT);

const product = {
  id: "22222222-2222-4222-8222-222222222222",
  slug: "shahi-wash",
  name: "Shahi Wash",
  category: "fabric" as const,
  weave: "plain" as const,
  gsm: 140,
  composition: "100% Cotton",
  colorName: "White",
  colorHex: "#FFFFFF",
  pricePerMeter: listedPrice(1600),
  pricePerSuit: LISTED_SUIT,
  basePricePerMeter: 1600,
  basePricePerSuit: NET_SUIT,
  metersPerSuit: 2.75,
  images: [],
  shortDescription: "",
  description: "",
  available: true,
};

const line = {
  productId: product.id,
  productSlug: product.slug,
  unit: "suit" as const,
  quantity: 1,
  stitching: "none" as const,
  color: "White",
};

/** OTP lookup resolves first, then the promo lookup (when a coupon is supplied). */
function withConsumedOtp() {
  mockQueryOne.mockResolvedValueOnce({ id: "otp-1" });
}

describe("placeOrder", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckRateLimit.mockResolvedValue({ success: true });
    mockGetCurrentUser.mockResolvedValue(signedInUser);
    mockGetProductByIdAsync.mockResolvedValue(product);
    mockQuery.mockResolvedValue([]);
    mockQueryOne.mockResolvedValue(null);
  });

  it("refuses an anonymous caller who supplies no email", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const result = await placeOrder({
      lines: [line],
      address: validAddress,
      paymentMethod: "cod",
    });
    expect(result).toEqual({
      ok: false,
      error: "An email address is required to place an order.",
    });
  });

  it("lets a guest place an order and hands back a lookup token", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    withConsumedOtp();
    const result = await placeOrder({
      lines: [line],
      address: validAddress,
      paymentMethod: "cod",
      guestEmail: "guest@example.com",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.guestToken).toMatch(/^[0-9a-f]{32}$/);
      expect(result.total).toBe(LISTED_SUIT + 350);
    }
  });

  it("checks a guest's OTP against the email they supplied", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    withConsumedOtp();
    await placeOrder({
      lines: [line],
      address: validAddress,
      paymentMethod: "cod",
      guestEmail: "guest@example.com",
    });
    expect(mockQueryOne).toHaveBeenCalledWith(expect.stringContaining("destination = $1"), [
      "guest@example.com",
    ]);
  });

  it("refuses a guest COD order with no consumed OTP", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    mockQueryOne.mockResolvedValue(null);
    const result = await placeOrder({
      lines: [line],
      address: validAddress,
      paymentMethod: "cod",
      guestEmail: "guest@example.com",
    });
    expect(result.ok).toBe(false);
  });

  it("ignores a supplied guest email when a session exists", async () => {
    withConsumedOtp();
    const result = await placeOrder({
      lines: [line],
      address: validAddress,
      paymentMethod: "cod",
      guestEmail: "attacker@example.com",
    });
    expect(result.ok).toBe(true);
    // The OTP is checked against the account email, never the client's.
    expect(mockQueryOne).toHaveBeenCalledWith(expect.stringContaining("destination = $1"), [
      signedInUser.email,
    ]);
    // A signed-in order is not a guest order.
    if (result.ok) expect(result.guestToken).toBeUndefined();
  });

  it("rejects a malformed guest email", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const result = await placeOrder({
      lines: [line],
      address: validAddress,
      paymentMethod: "cod",
      guestEmail: "not-an-email",
    });
    expect(result.ok).toBe(false);
  });

  it("refuses an empty cart", async () => {
    const result = await placeOrder({
      lines: [],
      address: validAddress,
      paymentMethod: "cod",
    });
    expect(result.ok).toBe(false);
  });

  it("refuses COD when no OTP was consumed recently", async () => {
    mockQueryOne.mockResolvedValue(null);
    const result = await placeOrder({
      lines: [line],
      address: validAddress,
      paymentMethod: "cod",
    });
    expect(result).toEqual({
      ok: false,
      error: "Email address must be verified for Cash on Delivery.",
    });
  });

  it("checks the OTP against the signed-in email, not client input", async () => {
    withConsumedOtp();
    await placeOrder({ lines: [line], address: validAddress, paymentMethod: "cod" });
    expect(mockQueryOne).toHaveBeenCalledWith(
      expect.stringContaining("destination = $1"),
      [signedInUser.email],
    );
  });

  it("places a COD order once the OTP has been consumed", async () => {
    withConsumedOtp();
    const result = await placeOrder({
      lines: [line],
      address: validAddress,
      paymentMethod: "cod",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.orderId).toMatch(/^BPK-[0-9A-F]{8}$/);
      // listed suit + 350 shipping, below the free-shipping threshold
      expect(result.total).toBe(LISTED_SUIT + 350);
    }
  });

  it("waives shipping above the threshold", async () => {
    withConsumedOtp();
    const result = await placeOrder({
      lines: [{ ...line, quantity: 3 }], // 13,200 net: over the free-shipping line
      address: validAddress,
      paymentMethod: "cod",
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.total).toBe(LISTED_SUIT * 3);
  });

  it("does not require an OTP for bank transfer", async () => {
    const result = await placeOrder({
      lines: [line],
      address: validAddress,
      paymentMethod: "bank_transfer",
    });
    expect(result.ok).toBe(true);
  });

  it("surfaces an insufficient-stock rollback as an error", async () => {
    withConsumedOtp();
    mockQuery.mockRejectedValueOnce(
      new Error("Insufficient stock for product Shahi Wash (color: White)"),
    );
    const result = await placeOrder({
      lines: [line],
      address: validAddress,
      paymentMethod: "cod",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/insufficient stock/i);
  });

  it("prices from the catalog, ignoring any client-supplied override", async () => {
    withConsumedOtp();
    const result = await placeOrder({
      lines: [{ ...line, unitPriceOverride: 1 }],
      address: validAddress,
      paymentMethod: "cod",
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.total).toBe(LISTED_SUIT + 350);
  });

  it("refuses when the rate limit trips", async () => {
    mockCheckRateLimit.mockResolvedValue({ success: false, error: "Too many requests." });
    const result = await placeOrder({
      lines: [line],
      address: validAddress,
      paymentMethod: "cod",
    });
    expect(result.ok).toBe(false);
  });
});

describe("placeOrder pricing by payment method", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckRateLimit.mockResolvedValue({ success: true });
    mockGetCurrentUser.mockResolvedValue(signedInUser);
    mockGetProductByIdAsync.mockResolvedValue(product);
    mockQuery.mockResolvedValue([]);
    mockQueryOne.mockResolvedValue(null);
  });

  // place_order_atomic($1 … $14): [9] is total, [12] the items, [13] the surcharge.
  const atomicArgs = () =>
    mockQuery.mock.calls.find(([sql]) => String(sql).includes("place_order_atomic"))![1] as unknown[];

  it("charges direct bank transfer the stored catalog price, with no surcharge", async () => {
    const result = await placeOrder({
      lines: [line],
      address: validAddress,
      paymentMethod: "bank_transfer",
    });
    expect(result.ok && result.total).toBe(NET_SUIT + 350);
    expect(atomicArgs()[9]).toBe(NET_SUIT + 350);
    expect(atomicArgs()[13]).toBe(0);
  });

  it("charges online payment the listed price and records the fee inside it", async () => {
    const result = await placeOrder({
      lines: [line],
      address: validAddress,
      paymentMethod: "online",
    });
    expect(result.ok && result.total).toBe(LISTED_SUIT + 350);
    expect(atomicArgs()[9]).toBe(LISTED_SUIT + 350);
    expect(atomicArgs()[13]).toBe(LISTED_SUIT - NET_SUIT);
  });

  it("stores listed unit prices on online order items, net ones on bank transfer", async () => {
    await placeOrder({ lines: [line], address: validAddress, paymentMethod: "online" });
    const onlineItems = JSON.parse(String(atomicArgs()[12])) as Array<{ unit_price: number }>;
    expect(onlineItems[0].unit_price).toBe(LISTED_SUIT);

    mockQuery.mockClear();
    await placeOrder({ lines: [line], address: validAddress, paymentMethod: "bank_transfer" });
    const bankItems = JSON.parse(String(atomicArgs()[12])) as Array<{ unit_price: number }>;
    expect(bankItems[0].unit_price).toBe(NET_SUIT);
  });

  it("judges free shipping on the net subtotal, so paying the fee never earns free delivery", async () => {
    // 3 × 3,300 = 9,900 net — under the line, even where the listed total crosses it.
    mockGetProductByIdAsync.mockResolvedValue({
      ...product,
      basePricePerSuit: 3300,
      pricePerSuit: listedPrice(3300),
    });

    const online = await placeOrder({
      lines: [{ ...line, quantity: 3 }],
      address: validAddress,
      paymentMethod: "online",
    });
    expect(online.ok && online.total).toBe(listedPrice(3300) * 3 + 350);

    const bank = await placeOrder({
      lines: [{ ...line, quantity: 3 }],
      address: validAddress,
      paymentMethod: "bank_transfer",
    });
    expect(bank.ok && bank.total).toBe(9_900 + 350);
  });
});
