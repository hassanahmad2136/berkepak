import { createSupabaseAdmin } from "@/lib/supabase/server";
import { ReceiptRow } from "./ReceiptRow";
import { formatPKR } from "@/lib/format";
import { isSupabaseConfigured } from "@/components/SetupNotice";

export default async function AdminReceiptsPage(props: {
  searchParams: Promise<{ status?: string }>;
}) {
  if (!isSupabaseConfigured()) return null;
  const { status = "pending" } = await props.searchParams;
  const admin = createSupabaseAdmin();

  const { data: receipts } = await admin
    .from("receipts")
    .select(
      "id, order_id, user_id, status, storage_path, notes, created_at, reviewed_at",
    )
    .eq("status", status)
    .order("created_at", { ascending: false });

  // Fan out to fetch each receipt's order summary + signed download URL.
  const enriched = await Promise.all(
    (receipts ?? []).map(async (r) => {
      const [{ data: order }, { data: signed }] = await Promise.all([
        admin
          .from("orders")
          .select("id, total, payment_status, status, shipping_address")
          .eq("id", r.order_id)
          .maybeSingle(),
        admin.storage.from("receipts").createSignedUrl(r.storage_path, 60 * 10),
      ]);
      return { ...r, order, signedUrl: signed?.signedUrl ?? null };
    }),
  );

  const tabs = [
    { value: "pending", label: "Pending" },
    { value: "approved", label: "Approved" },
    { value: "rejected", label: "Rejected" },
  ];

  return (
    <div>
      <nav className="flex gap-2">
        {tabs.map((t) => {
          const active = status === t.value;
          return (
            <a
              key={t.value}
              href={`/admin/receipts?status=${t.value}`}
              className={`px-3 py-1.5 text-xs uppercase tracking-[0.14em] border ${
                active ? "bg-ink text-paper border-ink" : "border-stone hover:border-ink"
              }`}
            >
              {t.label}
            </a>
          );
        })}
      </nav>

      {enriched.length === 0 ? (
        <p className="mt-10 text-sm text-muted">No receipts in this state.</p>
      ) : (
        <ul className="mt-8 space-y-3">
          {enriched.map((r) => (
            <ReceiptRow
              key={r.id}
              id={r.id}
              orderId={r.order_id}
              status={r.status}
              notes={r.notes}
              signedUrl={r.signedUrl}
              createdAt={r.created_at}
              orderTotal={r.order ? formatPKR(Number(r.order.total)) : "—"}
              shippingName={
                (r.order?.shipping_address as { fullName?: string } | null)
                  ?.fullName ?? "—"
              }
            />
          ))}
        </ul>
      )}
    </div>
  );
}
