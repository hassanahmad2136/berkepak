import type { Metadata } from "next";
import Link from "next/link";
import { ContentPage, Section, Bullets } from "@/components/ContentPage";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Returns & Exchanges",
  description:
    "How to return or exchange unstitched fabric bought from Berke Pak, and what happens once fabric has been cut or stitched.",
};

export default function ReturnsPage() {
  return (
    <ContentPage
      eyebrow="Help"
      title="Returns & Exchanges"
      intro="We want you to be happy with the cloth. If something is not right, tell us quickly and we will put it right."
    >
      <Section heading="The short version">
        <Bullets
          items={[
            <>
              Unopened, uncut fabric can be returned within{" "}
              <strong>7 days</strong> of delivery.
            </>,
            <>
              Fabric that has been <strong>cut, washed or stitched cannot be returned</strong>,
              because it can no longer be resold as a suit length.
            </>,
            <>
              If the cloth arrives damaged, short in length, or is not what you ordered, we
              cover it entirely — including return postage.
            </>,
          ]}
        />
      </Section>

      <Section heading="Faulty, short or wrong fabric">
        <p>
          Check your suit length when it arrives. Each piece is sold as a{" "}
          {SITE.metresPerSuit}-metre suit length; if you measure short, or find a weaving
          fault or transit damage, contact us within{" "}
          <strong>48 hours</strong> of delivery with your order
          number and a photograph.
        </p>
        <p>
          We will replace the piece where stock allows, or refund it in full. You will not
          be asked to pay return postage on a fault.
        </p>
      </Section>

      <Section heading="Changed your mind">
        <p>
          Return the piece unused and in its original packaging within the window above and
          we will refund the price of the fabric. Original shipping is not refunded, and
          return postage is yours to arrange unless the fault was ours.
        </p>
        <p className="text-muted">
          Colour can look different between a screen and daylight. If shade matters for your
          order, ask us for a photograph in natural light before you buy — that is easier
          than a return.
        </p>
      </Section>

      <Section heading="How refunds are paid">
        <Bullets
          items={[
            <>
              <strong>Bank transfer orders</strong> are refunded to the account the payment
              came from.
            </>,
            <>
              <strong>Cash on delivery orders</strong> are refunded by bank transfer to an
              account in your name; we will ask for the details when the return is approved.
            </>,
            <>
              Refunds are issued once the returned fabric reaches us and has been checked,
              normally within <strong>5–7 working days</strong>.
            </>,
          ]}
        />
      </Section>

      <Section heading="Starting a return">
        <p>
          Message us on{" "}
          <a
            href={SITE.whatsapp.href}
            className="link-underline text-ink"
            target="_blank"
            rel="noopener noreferrer"
          >
            WhatsApp
          </a>{" "}
          or email{" "}
          <a href={`mailto:${SITE.email}`} className="link-underline text-ink">
            {SITE.email}
          </a>{" "}
          with your order number and what went wrong. Please do not send anything back
          before we have replied — unannounced returns are hard to trace to an order.{" "}
          <Link href="/help/contact" className="link-underline text-ink">
            All contact details
          </Link>
          .
        </p>
      </Section>
    </ContentPage>
  );
}
