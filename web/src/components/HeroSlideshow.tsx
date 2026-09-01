"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";

const BANNERS = [
  { src: "/hero/banner-1.png", isDark: false }, // White fabric background -> Dark text
  { src: "/hero/banner-2.png", isDark: true },  // Dark ambient drape -> Light text
];

export function HeroSlideshow() {
  const [currentIdx, setCurrentIdx] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentIdx((prev) => (prev + 1) % BANNERS.length);
    }, 6000); // Loop every 6 seconds
    return () => clearInterval(timer);
  }, []);

  const activeBanner = BANNERS[currentIdx];
  const isDark = activeBanner.isDark;

  return (
    <div className="absolute inset-0 h-full w-full bg-mist overflow-hidden z-0 flex flex-col justify-end">
      {/* Background slide transitions */}
      {BANNERS.map((banner, idx) => {
        const isActive = idx === currentIdx;
        return (
          <div
            key={banner.src}
            className={`absolute inset-0 h-full w-full transition-all duration-[1800ms] ease-out-expo ${
              isActive
                ? "opacity-100 scale-100"
                : "opacity-0 scale-[1.03] pointer-events-none"
            }`}
            style={{
              transitionTimingFunction: "cubic-bezier(0.25, 0.46, 0.45, 0.94)",
            }}
          >
            <Image
              src={banner.src}
              alt=""
              fill
              priority={idx === 0} // Pre-load banner-1.png strictly for LCP optimization
              fetchPriority={idx === 0 ? "high" : "low"}
              sizes="100vw"
              className="object-cover"
            />
          </div>
        );
      })}

      {/* Dynamic dark gradient scrim (Only overlayed for dark theme configurations to keep light images pristine) */}
      <div 
        className={`absolute inset-0 transition-opacity duration-[1000ms] ease-in-out z-10 ${
          isDark 
            ? "bg-gradient-to-b from-black/10 via-transparent to-black/40 opacity-100" 
            : "bg-gradient-to-b from-black/5 via-transparent to-black/10 opacity-40"
        }`} 
      />

      {/* Adaptive Text & Action Overlay */}
      <div 
        className={`relative z-20 mx-auto w-full max-w-[1440px] px-4 pb-16 sm:px-8 sm:pb-24 transition-colors duration-[1000ms] ease-in-out ${
          isDark ? "text-paper" : "text-ink"
        }`}
      >
        <p className="eyebrow transition-colors duration-[1000ms]">Unstitched · Men&apos;s Shalwar Kameez</p>
        
        <h1 className="display mt-4 text-5xl sm:text-7xl lg:text-8xl max-w-4xl font-light leading-none">
          Quiet luxury,<br />by the suit.
        </h1>
        
        <p 
          className={`mt-6 max-w-md text-sm leading-relaxed transition-colors duration-[1000ms] ${
            isDark ? "text-paper/85" : "text-ink/85"
          }`}
        >
          Men&apos;s unstitched shalwar kameez fabric — sourced from heritage mills,
          sold by the suit.
        </p>
        
        <div className="mt-8">
          <Link
            href="/shop"
            className={`btn btn-primary transition-all duration-[1000ms] ease-in-out inline-block ${
              isDark 
                ? "!border-paper !bg-paper !text-ink hover:!bg-transparent hover:!text-paper" 
                : "!border-ink !bg-ink !text-paper hover:!bg-transparent hover:!text-ink"
            }`}
          >
            Shop the Edit
          </Link>
        </div>
      </div>
    </div>
  );
}
