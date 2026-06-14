import type { Metadata } from "next";
import { Bricolage_Grotesque, Hanken_Grotesk } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { CartDrawer } from "@/components/CartDrawer";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { Analytics } from "@/components/Analytics";
import { AuthListener } from "@/components/AuthListener";

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
    default: "Berke Pak — Editorial Fabrics from Pakistan",
    template: "%s — Berke Pak",
  },
  description:
    "Premium raw fabrics — cotton, linen, wool, and silk — sold exclusively by the suit. Crafted in Pakistan, delivered worldwide.",
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
      </body>
    </html>
  );
}
