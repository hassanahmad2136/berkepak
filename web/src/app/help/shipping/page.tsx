import type { Metadata } from "next";
import Link from "next/link";
import { ContentPage, Section, Bullets } from "@/components/ContentPage";
import { SITE } from "@/lib/site";
import { formatPKR } from "@/lib/format";

export const metadata: Metadata = {
  title: "Shipping",
  description:
    "Delivery times, shipping charges and order tracking for Berke Pak unstitched fabric orders across Pakistan.",
};

export default function ShippingPage() {
  return (
    <ContentPage
      eyebrow="Help"
      title="Shipping"
      intro={`Every order is dispatched from ${SITE.shipsFrom}.`}
    >
      <Section heading="Charges">
        <p>
          Shipping is <strong>free</strong> on orders of{" "}
          {formatPKR(SITE.freeShippingThresholdPKR)} or more. Below that, a flat{" "}
          {formatPKR(SITE.flatShippingPKR)} is added at checkout.
        </p>
        <p className="text-muted">
          The threshold is applied to your order total before any discount, so a promo
          code will not remove free shipping you have already earned.
        </p>
      </Section>

      <Section heading="Delivery times">
        <Bullets
          items={[
            <>
              <strong>Lahore:</strong> typically 1–2 working days after dispatch.
            </>,
            <>
              <strong>Other cities in Pakistan:</strong> typically 3–5 working days.
            </>,
            <>
              Orders paid by bank transfer are dispatched once your receipt has been
              verified, which we aim to do within one working day.
            </>,
          ]}
        />
        <p className="text-muted">
          These are courier estimates, not guarantees. Public holidays and weather
          disruptions can add a day or two.
        </p>
      </Section>

      <Section heading="International orders">
        <p>
          We do not currently ship outside Pakistan. If you would like an order sent
          abroad, message us on{" "}
          <a href={SITE.whatsapp.href} className="link-underline text-ink" target="_blank" rel="noopener noreferrer">
            WhatsApp
          </a>{" "}
          and we will quote a courier rate case by case.
        </p>
      </Section>

      <Section heading="Tracking your order">
        <p>
          You will receive a confirmation email as soon as your order is placed. If you
          created an account, every order is listed under{" "}
          <Link href="/account/orders" className="link-underline text-ink">
            your orders
          </Link>
          . If you checked out as a guest, the confirmation email contains a private link
          back to your order — keep it, as it is how you view the order later.
        </p>
      </Section>

      <Section heading="Something wrong with your delivery?">
        <p>
          Contact us with your order number and we will chase the courier.{" "}
          <Link href="/help/contact" className="link-underline text-ink">
            Get in touch
          </Link>
          .
        </p>
      </Section>
    </ContentPage>
  );
}
