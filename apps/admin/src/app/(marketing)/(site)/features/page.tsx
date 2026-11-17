import type { Metadata } from "next";
import { ClosingCta, Ctas, PageHero, Section, Slot } from "@/components/landing/site-ui";
import { SITE_NAME } from "@/lib/brand";

// Every feature, in depth. Bare bones while the site is rebuilt: each section
// is a title and a marked slot for its content. The home page shows only the
// highlights (components/landing/features-section.tsx).

export const metadata: Metadata = {
  title: "Features",
  description: `Everything in ${SITE_NAME}: a booking page with instant quotes, deposits to your own Stripe, a diary and route planner, emails from your own address, staff logins and privacy tools.`,
};

const GROUPS = [
  ["booking-page", "Booking page", "A booking page that quotes, books and takes the deposit"],
  ["payments", "Payments", "Get paid up front, and for the rest without chasing"],
  ["your-day", "Your day", "A diary that knows you drive between jobs"],
  ["customers", "Customers", "Every customer kept in the loop, from your own address"],
  ["team", "Team and data", "Room for your team, and your data stays yours"],
] as const;

export default function FeaturesPage() {
  return (
    <>
      <PageHero
        eyebrow="Features"
        title="Every feature, in one place"
        intro="Everything it does for a mobile detailing or valeting business, from the first quote to the last payment."
      >
        <Ctas className="mt-10 justify-center" />
      </PageHero>

      {GROUPS.map(([id, eyebrow, title]) => (
        <Section key={id} id={id} eyebrow={eyebrow} title={title}>
          <Slot className="h-64">Features and screenshots</Slot>
        </Section>
      ))}

      <ClosingCta title="See it with your own prices" />
    </>
  );
}
