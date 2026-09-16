import type { NextConfig } from "next";

/**
 * Product images are served from S3-compatible object storage (MinIO locally,
 * S3/R2 in production), so that origin has to be allowed by both the CSP and
 * next/image. Everything else the app talks to is same-origin: with Supabase
 * gone, the browser no longer calls any database directly.
 */
const storageOrigin = (
  process.env.S3_PUBLIC_URL ??
  process.env.S3_ENDPOINT ??
  "http://localhost:9000"
).replace(/\/$/, "");

function originParts(url: string) {
  try {
    const u = new URL(url);
    return {
      protocol: (u.protocol === "https:" ? "https" : "http") as "http" | "https",
      hostname: u.hostname,
      port: u.port || "",
      // Without an explicit pathname next/image rejects the URL outright
      // ("url parameter is not allowed").
      pathname: "/**",
      search: "",
    };
  } catch {
    return {
      protocol: "http" as const,
      hostname: "localhost",
      port: "9000",
      pathname: "/**",
      search: "",
    };
  }
}

// PayFast's hosted checkout is entered by a form POST from /pay/payfast, and a
// CSP form-action of 'self' alone silently blocks it. UAT and live hosts, plus
// whatever PAYFAST_BASE_URL points at.
const paymentFormTargets = [
  ...new Set(
    ["https://ipguat.apps.net.pk", "https://ipg1.apps.net.pk", process.env.PAYFAST_BASE_URL]
      .filter((u): u is string => !!u)
      .map((u) => {
        try {
          return new URL(u).origin;
        } catch {
          return null;
        }
      })
      .filter((u): u is string => !!u),
  ),
].join(" ");

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
      `img-src 'self' data: blob: ${storageOrigin}`,
      "connect-src 'self' https://va.vercel-scripts.com",
      // unsafe-inline required for Tailwind CSS and Next.js inline critical styles.
      "style-src 'self' 'unsafe-inline'",
      "font-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      `form-action 'self' ${paymentFormTargets}`,
    ].join("; "),
  },
];

// Next 16 refuses to fetch images from loopback addresses as an SSRF guard.
// Local MinIO is exactly that, so allow it in development only — in production
// the storage host (S3/R2) is public and this stays off.
const storageIsLocal = /^(localhost|127\.|0\.0\.0\.0|\[::1\])/.test(
  originParts(storageOrigin).hostname,
);

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [originParts(storageOrigin)],
    dangerouslyAllowLocalIP:
      process.env.NODE_ENV === "development" && storageIsLocal,
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
