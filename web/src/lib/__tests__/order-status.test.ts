import { describe, it, expect } from "vitest";
import {
  ORDER_FLOW,
  canShip,
  isCancellable,
  nextStatus,
  type OrderStatus,
} from "@/lib/order-status";

describe("order lifecycle", () => {
  it("walks the flow one step at a time and stops at delivered", () => {
    expect(nextStatus("unconfirmed")).toBe("confirmed");
    expect(nextStatus("confirmed")).toBe("fulfilled");
    expect(nextStatus("fulfilled")).toBe("shipped");
    expect(nextStatus("shipped")).toBe("delivered");
    expect(nextStatus("delivered")).toBeNull();
  });

  it("offers nothing from cancelled or an unknown status", () => {
    expect(nextStatus("cancelled")).toBeNull();
    expect(nextStatus("refunded-by-hand")).toBeNull();
  });

  it("never skips a step", () => {
    for (const from of ORDER_FLOW) {
      const to = nextStatus(from);
      if (!to) continue;
      expect(ORDER_FLOW.indexOf(to) - ORDER_FLOW.indexOf(from)).toBe(1);
    }
  });

  it("allows cancelling only before the courier has it", () => {
    const cancellable: OrderStatus[] = ["unconfirmed", "confirmed", "fulfilled"];
    const not: OrderStatus[] = ["shipped", "delivered", "cancelled"];
    cancellable.forEach((s) => expect(isCancellable(s)).toBe(true));
    not.forEach((s) => expect(isCancellable(s)).toBe(false));
  });

  it("ships cash on delivery unpaid, and everything else only once paid", () => {
    expect(canShip("cod", "pending")).toBe(true);
    expect(canShip("bank_transfer", "awaiting_review")).toBe(false);
    expect(canShip("bank_transfer", "paid")).toBe(true);
    expect(canShip("online", "pending")).toBe(false);
    expect(canShip("online", "paid")).toBe(true);
  });
});
