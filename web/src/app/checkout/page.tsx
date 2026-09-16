import { getCurrentUser } from "@/lib/auth/guards";
import { queryOne } from "@/lib/db";
import { isOnlinePaymentEnabled, onlinePaymentLabel } from "@/lib/payments/registry";
import { CheckoutFlow } from "./CheckoutFlow";

/**
 * Checkout is open to guests. Signing in is an accelerator (saved address,
 * order history), never a requirement — gating it here lost every sale from a
 * customer who did not want an account.
 */
export default async function CheckoutPage() {
  const user = await getCurrentUser();

  const defaultAddress = user
    ? await queryOne<{
        full_name: string;
        phone: string;
        line1: string;
        line2: string | null;
        city: string;
        province: string;
        postal_code: string;
      }>(
        `select full_name, phone, line1, line2, city, province, postal_code
           from addresses
          where user_id = $1
          order by is_default desc, created_at desc
          limit 1`,
        [user.id],
      )
    : null;

  return (
    <CheckoutFlow
      userEmail={user?.email ?? ""}
      signedIn={!!user}
      onlineEnabled={isOnlinePaymentEnabled()}
      onlineLabel={onlinePaymentLabel()}
      defaults={{
        fullName: defaultAddress?.full_name ?? user?.fullName ?? "",
        phone: defaultAddress?.phone ?? user?.phone ?? "",
        line1: defaultAddress?.line1 ?? "",
        line2: defaultAddress?.line2 ?? "",
        city: defaultAddress?.city ?? "",
        province: defaultAddress?.province ?? "",
        postalCode: defaultAddress?.postal_code ?? "",
      }}
    />
  );
}
