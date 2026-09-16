import { describe, it, expect } from "vitest";
import { basisFor, listedPrice, priceOn } from "@/lib/pricing";
import { SITE } from "@/lib/site";

const PCT = SITE.payments.gatewayFeePercent;

describe("price books", () => {
  it("grosses up, so the gateway's cut still leaves the stored price", () => {
    for (const net of [1, 99, 3000, 3690, 4400, 13_990]) {
      const listed = listedPrice(net);
      // The gateway charges its percentage of what it collects, not of net.
      const afterFee = listed - (listed * PCT) / 100;
      expect(afterFee).toBeGreaterThanOrEqual(net);
      // Rounding up costs the customer at most a rupee, never more.
      expect(afterFee).toBeLessThan(net + 1);
    }
  });

  it("matches the worked example: PKR 3,000 net is listed at 3,158 on a 5% fee", () => {
    if (PCT !== 5) return;
    expect(listedPrice(3000)).toBe(3158);
  });

  it("charges direct bank transfer net and every other method listed", () => {
    expect(basisFor("bank_transfer")).toBe("net");
    expect(basisFor("online")).toBe("listed");
    expect(basisFor("cod")).toBe("listed");
    expect(priceOn(3000, "net")).toBe(3000);
    expect(priceOn(3000, "listed")).toBe(listedPrice(3000));
  });

  it("never lists below net, and lists in whole rupees", () => {
    for (const net of [1, 99, 3690, 4400, 13_990]) {
      const listed = listedPrice(net);
      expect(listed).toBeGreaterThanOrEqual(net);
      expect(Number.isInteger(listed)).toBe(true);
    }
  });
});
