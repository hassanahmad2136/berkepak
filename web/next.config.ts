import type { NextConfig } from "next";

// Local Supabase runs on http://127.0.0.1:54321, which the production CSP does not allow.
// Without this, every client-side Supabase call (cart drawer, checkout, admin uploads) is
// blocked in local development and the app looks broken.
const isDev = process.env.NODE_ENV === "development";
const localOrigins = isDev
  ? " http://127.0.0.1:54321 http://localhost:54321 ws://127.0.0.1:54321 ws://localhost:54321"
  : "";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-XSS-Protection", value: "1; mode=block" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      // unsafe-inline + unsafe-eval required by Next.js 16 for hydration and module evaluation.
      // To harden further: migrate to nonce-based CSP via middleware (generates per-request nonce).
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://va.vercel-scripts.com",
      "img-src 'self' data: blob: https://images.unsplash.com https://plus.unsplash.com https://*.supabase.co" +
        (isDev ? " http://127.0.0.1:54321 http://localhost:54321" : ""),
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://va.vercel-scripts.com" +
        localOrigins,
      // unsafe-inline required for Tailwind CSS and Next.js inline critical styles.
      "style-src 'self' 'unsafe-inline'",
      "font-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "plus.unsplash.com" },
      { protocol: "https", hostname: "*.supabase.co" },
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
