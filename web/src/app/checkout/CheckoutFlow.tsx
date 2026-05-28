"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { useCart, cartSubtotal, lineSubtotal } from "@/lib/cart-store";
import { getProductByIdAsync } from "@/lib/products";
import { formatPKR } from "@/lib/format";
import type { Product } from "@/lib/types";
import type { Address, PaymentMethod } from "@/lib/types";
import { sendOtp, verifyOtp } from "@/lib/actions/otp";
import { placeOrder } from "@/lib/actions/orders";
import { validateCoupon } from "@/lib/actions/promotions";
import { ReceiptUploadForm } from "@/app/account/receipts/ReceiptUploadForm";

type Step = 1 | 2 | 3;

type Defaults = {
  fullName: string;
  phone: string;
  line1: string;
  line2: string;
  city: string;
  province: string;
  postalCode: string;
};

export function CheckoutFlow({
  defaults,
  userEmail,
}: {
  defaults: Defaults;
  userEmail: string;
}) {
  const { lines, clear } = useCart();
  const [productMap, setProductMap] = useState<Map<string, Product>>(new Map());
  const [step, setStep] = useState<Step>(1);
  const [address, setAddress] = useState<Address>({
    fullName: defaults.fullName,
    phone: defaults.phone,
    line1: defaults.line1,
    line2: defaults.line2,
    city: defaults.city,
    province: defaults.province,
    postalCode: defaults.postalCode,
    country: "Pakistan",
  });
  const [payment, setPayment] = useState<PaymentMethod>("cod");
  const [otpMethod, setOtpMethod] = useState<"whatsapp" | "email">("email");
  const [otpSent, setOtpSent] = useState(false);
  const [otpInput, setOtpInput] = useState("");
  const [otpError, setOtpError] = useState<string | null>(null);
  const [otpVerified, setOtpVerified] = useState(false);
  const [otpPending, startOtpTransition] = useTransition();
  const [placePending, startPlaceTransition] = useTransition();
  const [placeError, setPlaceError] = useState<string | null>(null);
  const [placedOrderId, setPlacedOrderId] = useState<string | null>(null);
  const [couponCode, setCouponCode] = useState("");
  const [couponApplied, setCouponApplied] = useState<{
    promoId: string;
    discountAmount: number;
    code: string;
  } | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [couponPending, startCouponTransition] = useTransition();

  useEffect(() => {
    if (lines.length === 0) return;
    const ids = [...new Set(lines.map((l) => l.productId))];
    Promise.all(ids.map((id) => getProductByIdAsync(id))).then((results) => {
      setProductMap((prev) => {
        const next = new Map(prev);
        results.forEach((p, i) => { if (p) next.set(ids[i], p); });
        return next;
      });
    });
  }, [lines]);

  const subtotal = useMemo(() => cartSubtotal(lines, productMap), [lines, productMap]);
  const shipping = subtotal === 0 ? 0 : subtotal >= 10000 ? 0 : 350;
  const total = subtotal + shipping;

  const selectOtpMethod = (method: "whatsapp" | "email") => {
    setOtpMethod(method);
    setOtpSent(false);
    setOtpInput("");
    setOtpError(null);
    setOtpVerified(false);
  };

  const displayTotal = couponApplied ? total - couponApplied.discountAmount : total;

  if (placedOrderId) {
    return <Confirmation orderId={placedOrderId} method={payment} total={displayTotal} />;
  }

  if (lines.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 sm:px-8 py-24 text-center">
        <p className="display text-3xl">Your cart is empty.</p>
        <p className="mt-3 text-sm text-muted">
          Add a fabric to begin checkout.
        </p>
        <Link href="/shop" className="btn btn-primary mt-8">
          Shop Fabrics
        </Link>
      </div>
    );
  }

  const canProceedToPayment =
    address.fullName &&
    address.phone &&
    address.line1 &&
    address.city &&
    address.province &&
    address.postalCode;

  const handleSendOtp = () => {
    setOtpError(null);
    startOtpTransition(async () => {
      const target = otpMethod === "email" ? userEmail : address.phone;
      const res = await sendOtp(target, otpMethod);
      if (res.ok) {
        setOtpSent(true);
      } else {
        setOtpError(res.error ?? "Failed to send code.");
      }
    });
  };

  const handleVerifyOtp = () => {
    setOtpError(null);
    startOtpTransition(async () => {
      const target = otpMethod === "email" ? userEmail : address.phone;
      const res = await verifyOtp(target, otpInput);
      if (res.ok) setOtpVerified(true);
      else setOtpError(res.error ?? "Invalid code.");
    });
  };

  const handleApplyCoupon = () => {
    setCouponError(null);
    const subtotalForCoupon = [...lines].reduce((sum, line) => {
      const product = productMap.get(line.productId);
      if (!product) return sum;
      return sum + lineSubtotal(line, product);
    }, 0);
    startCouponTransition(async () => {
      const res = await validateCoupon(couponCode.trim(), subtotalForCoupon);
      if (res.ok) {
        setCouponApplied({ promoId: res.promoId, discountAmount: res.discountAmount, code: res.code });
      } else {
        setCouponError(res.error);
        setCouponApplied(null);
      }
    });
  };

  const handlePlace = () => {
    setPlaceError(null);
    startPlaceTransition(async () => {
      const res = await placeOrder({
        lines,
        address,
        paymentMethod: payment,
        otpVerified,
        promoId: couponApplied?.promoId,
      });
      if (res.ok) {
        setPlacedOrderId(res.orderId);
        clear();
      } else {
        setPlaceError(res.error);
      }
    });
  };

  return (
    <div className="mx-auto max-w-[1440px] px-4 sm:px-8 py-10">
      <p className="eyebrow text-muted">Checkout</p>
      <ol className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm">
        {[
          { n: 1, label: "Shipping" },
          { n: 2, label: "Payment" },
          { n: 3, label: "Review" },
        ].map((s) => (
          <li
            key={s.n}
            className={`flex items-center gap-2 ${step === s.n ? "" : "text-muted"}`}
          >
            <span
              className={`flex h-6 w-6 items-center justify-center border text-xs ${
                step >= s.n ? "bg-ink text-paper border-ink" : "border-stone"
              }`}
            >
              {s.n}
            </span>
            <span className="uppercase tracking-[0.14em] text-xs">{s.label}</span>
          </li>
        ))}
      </ol>

      <div className="mt-8 grid gap-10 lg:grid-cols-[1.4fr_1fr]">
        <div>
          {step === 1 && (
            <section className="space-y-4">
              <h2 className="display text-2xl">Shipping address</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                <input required autoComplete="name" className="input sm:col-span-2" placeholder="Full name" value={address.fullName} onChange={(e) => setAddress({ ...address, fullName: e.target.value })} />
                <input required type="tel" autoComplete="tel" className="input sm:col-span-2" placeholder="Mobile number (e.g. 03001234567)" value={address.phone} onChange={(e) => setAddress({ ...address, phone: e.target.value })} />
                <input required autoComplete="address-line1" className="input sm:col-span-2" placeholder="Address line 1" value={address.line1} onChange={(e) => setAddress({ ...address, line1: e.target.value })} />
                <input autoComplete="address-line2" className="input sm:col-span-2" placeholder="Address line 2 (optional)" value={address.line2 ?? ""} onChange={(e) => setAddress({ ...address, line2: e.target.value })} />
                <input required autoComplete="address-level2" className="input" placeholder="City" value={address.city} onChange={(e) => setAddress({ ...address, city: e.target.value })} />
                <input required autoComplete="address-level1" className="input" placeholder="Province" value={address.province} onChange={(e) => setAddress({ ...address, province: e.target.value })} />
                <input required autoComplete="postal-code" className="input" placeholder="Postal code" value={address.postalCode} onChange={(e) => setAddress({ ...address, postalCode: e.target.value })} />
                <input autoComplete="country-name" className="input" value="Pakistan" disabled />
              </div>
              <button
                disabled={!canProceedToPayment}
                onClick={() => setStep(2)}
                className="btn btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Continue to Payment
              </button>
            </section>
          )}

          {step === 2 && (
            <section className="space-y-6">
              <h2 className="display text-2xl">Payment method</h2>

              {/* Promo code */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-ink">Promo Code <span className="font-normal text-muted">(optional)</span></p>
                {couponApplied ? (
                  <div className="flex items-center justify-between border border-green-300 bg-green-50 rounded px-4 py-3 text-sm">
                    <span className="text-green-700 font-medium">
                      ✓ {couponApplied.code} — PKR {couponApplied.discountAmount.toLocaleString()} off
                    </span>
                    <button
                      onClick={() => { setCouponApplied(null); setCouponCode(""); }}
                      className="text-xs text-muted underline cursor-pointer"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <input
                      className="input flex-1 uppercase"
                      placeholder="Enter code"
                      value={couponCode}
                      onChange={(e) => { setCouponCode(e.target.value.toUpperCase()); setCouponError(null); }}
                    />
                    <button
                      onClick={handleApplyCoupon}
                      disabled={couponPending || !couponCode.trim()}
                      className="btn btn-ghost text-sm disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {couponPending ? "…" : "Apply"}
                    </button>
                  </div>
                )}
                {couponError && <p className="text-xs text-accent">{couponError}</p>}
              </div>

              <label
                className={`block border p-5 cursor-pointer ${
                  payment === "cod" ? "border-ink" : "border-stone"
                }`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="radio"
                    name="payment"
                    checked={payment === "cod"}
                    onChange={() => setPayment("cod")}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium">Cash on Delivery</p>
                    <p className="mt-1 text-xs text-muted">
                      Pay in cash when your order arrives. Mobile OTP
                      verification required to confirm the order.
                    </p>

                    {payment === "cod" && (
                      <div className="mt-5 border-t border-stone pt-4">
                        <p className="eyebrow text-muted">Choose Verification Method</p>
                        <div className="mt-2 flex flex-wrap gap-4 text-xs">
                          <label className="flex items-center gap-2 cursor-not-allowed opacity-40">
                            <input
                              type="radio"
                              name="otpMethod"
                              disabled={true}
                              checked={false}
                              onChange={() => {}}
                              className="accent-ink"
                            />
                            <span className="line-through">WhatsApp ({address.phone || "mobile"})</span>
                            <span className="text-[9px] uppercase font-bold text-red-700 bg-red-50 border border-red-200 px-1 py-0.5 rounded">Inactive</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name="otpMethod"
                              disabled={otpSent}
                              checked={otpMethod === "email"}
                              onChange={() => selectOtpMethod("email")}
                              className="accent-ink"
                            />
                            <span>Email ({userEmail})</span>
                          </label>
                        </div>

                        <p className="mt-3 text-xs text-muted">
                          {otpMethod === "whatsapp"
                            ? `We'll send a 4-digit code via WhatsApp to ${address.phone || "your mobile"}.`
                            : `We'll send a 4-digit code via email to ${userEmail}.`}
                        </p>

                        {!otpSent ? (
                          <button
                            onClick={handleSendOtp}
                            className="btn btn-ghost mt-4"
                            disabled={otpPending}
                          >
                            {otpPending ? "Sending…" : "Send code"}
                          </button>
                        ) : otpVerified ? (
                          <p className="mt-4 text-sm text-accent">✓ Verified successfully</p>
                        ) : (
                          <div className="mt-4 space-y-3">
                            <div className="flex gap-2 border-stone">
                              <input
                                className="input flex-1"
                                placeholder="Enter 4-digit code"
                                inputMode="numeric"
                                maxLength={4}
                                value={otpInput}
                                onChange={(e) => setOtpInput(e.target.value)}
                              />
                              <button
                                onClick={handleVerifyOtp}
                                className="btn btn-primary"
                                disabled={otpPending || otpInput.length < 4}
                              >
                                {otpPending ? "…" : "Verify"}
                              </button>
                            </div>
                            {otpError && (
                              <p className="text-xs text-accent">{otpError}</p>
                            )}
                            <div className="flex gap-3">
                              <button
                                onClick={handleSendOtp}
                                className="text-xs underline text-muted"
                                disabled={otpPending}
                              >
                                Resend code
                              </button>
                              <button
                                onClick={() => {
                                  setOtpSent(false);
                                  setOtpInput("");
                                  setOtpError(null);
                                }}
                                className="text-xs underline text-muted"
                                disabled={otpPending}
                              >
                                Change method
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </label>

              <label
                className={`block border p-5 cursor-pointer ${
                  payment === "bank_transfer" ? "border-ink" : "border-stone"
                }`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="radio"
                    name="payment"
                    checked={payment === "bank_transfer"}
                    onChange={() => setPayment("bank_transfer")}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium">
                      Bank Transfer (Raast / IBAN)
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      Receive bank details on the order confirmation page.
                      Upload your transfer receipt from your account dashboard;
                      we'll release fulfillment after manual verification.
                    </p>
                  </div>
                </div>
              </label>

              {/* Card payment — wired post-launch. See docs/superpowers/specs/ for integration notes. */}
              <div
                className="block border border-stone p-5 opacity-50 cursor-not-allowed select-none"
              >
                <div className="flex items-start gap-3">
                  <input
                    type="radio"
                    name="payment"
                    value="card"
                    disabled
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">Pay with Card</p>
                      <span className="text-[9px] uppercase font-bold tracking-wider text-stone-500 bg-stone-100 border border-stone-200 px-1.5 py-0.5 rounded">
                        Coming Soon
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted">
                      Credit and debit cards via secure payment gateway. Available soon.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex justify-between">
                <button onClick={() => setStep(1)} className="link-underline text-sm">
                  ← Back
                </button>
                <button
                  onClick={() => setStep(3)}
                  disabled={payment === "cod" && !otpVerified}
                  className="btn btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Review Order
                </button>
              </div>
            </section>
          )}

          {step === 3 && (
            <section className="space-y-6">
              <h2 className="display text-2xl">Review &amp; place order</h2>

              <div className="border border-stone p-5">
                <div className="flex justify-between">
                  <p className="eyebrow text-muted">Shipping to</p>
                  <button
                    onClick={() => setStep(1)}
                    className="text-xs underline text-muted"
                  >
                    Edit
                  </button>
                </div>
                <p className="mt-2 text-sm">{address.fullName}</p>
                <p className="text-sm text-muted">
                  {address.line1}
                  {address.line2 ? `, ${address.line2}` : ""}, {address.city},{" "}
                  {address.province} {address.postalCode}
                </p>
                <p className="text-sm text-muted">{address.phone}</p>
              </div>

              <div className="border border-stone p-5">
                <div className="flex justify-between">
                  <p className="eyebrow text-muted">Payment</p>
                  <button
                    onClick={() => setStep(2)}
                    className="text-xs underline text-muted"
                  >
                    Edit
                  </button>
                </div>
                <p className="mt-2 text-sm">
                  {payment === "cod"
                    ? "Cash on Delivery (mobile verified)"
                    : "Bank Transfer — receipt upload required"}
                </p>
              </div>

              <button
                onClick={handlePlace}
                className="btn btn-primary w-full"
                disabled={placePending}
              >
                {placePending ? "Placing order…" : `Place order — ${formatPKR(displayTotal)}`}
              </button>
              {placeError && (
                <p className="text-xs text-accent text-center">{placeError}</p>
              )}
            </section>
          )}
        </div>

        <aside className="lg:sticky lg:top-28 lg:self-start border border-stone p-5">
          <p className="eyebrow text-muted">Order summary</p>
          <ul className="mt-4 divide-y divide-stone">
            {lines.map((line) => {
              const product = productMap.get(line.productId);
              if (!product) return null;
              const activeColor = line.color || "White";
              return (
                <li
                  key={`${line.productId}-${line.unit}-${line.stitching}-${activeColor}`}
                  className="flex gap-3 py-3"
                >
                  <div className="relative h-16 w-12 shrink-0 bg-mist overflow-hidden">
                    <Image
                      src={product.images[0]}
                      alt={product.name}
                      fill
                      sizes="48px"
                      className="object-cover"
                    />
                  </div>
                  <div className="flex-1 text-sm min-w-0">
                    <p className="truncate font-medium">{product.name}</p>
                    <p className="text-xs text-muted flex items-center gap-1.5 mt-0.5">
                      <span className="inline-block w-2 h-2 rounded-full border border-stone/50" style={{
                        backgroundColor: activeColor.toLowerCase() === "white" ? "#ffffff" : 
                                         activeColor.toLowerCase() === "black" ? "#000000" :
                                         activeColor.toLowerCase() === "blue" ? "#0000ff" : 
                                         activeColor.toLowerCase() === "red" ? "#ff0000" :
                                         activeColor.toLowerCase() === "green" ? "#008000" :
                                         activeColor.toLowerCase() === "beige" ? "#f5f5dc" :
                                         activeColor.toLowerCase() === "gray" || activeColor.toLowerCase() === "grey" ? "#808080" : 
                                         "#dddddd"
                      }} />
                      <span>{activeColor}</span>
                    </p>
                    <p className="text-xs text-muted mt-0.5">
                      {line.quantity} × by the {line.unit}
                      {line.stitching === "bespoke" && " · Bespoke"}
                    </p>
                  </div>
                  <p className="text-sm shrink-0">{formatPKR(lineSubtotal(line, product))}</p>
                </li>
              );
            })}
          </ul>
          <dl className="mt-4 space-y-2 border-t border-stone pt-4 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted">Subtotal</dt>
              <dd>{formatPKR(subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">Shipping</dt>
              <dd>{shipping === 0 ? "Free" : formatPKR(shipping)}</dd>
            </div>
            {couponApplied && (
              <div className="flex justify-between text-sm">
                <dt className="text-muted">Promo ({couponApplied.code})</dt>
                <dd className="text-green-600 font-medium">−{formatPKR(couponApplied.discountAmount)}</dd>
              </div>
            )}
            <div className="flex justify-between border-t border-stone pt-3 text-base">
              <dt>Total</dt>
              <dd>{formatPKR(displayTotal)}</dd>
            </div>
          </dl>
        </aside>
      </div>
    </div>
  );
}

function Confirmation({
  orderId,
  method,
  total,
}: {
  orderId: string;
  method: PaymentMethod;
  total: number;
}) {
  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-8 py-24 text-center">
      <p className="eyebrow text-muted">Order confirmed</p>
      <h1 className="display mt-3 text-4xl">Thank you.</h1>
      <p className="mt-3 text-sm text-muted">
        Order <strong>{orderId}</strong> — {formatPKR(total)}.
      </p>

      {method === "bank_transfer" && (
        <div className="mt-10 border border-stone p-6 text-left">
          <p className="eyebrow text-muted">Bank Transfer Details</p>
          <dl className="mt-4 grid grid-cols-[140px_1fr] gap-y-2 text-sm">
            <dt className="text-muted">Bank</dt>
            <dd>Meezan Bank</dd>
            <dt className="text-muted">Account Title</dt>
            <dd>Berke Pak Fabrics (Pvt) Ltd</dd>
            <dt className="text-muted">IBAN</dt>
            <dd className="font-mono">PK00MEZN0000000000000000</dd>
            <dt className="text-muted">Raast ID</dt>
            <dd>03000000000</dd>
          </dl>
          
          <div className="mt-8 border-t border-stone pt-6">
            <p className="eyebrow text-muted">Upload Proof of Payment</p>
            <p className="text-xs text-muted mt-1">
              Please transfer the total amount using the Meezan or Raast details above, then upload a screenshot of your transfer receipt here.
            </p>
            <ReceiptUploadForm pendingOrderIds={[orderId]} />
          </div>
        </div>
      )}

      {method === "cod" && (
        <p className="mt-6 text-sm text-muted">
          You'll receive an SMS with tracking once the order ships.
        </p>
      )}

      <div className="mt-10 flex justify-center gap-3">
        <Link href="/account/orders" className="btn btn-ghost">
          View Order
        </Link>
        <Link href="/shop" className="btn btn-primary">
          Continue Shopping
        </Link>
      </div>
    </div>
  );
}
