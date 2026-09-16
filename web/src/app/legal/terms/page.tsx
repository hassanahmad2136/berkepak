import type { Metadata } from "next";
import Link from "next/link";
import { ContentPage, Section, Bullets } from "@/components/ContentPage";
import { SITE } from "@/lib/site";
import { formatPKR } from "@/lib/format";

export const metadata: Metadata = {
  title: "Terms of Sale",
  description:
    "The terms on which Berke Pak Fabrics sells unstitched shalwar kameez fabric: orders, pricing, payment, delivery and cancellation.",
};

export default function TermsPage() {
  return (
    <ContentPage
      eyebrow="Legal"
      title="Terms of Sale"
      intro={`These terms apply when you buy from ${SITE.brand}. Placing an order means you accept them.`}
      updated="2 September 2026"
    >
      <Section heading="What we sell">
        <p>
          Men&apos;s unstitched shalwar kameez fabric, sold as suit lengths of{" "}
          {SITE.metresPerSuit} metres unless a product page says otherwise. Fabric is sold
          uncut and unstitched.
        </p>
        <p className="text-muted">
          Colours on screen are a guide. Dye lots vary, and a shade can differ slightly
          between batches and between your screen and daylight. If an exact shade matters,
          ask us before ordering.
        </p>
      </Section>

      <Section heading="Orders">
        <p>
          An order is an offer to buy. It is accepted when we send your order confirmation
          email. If a piece turns out to be unavailable after you order, we will tell you and
          refund it in full.
        </p>
        <p>
          You can order as a guest or with an account. Guests receive a private link to their
          order by email; keep it, as it is the only way to return to that order.
        </p>
      </Section>

      <Section heading="Prices and shipping">
        <Bullets
          items={[
            "Prices are in Pakistani Rupees and include any applicable tax unless stated.",
            <>
              Shipping is free on orders of {formatPKR(SITE.freeShippingThresholdPKR)} and
              over; otherwise a flat {formatPKR(SITE.flatShippingPKR)} applies.
            </>,
            "We may change prices at any time, but never after your order is confirmed.",
            "If a price is listed in obvious error, we may cancel the order and refund you in full rather than honour it.",
          ]}
        />
      </Section>

      <Section heading="Payment">
        <Bullets
          items={[
            <>
              <strong>Cash on delivery</strong> — you pay the courier. We verify your email
              address with a code first, so that we are not dispatching against a false order.
            </>,
            <>
              <strong>Bank transfer</strong> — pay into {SITE.bank.name}, account title{" "}
              {SITE.bank.accountTitle}, number{" "}
              <span className="font-mono">{SITE.bank.accountNumber}</span>, then upload your
              receipt. We dispatch once payment is verified.
            </>,
          ]}
        />
        <p className="text-muted">
          Orders awaiting a bank transfer receipt are held for 3 days
          and then released back to stock.
        </p>
      </Section>

      <Section heading="Delivery">
        <p>
          We ship from {SITE.shipsFrom}. Delivery estimates are on the{" "}
          <Link href="/help/shipping" className="link-underline text-ink">
            shipping page
          </Link>{" "}
          and are estimates, not guarantees. Risk in the goods passes to you on delivery.
        </p>
        <p>
          Please give an address where someone can receive the parcel. Repeated failed
          delivery attempts on a cash-on-delivery order may mean we decline future
          cash-on-delivery orders from that address.
        </p>
      </Section>

      <Section heading="Cancellations and returns">
        <p>
          You can cancel before dispatch by contacting us. After delivery, returns are
          covered by our{" "}
          <Link href="/help/returns" className="link-underline text-ink">
            returns policy
          </Link>
          . Fabric that has been cut, washed or stitched cannot be returned.
        </p>
      </Section>

      <Section heading="Accounts">
        <p>
          Keep your password to yourself; you are responsible for what happens under your
          account. Tell us straight away if you think someone else has access. We may suspend
          an account that is being used fraudulently.
        </p>
      </Section>

      <Section heading="Our liability">
        <p>
          If we get an order wrong, we will replace the goods or refund you. Beyond that, our
          liability is limited to the value of the order. Nothing here removes rights you have
          under Pakistani consumer law.
        </p>
      </Section>

      <Section heading="Governing law">
        <p>
          These terms are governed by the laws of Pakistan, and disputes fall to the courts
          of Lahore.
        </p>
      </Section>

      <Section heading="Contact">
        <p>
          <Link href="/help/contact" className="link-underline text-ink">
            Contact details
          </Link>{" "}
          — or email{" "}
          <a href={`mailto:${SITE.email}`} className="link-underline text-ink">
            {SITE.email}
          </a>
          . How we handle your data is set out in our{" "}
          <Link href="/legal/privacy" className="link-underline text-ink">
            privacy policy
          </Link>
          .
        </p>
      </Section>
    </ContentPage>
  );
}
