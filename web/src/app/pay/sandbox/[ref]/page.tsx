import { notFound } from "next/navigation";
import { getPaymentByRef } from "@/lib/payments/service";
import { formatPKR } from "@/lib/format";
import { SandboxControls } from "./SandboxControls";

/**
 * Stands in for the bank app a customer would approve a Raast request in.
 *
 * Development only — the registry refuses the mock provider in production, and
 * this page refuses to render there either.
 */
export default async function SandboxPayPage(props: {
  params: Promise<{ ref: string }>;
}) {
  if (process.env.NODE_ENV === "production") notFound();

  const { ref } = await props.params;
  const payment = await getPaymentByRef("mock", ref);
  if (!payment) notFound();

  const settled = payment.status !== "initiated" && payment.status !== "pending";

  return (
    <div className="mx-auto max-w-md px-4 sm:px-8 py-20">
      <p className="eyebrow text-muted">Sandbox</p>
      <h1 className="display mt-2 text-3xl">Simulated bank approval</h1>
      <p className="mt-3 text-sm text-muted">
        A real customer would be approving this request inside their banking app. Your
        choice here is delivered to the webhook exactly as a live gateway would send it.
      </p>

      <dl className="mt-8 grid grid-cols-[130px_1fr] gap-y-2 border border-stone p-5 text-sm">
        <dt className="text-muted">Order</dt>
        <dd className="font-mono">{payment.order_id}</dd>
        <dt className="text-muted">Reference</dt>
        <dd className="font-mono text-xs break-all">{payment.provider_ref}</dd>
        <dt className="text-muted">Amount</dt>
        <dd>{formatPKR(Number(payment.amount))}</dd>
        <dt className="text-muted">Method</dt>
        <dd>{payment.method}</dd>
        <dt className="text-muted">Status</dt>
        <dd>{payment.status}</dd>
      </dl>

      {settled ? (
        <p className="mt-8 text-sm text-muted">
          This payment is already {payment.status} and cannot be changed.
        </p>
      ) : (
        <SandboxControls providerRef={payment.provider_ref!} orderId={payment.order_id} />
      )}
    </div>
  );
}
