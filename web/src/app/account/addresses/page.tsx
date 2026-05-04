import { createSupabaseServer } from "@/lib/supabase/server";

export default async function AddressesPage() {
  const supabase = await createSupabaseServer();
  const { data: addresses } = await supabase
    .from("addresses")
    .select("*")
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: false });

  return (
    <div>
      <h2 className="display text-2xl">Addresses</h2>

      {!addresses || addresses.length === 0 ? (
        <p className="mt-2 text-sm text-muted">
          Saved shipping addresses will appear here. The address you enter at
          checkout is automatically saved.
        </p>
      ) : (
        <ul className="mt-6 grid gap-3 sm:grid-cols-2">
          {addresses.map((a) => (
            <li key={a.id} className="border border-stone p-5">
              {a.is_default && (
                <p className="eyebrow text-muted mb-2">Default</p>
              )}
              <p className="text-sm">{a.full_name}</p>
              <p className="mt-1 text-sm text-muted">
                {a.line1}
                {a.line2 ? `, ${a.line2}` : ""}
                <br />
                {a.city}, {a.province} {a.postal_code}
                <br />
                {a.country}
              </p>
              <p className="mt-2 text-xs text-muted">{a.phone}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
