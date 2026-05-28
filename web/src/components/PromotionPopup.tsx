"use client";

import { useState, useEffect } from "react";

type BannerPromo = {
  id: string;
  title: string;
  body: string | null;
};

export function PromotionPopup({ banners }: { banners: BannerPromo[] }) {
  const [visible, setVisible] = useState(false);
  const [promo, setPromo] = useState<BannerPromo | null>(null);

  useEffect(() => {
    if (banners.length === 0) return;
    const first = banners[0];
    const dismissed = sessionStorage.getItem(`promo_dismissed_${first.id}`);
    if (!dismissed) {
      setPromo(first);
      setVisible(true);
    }
  }, [banners]);

  const dismiss = () => {
    if (promo) sessionStorage.setItem(`promo_dismissed_${promo.id}`, "1");
    setVisible(false);
  };

  if (!visible || !promo) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs"
      onClick={dismiss}
    >
      <div
        className="relative bg-white border border-stone rounded-xl shadow-xl max-w-md w-full p-8 animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={dismiss}
          className="absolute top-4 right-4 text-stone-400 hover:text-ink transition-colors cursor-pointer"
          aria-label="Dismiss"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <p className="eyebrow text-muted text-xs mb-3">Limited Offer</p>
        <h2 className="display text-2xl text-ink leading-tight">{promo.title}</h2>
        {promo.body && (
          <p className="mt-3 text-sm text-muted leading-relaxed">{promo.body}</p>
        )}

        <button
          onClick={dismiss}
          className="mt-6 btn btn-primary w-full"
        >
          Shop Now
        </button>
      </div>
    </div>
  );
}
