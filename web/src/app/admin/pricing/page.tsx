import { getAdminProducts } from "@/lib/actions/admin";
import { PricingDashboardClient } from "./PricingDashboardClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Pricing Hub",
  description: "Centralized pricing overrides and global markup/discount controls.",
};

export default async function AdminPricingPage() {
  const result = await getAdminProducts();
  
  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="display text-2xl">Pricing Management</h2>
          <p className="text-sm text-muted">
            Configure raw suit prices, apply percentage discounts, or adjust prices in bulk.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-2.5 py-1 text-xs font-medium rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Database Connected
          </div>
        </div>
      </div>

      {!result.ok || !result.products ? (
        <div className="border border-red-200 bg-red-50 p-6 rounded-lg text-sm text-red-800">
          <h3 className="font-semibold">Failed to fetch pricing data</h3>
          <p className="mt-1">{result.error || "Please verify the database connection and product_catalog table configuration."}</p>
        </div>
      ) : (
        <PricingDashboardClient initialProducts={result.products} />
      )}
    </div>
  );
}
