import Link from "next/link";
import { notFound } from "next/navigation";
import { getPaymentByRef } from "@/lib/payments/service";
import { formatPKR } from "@/lib/format";
import { AutoSubmitForm } from "./AutoSubmitForm";

export const dynamic = "force-dynamic";

/**
 * Hands the customer to PayFast.
 *
 * PayFast's hosted page is entered by a form POST carrying a one-time token,
 * not by a link, so checkout redirects here and this page submits the form.
 * The reference in the URL is unguessable and the token inside is bound to one
 * basket and amount, so the page reveals nothing that could be reused.
 */
export default async function PayFastLaunchPage(props: {
  params: Promise<{ ref: string }>;
}) {
  const { ref } = await props.params;
  const payment = await getPaymentByRef("payfast", ref);
  if (!payment) notFound();

  const launch = payment.raw_response as {
    action?: string;
    fields?: Record<string, string>;
  } | null;

  const open = payment.status === "initiated" || payment.status === "pending";

  return (
    <div className="mx-auto max-w-md px-4 sm:px-8 py-20 text-center">
      <p className="eyebrow text-muted">Secure payment</p>
      <h1 className="display mt-2 text-3xl">
        {open ? "Taking you to PayFast…" : "This payment is closed"}
      </h1>
      <p className="mt-3 text-sm text-muted">
        Order <span className="font-mono">{payment.order_id}</span> —{" "}
        {formatPKR(Number(payment.amount))}
      </p>

      {open && launch?.action && launch.fields ? (
        <AutoSubmitForm action={launch.action} fields={launch.fields} />
      ) : (
        <div className="mt-8">
          <p className="text-sm text-muted">
            {open
              ? "We could not prepare this payment. Please start it again from your order."
              : `This attempt is already ${payment.status}.`}
          </p>
          <Link href="/account/orders" className="btn btn-ghost mt-6">
            Your orders
          </Link>
        </div>
      )}
    </div>
  );
}
