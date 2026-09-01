import type { Metadata } from "next";
import { Bricolage_Grotesque, Hanken_Grotesk } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { CartDrawer } from "@/components/CartDrawer";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { Analytics } from "@/components/Analytics";
import { AuthListener } from "@/components/AuthListener";
import { Analytics as VercelAnalytics } from "@vercel/analytics/next";

const displayFont = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const bodyFont = Hanken_Grotesk({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Berke Pak — Men's Unstitched Shalwar Kameez Fabric",
    template: "%s — Berke Pak",
  },
  description:
    "Premium men's unstitched shalwar kameez fabric, sold by the suit. Crafted in Pakistan, delivered worldwide.",
  icons: {
    icon: "/logo.png?v=1",
    shortcut: "/logo.png?v=1",
    apple: "/logo.png?v=1",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${displayFont.variable} ${bodyFont.variable}`}>
      <body>
        <Header />
        <main className="min-h-[60dvh]">{children}</main>
        <Footer />
        <CartDrawer />
        <WhatsAppButton />
        <AuthListener />
        <Analytics />
        <VercelAnalytics />
      </body>
    </html>
  );
}
