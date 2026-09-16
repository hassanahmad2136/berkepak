import type { Metadata } from "next";
import Link from "next/link";
import { ContentPage, Section, Bullets } from "@/components/ContentPage";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "What personal information Berke Pak Fabrics collects, why we hold it, who it is shared with, and how to have it deleted.",
};

export default function PrivacyPage() {
  return (
    <ContentPage
      eyebrow="Legal"
      title="Privacy Policy"
      intro={`This explains what ${SITE.brand} collects when you shop with us, why, and what you can ask us to do with it.`}
      updated="2 September 2026"
    >
      <Section heading="Who we are">
        <p>
          {SITE.brand}, trading from {SITE.shipsFrom}. For anything in this policy, write to{" "}
          <a href={`mailto:${SITE.email}`} className="link-underline text-ink">
            {SITE.email}
          </a>
          .
        </p>
        <p className="text-muted">
          Orders are billed and banked under BZ Enterprises, Lahore.
        </p>
      </Section>

      <Section heading="What we collect">
        <p>Only what an order actually needs:</p>
        <Bullets
          items={[
            <>
              <strong>Contact and delivery details</strong> — name, email address, mobile
              number and shipping address. Guests give these at checkout without creating an
              account.
            </>,
            <>
              <strong>Account details</strong> — if you register, your email and a hashed
              password. We never store the password itself.
            </>,
            <>
              <strong>Order history</strong> — what you bought, the amounts, and the payment
              method.
            </>,
            <>
              <strong>Bank transfer receipts</strong> — the screenshot or document you upload
              as proof of payment, held privately and viewable only by our staff.
            </>,
            <>
              <strong>Verification codes</strong> — short-lived codes sent to confirm an
              email address for cash-on-delivery orders.
            </>,
            <>
              <strong>Measurements</strong> — only if you choose to save them for stitching.
            </>,
            <>
              <strong>Newsletter email</strong> — only if you subscribe.
            </>,
          ]}
        />
        <p className="text-muted">
          We do not collect or store card numbers. We do not sell personal information to
          anyone.
        </p>
      </Section>

      <Section heading="Why we hold it">
        <Bullets
          items={[
            "To take payment, pack the right cloth and deliver it to the right address.",
            "To confirm an email address before accepting a cash-on-delivery order, which protects us both against false orders.",
            "To verify bank transfer payments before dispatch.",
            "To answer you when you contact us about an order.",
            "To send marketing email — only if you subscribed, and you can unsubscribe at any time.",
          ]}
        />
      </Section>

      <Section heading="Who else sees it">
        <Bullets
          items={[
            <>
              <strong>Delivery couriers</strong> — your name, address and phone number, so
              they can deliver the parcel.
            </>,
            <>
              <strong>Our email provider</strong> — to send order confirmations and
              verification links.
            </>,
            <>
              <strong>Our hosting and database providers</strong> — who store the data on our
              behalf and may not use it for anything else.
            </>,
          ]}
        />
        <p>
          We will also disclose information where the law requires it. Nobody else receives
          your details.
        </p>
      </Section>

      <Section heading="How long we keep it">
        <p>
          Order records are kept for five years so we can handle
          returns, warranty questions and tax records. Verification codes expire within
          minutes. Newsletter subscriptions are kept until you unsubscribe.
        </p>
      </Section>

      <Section heading="Cookies">
        <p>
          We use a single sign-in cookie to keep you logged in, and your browser&apos;s local
          storage to remember your basket between visits. Neither is used for advertising or
          shared with anyone.
        </p>
        <p className="text-muted">
          We do not currently run analytics or advertising trackers on this site. If that
          changes, we will say so here before switching them on.
        </p>
      </Section>

      <Section heading="Your choices">
        <Bullets
          items={[
            <>
              Ask for a copy of what we hold about you, or ask us to correct it.
            </>,
            <>
              Ask us to delete your account and personal details. We may need to keep basic
              order records where the law requires it.
            </>,
            <>
              Unsubscribe from marketing email at any time — it does not affect order
              emails, which we must still send.
            </>,
          ]}
        />
        <p>
          Email{" "}
          <a href={`mailto:${SITE.email}`} className="link-underline text-ink">
            {SITE.email}
          </a>{" "}
          and we will action it.
        </p>
      </Section>

      <Section heading="Changes">
        <p>
          If this policy changes we will update the date at the top of this page. See also
          our{" "}
          <Link href="/legal/terms" className="link-underline text-ink">
            terms of sale
          </Link>
          .
        </p>
      </Section>
    </ContentPage>
  );
}
