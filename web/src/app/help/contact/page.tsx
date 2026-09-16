import type { Metadata } from "next";
import Link from "next/link";
import { ContentPage, Section } from "@/components/ContentPage";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Reach Berke Pak Fabrics on WhatsApp or by email for questions about fabric, orders, shipping or returns.",
};

export default function ContactPage() {
  return (
    <ContentPage
      eyebrow="Help"
      title="Contact"
      intro="Questions about a fabric, an order, or a shade you cannot judge from a screen — ask us."
    >
      <Section heading="WhatsApp">
        <p>
          Fastest for anything about cloth, shade or stock.
          <br />
          <a
            href={SITE.whatsapp.href}
            className="link-underline text-ink"
            target="_blank"
            rel="noopener noreferrer"
          >
            {SITE.whatsapp.display}
          </a>
        </p>
      </Section>

      <Section heading="Email">
        <p>
          Best for order queries, receipts and returns — please include your order number.
          <br />
          <a href={`mailto:${SITE.email}`} className="link-underline text-ink">
            {SITE.email}
          </a>
        </p>
      </Section>

      <Section heading="Hours">
        <p>
          Monday to Saturday, 10am to 7pm PKT. Messages sent outside these hours are
          answered the next working day.
        </p>
      </Section>

      <Section heading="Where we ship from">
        <p>{SITE.shipsFrom}.</p>
        <p className="text-muted">
          We are online only — there is no walk-in shop. Returns are arranged by message
          first, and we will send the return address then.
        </p>
      </Section>

      <Section heading="Before you write">
        <p>
          Many questions are answered on the{" "}
          <Link href="/help/shipping" className="link-underline text-ink">
            shipping
          </Link>{" "}
          and{" "}
          <Link href="/help/returns" className="link-underline text-ink">
            returns
          </Link>{" "}
          pages. If your order was paid by bank transfer and is waiting on us, the status
          is on your order page — the link is in your confirmation email, or under{" "}
          <Link href="/account/orders" className="link-underline text-ink">
            your orders
          </Link>{" "}
          if you have an account.
        </p>
      </Section>
    </ContentPage>
  );
}
