import Link from "next/link";
import { NewsletterForm } from "./NewsletterForm";

export function Footer() {
  return (
    <footer className="border-t border-stone mt-24">
      <div className="mx-auto max-w-[1440px] px-4 sm:px-8 py-16 grid gap-12 md:grid-cols-4">
        <div className="md:col-span-2">
          <p className="display text-2xl tracking-[-0.03em]">
            Editorial fabrics, woven with intent.
          </p>
          <p className="mt-4 max-w-md text-sm text-muted">
            Berke Pak sources and supplies premium raw fabrics — by the meter
            or by the suit — from heritage mills across Pakistan and beyond.
          </p>
          <NewsletterForm />
        </div>
        <div>
          <p className="eyebrow text-muted">Shop</p>
          <ul className="mt-4 space-y-2 text-sm">
            <li><Link className="link-underline" href="/shop">All Fabrics</Link></li>
            <li><Link className="link-underline" href="/shop?category=cotton">Cotton</Link></li>
            <li><Link className="link-underline" href="/shop?category=linen">Linen</Link></li>
            <li><Link className="link-underline" href="/shop?category=wool">Wool</Link></li>
            <li><Link className="link-underline" href="/shop?category=silk">Silk</Link></li>
          </ul>
        </div>
        <div>
          <p className="eyebrow text-muted">Help</p>
          <ul className="mt-4 space-y-2 text-sm">
            <li><Link className="link-underline" href="/account">My Account</Link></li>
            <li><Link className="link-underline" href="/account/orders">Order Tracking</Link></li>
            <li><Link className="link-underline" href="/help/shipping">Shipping</Link></li>
            <li><Link className="link-underline" href="/help/returns">Returns</Link></li>
            <li><Link className="link-underline" href="/help/contact">Contact</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-stone">
        <div className="mx-auto max-w-[1440px] px-4 sm:px-8 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted">
          <p>© {new Date().getFullYear()} Berke Pak Fabrics. All rights reserved.</p>
          <p className="flex gap-6">
            <Link className="link-underline" href="/legal/privacy">Privacy</Link>
            <Link className="link-underline" href="/legal/terms">Terms</Link>
          </p>
        </div>
      </div>
    </footer>
  );
}
