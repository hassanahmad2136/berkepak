import Link from "next/link";
import { notFound } from "next/navigation";
import { queryOne, query } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/guards";
import { formatPKR } from "@/lib/format";
import { SITE } from "@/lib/site";
import { PAYMENT_METHOD_LABEL, PAYMENT_STATUS_LABEL } from "@/lib/payment-labels";
import { ReceiptUploadForm } from "@/app/account/receipts/ReceiptUploadForm";
import { PayNowButton } from "@/components/PayNowButton";

/**
 * Order lookup for guests. A guest has no account, so the emailed token is how
 * they return to the order — to send bank-transfer details after the
 * confirmation page is gone, or to retry an online payment. Signed-in owners
 * can open it without a token.
 */

const STATUS_LABEL: Record<string, string> = {
  unconfirmed: "Unconfirmed",
  confirmed: "Confirmed",
  fulfilled: "Fulfilled",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

/**
 * How long an open gateway attempt blocks a new one. A customer who closed the
 * payment page leaves an attempt that never reports back; one still paying must
 * not be offered a second basket to pay twice into.
 */
const RETRY_AFTER_MINUTES = 10;

export default async function OrderStatusPage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ token?: string; payment?: string }>;
}) {
  const { id } = await props.params;
  const { token, payment: returnedFromGateway } = await props.searchParams;
  const user = await getCurrentUser();

  // Either the session owns the order, or the caller holds its guest token.
  const COLUMNS = `id, status, payment_method, payment_status, total, created_at, guest_token`;
  type OrderRow = {
    id: string;
    status: string;
    payment_method: string;
    payment_status: string;
    total: string;
    created_at: Date;
    guest_token: string | null;
  };

  // Every parameter must be referenced or Postgres cannot infer its type, so
  // the two cases are separate statements rather than one with a spare param.
  const order = user
    ? await queryOne<OrderRow>(
        `select ${COLUMNS} from orders
          where id = $1 and (user_id = $2 or (guest_token is not null and guest_token = $3))`,
        [id, user.id, token ?? ""],
      )
    : token
      ? await queryOne<OrderRow>(
          `select ${COLUMNS} from orders where id = $1 and guest_token = $2`,
          [id, token],
        )
      : null;

  if (!order) notFound();

  const items = await query<{
    product_name: string;
    color: string;
    quantity: string;
    line_total: string;
  }>(
    `select product_name, color, quantity, line_total from order_items where order_id = $1`,
    [id],
  );

  const needsReceipt =
    order.payment_method === "bank_transfer" && order.payment_status === "awaiting_receipt";

  const isOnline = order.payment_method === "online";
  const latestAttempt = isOnline
    ? await queryOne<{ status: string; stale: boolean }>(
        `select status,
                created_at < now() - ($2 || ' minutes')::interval as stale
           from payments where order_id = $1
          order by created_at desc limit 1`,
        [id, String(RETRY_AFTER_MINUTES)],
      )
    : null;
  const attemptOpen =
    !!latestAttempt &&
    (latestAttempt.status === "initiated" || latestAttempt.status === "pending") &&
    !latestAttempt.stale;
  const canPay = isOnline && order.payment_status !== "paid" && !attemptOpen;

  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-8 py-16">
      <p className="eyebrow text-muted">Order</p>
      <h1 className="display mt-2 text-4xl">{order.id}</h1>
      <p className="mt-3 text-sm text-muted">
        {new Date(order.created_at).toLocaleDateString()} ·{" "}
        {STATUS_LABEL[order.status] ?? order.status} ·{" "}
        {PAYMENT_METHOD_LABEL[order.payment_method] ?? order.payment_method} —{" "}
        {PAYMENT_STATUS_LABEL[order.payment_status] ?? order.payment_status}
      </p>

      {/* The banner reads the order's real state; the query flag only says the
          customer has just come back from the gateway. */}
      {returnedFromGateway && isOnline && (
        <div className="mt-6 border border-stone p-4 text-sm">
          {order.payment_status === "paid"
            ? "Payment received — thank you. Your order is confirmed."
            : order.payment_status === "failed"
              ? "The payment was not completed. You can try again below."
              : "We're confirming your payment. This page will show Paid once it clears."}
        </div>
      )}

      <ul className="mt-8 divide-y divide-stone border border-stone">
        {items.map((it, i) => (
          <li key={i} className="flex items-center justify-between gap-4 p-4 text-sm">
            <span>
              {it.product_name}
              <span className="text-muted"> · {it.color} × {Number(it.quantity)}</span>
            </span>
            <span>{formatPKR(Number(it.line_total))}</span>
          </li>
        ))}
        <li className="flex items-center justify-between gap-4 p-4 text-sm font-medium">
          <span>Total</span>
          <span>{formatPKR(Number(order.total))}</span>
        </li>
      </ul>

      {canPay && (
        <div className="mt-10 border border-stone p-6">
          <p className="eyebrow text-muted">Payment</p>
          <p className="mt-2 text-sm text-muted">
            This order is not paid yet. Complete it on {SITE.payments.gatewayName}&apos;s
            secure page.
          </p>
          <div className="mt-5">
            <PayNowButton
              orderId={order.id}
              guestToken={order.guest_token ?? undefined}
              label={`Pay ${formatPKR(Number(order.total))}`}
            />
          </div>
        </div>
      )}

      {isOnline && attemptOpen && order.payment_status !== "paid" && (
        <p className="mt-8 text-sm text-muted">
          A payment for this order is in progress. If you closed the payment page, you can
          start again in a few minutes.
        </p>
      )}

      {needsReceipt && (
        <div className="mt-10 border border-stone p-6">
          <p className="eyebrow text-muted">Bank Transfer Details</p>
          <dl className="mt-4 grid grid-cols-[140px_1fr] gap-y-2 text-sm">
            <dt className="text-muted">Amount</dt>
            <dd className="font-medium">{formatPKR(Number(order.total))}</dd>
            <dt className="text-muted">Bank</dt>
            <dd>{SITE.bank.name}</dd>
            <dt className="text-muted">Account Title</dt>
            <dd>{SITE.bank.accountTitle}</dd>
            <dt className="text-muted">Account Number</dt>
            <dd className="font-mono">{SITE.bank.accountNumber}</dd>
          </dl>
          <div className="mt-8 border-t border-stone pt-6">
            <p className="eyebrow text-muted">Confirm your transfer</p>
            <ReceiptUploadForm
              pendingOrderIds={[order.id]}
              guestToken={order.guest_token ?? undefined}
            />
          </div>
        </div>
      )}

      {order.payment_status === "awaiting_review" && (
        <p className="mt-8 text-sm text-muted">
          Your transfer details are with our team. We&apos;ll email you once they are matched.
        </p>
      )}

      <div className="mt-10">
        <Link href="/shop" className="btn btn-ghost">
          Continue shopping
        </Link>
      </div>
    </div>
  );
}
