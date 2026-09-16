import { requireUser } from "@/lib/auth/guards";
import { query } from "@/lib/db";

export default async function AddressesPage() {
  const user = await requireUser("/account/addresses");
  const addresses = await query<{
    id: string;
    full_name: string;
    phone: string;
    line1: string;
    line2: string | null;
    city: string;
    province: string;
    postal_code: string;
    country: string;
    is_default: boolean;
  }>(
    `select id, full_name, phone, line1, line2, city, province, postal_code, country, is_default
       from addresses
      where user_id = $1
      order by is_default desc, created_at desc`,
    [user.id],
  );

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
