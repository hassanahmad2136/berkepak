/**
 * The switch for online payment (PayFast).
 *
 * Off unless NEXT_PUBLIC_ONLINE_PAYMENTS is exactly "true". While it is off,
 * checkout offers only direct bank transfer and cash on delivery, the server
 * refuses "online" orders, and no gateway fee is folded into listed prices.
 * The PayFast integration itself stays in place for when it is switched on.
 *
 * NEXT_PUBLIC_ so the browser, which renders prices too, reads the same value
 * as the server. Next inlines it at build time: restart or rebuild after
 * changing it. The expression must stay literal for that inlining to happen.
 */
export function onlinePaymentsEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ONLINE_PAYMENTS === "true";
}
