import type { Metadata } from "next";
import { ClosingCta, Ctas, PageHero, Section, Slot } from "@/components/landing/site-ui";
import { PRICE } from "@/lib/brand";

// Pricing. Bare bones while the site is rebuilt: each section is a title and
// a marked slot for its content. The price itself comes from lib/brand.ts.

export const metadata: Metadata = {
  title: "Pricing",
  description: `One plan with everything in it: ${PRICE.monthly} a month after a ${PRICE.trialDays}-day free trial. No contract, no booking fees and no cut of your deposits.`,
};

export default function PricingPage() {
  return (
    <>
      <PageHero
        eyebrow="Pricing"
        title="One plan, everything included"
        intro={`${PRICE.monthly} a month after a ${PRICE.trialDays}-day free trial. No contract, no booking fees and no cut of your deposits.`}
      >
        <Ctas className="mt-10 justify-center" />
      </PageHero>

      <Section id="plan" eyebrow="The plan" title="What's included">
        <Slot className="h-64">The plan and everything in it</Slot>
      </Section>

      <Section id="costs" eyebrow="Costs" title="What you pay, and what you don't">
        <Slot className="h-48">Costs breakdown</Slot>
      </Section>

      <Section id="calc" eyebrow="No-shows" title="What no-shows cost you">
        <Slot className="h-64">No-show calculator</Slot>
      </Section>

      <Section id="billing" eyebrow="Billing" title="Billing questions">
        <Slot className="h-48">Billing FAQ</Slot>
      </Section>

      <ClosingCta title={`Try it free for ${PRICE.trialDays} days`} />
    </>
  );
}
