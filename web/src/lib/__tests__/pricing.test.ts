import { describe, it, expect, afterEach, vi } from "vitest";
import { activeGatewayFeePercent, basisFor, listedPrice, priceOn } from "@/lib/pricing";
import { SITE } from "@/lib/site";

const PCT = SITE.payments.gatewayFeePercent;

afterEach(() => vi.unstubAllEnvs());

describe("gross-up arithmetic", () => {
  it("leaves the stored price after the gateway takes its cut", () => {
    for (const net of [1, 99, 3000, 3690, 4400, 13_990]) {
      const listed = listedPrice(net, PCT);
      // The gateway charges its percentage of what it collects, not of net.
      const afterFee = listed - (listed * PCT) / 100;
      expect(afterFee).toBeGreaterThanOrEqual(net);
      // Rounding up costs the customer at most a rupee, never more.
      expect(afterFee).toBeLessThan(net + 1);
    }
  });

  it("matches the worked example: PKR 3,000 net is listed at 3,158 on a 5% fee", () => {
    expect(listedPrice(3000, 5)).toBe(3158);
  });

  it("never lists below net, and lists in whole rupees", () => {
    for (const net of [1, 99, 3690, 4400, 13_990]) {
      const listed = listedPrice(net, PCT);
      expect(listed).toBeGreaterThanOrEqual(net);
      expect(Number.isInteger(listed)).toBe(true);
    }
  });
});

describe("the online payment switch", () => {
  it("folds no fee in while online payment is off, so listed equals net", () => {
    vi.stubEnv("NEXT_PUBLIC_ONLINE_PAYMENTS", "false");
    expect(activeGatewayFeePercent()).toBe(0);
    expect(listedPrice(3690)).toBe(3690);
    expect(priceOn(3690, "listed")).toBe(priceOn(3690, "net"));
  });

  it("treats anything but an explicit \"true\" as off", () => {
    vi.stubEnv("NEXT_PUBLIC_ONLINE_PAYMENTS", "1");
    expect(activeGatewayFeePercent()).toBe(0);
  });

  it("grosses listed prices up once online payment is on", () => {
    vi.stubEnv("NEXT_PUBLIC_ONLINE_PAYMENTS", "true");
    expect(activeGatewayFeePercent()).toBe(PCT);
    expect(listedPrice(3000)).toBe(listedPrice(3000, PCT));
  });
});

describe("price books", () => {
  it("charges direct bank transfer net and every other method listed", () => {
    expect(basisFor("bank_transfer")).toBe("net");
    expect(basisFor("online")).toBe("listed");
    expect(basisFor("cod")).toBe("listed");
    expect(priceOn(3000, "net")).toBe(3000);
    expect(priceOn(3000, "listed")).toBe(listedPrice(3000));
  });
});
