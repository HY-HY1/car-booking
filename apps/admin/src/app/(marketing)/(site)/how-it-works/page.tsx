import type { Metadata } from "next";
import { ClosingCta, Ctas, PageHero, Section, Slot } from "@/components/landing/site-ui";
import { SITE_NAME } from "@/lib/brand";

// How it works, in depth. Bare bones while the site is rebuilt: each section
// is a title and a marked slot for its content. The home page has the short
// version (components/landing/how-it-works-sections.tsx).

export const metadata: Metadata = {
  title: "How it works",
  description: `How ${SITE_NAME} works, from setting up to a customer's first booking, the day of the job and getting paid. With demos.`,
};

export default function HowItWorksPage() {
  return (
    <>
      <PageHero
        eyebrow="How it works"
        title="From first quote to getting paid"
        intro="How it works for you and your customers, from setting up to the day of the job."
      >
        <Ctas className="mt-10 justify-center" />
      </PageHero>

      <Section id="setup" eyebrow="Your business" title="Setting up">
        <Slot className="h-64">Setup steps</Slot>
      </Section>

      <Section id="journey" eyebrow="Your customers" title="One booking, start to finish">
        <Slot className="h-64">A booking, step by step</Slot>
      </Section>

      <Section id="demos" eyebrow="Demos" title="Watch it work">
        <Slot className="aspect-video">Demo video</Slot>
      </Section>

      <Section id="trust" eyebrow="Reliability" title="Why you can rely on it">
        <Slot className="h-48">Hosting, security and support</Slot>
      </Section>

      <ClosingCta title="See it with your own prices" />
    </>
  );
}
