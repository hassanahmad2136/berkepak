"use client";

import { usePathname } from "next/navigation";

const HEADER_MAP: Record<string, { title: string; desc: string }> = {
  "/admin": {
    title: "Admin Overview",
    desc: "Welcome to the administration dashboard. Access core store analytics, receipt reviews, and pricing.",
  },
  "/admin/receipts": {
    title: "Receipt Approval Hub",
    desc: "Review bank-transfer receipts uploaded by customers. Approving releases the order to fulfillment.",
  },
  "/admin/orders": {
    title: "Order Management",
    desc: "View and manage recent customer checkout orders, COD details, and payment verification.",
  },
  "/admin/pricing": {
    title: "Pricing Management Hub",
    desc: "Configure raw suit prices, apply percentage discounts, or adjust prices in bulk. Pricing is managed exclusively in Supabase.",
  },
  "/admin/stock": {
    title: "Stock & Inventory Control",
    desc: "Track and adjust fabric stock levels dynamically by color. Monitor low quantities and manage stock reserves.",
  },
};

export function AdminHeader() {
  const pathname = usePathname();
  const activeHeader = HEADER_MAP[pathname] || HEADER_MAP["/admin"];

  return (
    <div className="fade-in duration-300">
      <p className="eyebrow text-muted">Admin</p>
      <h1 className="display mt-2 text-4xl">{activeHeader.title}</h1>
      <p className="mt-2 text-sm text-muted max-w-xl">
        {activeHeader.desc}
      </p>
    </div>
  );
}
