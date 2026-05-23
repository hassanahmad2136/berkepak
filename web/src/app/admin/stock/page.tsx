import { getAdminProducts, getProductColorsForAdmin } from "@/lib/actions/admin";
import { StockDashboardClient } from "./StockDashboardClient";

export const dynamic = "force-dynamic";

export default async function StockPage() {
  const productsRes = await getAdminProducts();
  const colorsRes = await getProductColorsForAdmin();

  const products = productsRes.ok ? (productsRes.products || []) : [];
  const initialColors = colorsRes.ok ? (colorsRes.productColors || []) : [];

  return (
    <StockDashboardClient
      products={products}
      initialColors={initialColors}
    />
  );
}
