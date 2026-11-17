import type { Metadata } from "next";
import { ClosingCta, PageHero, Section, Slot } from "@/components/landing/site-ui";
import { SITE_NAME } from "@/lib/brand";

// About. Bare bones while the site is rebuilt: each section is a title and a
// marked slot for its content.

export const metadata: Metadata = {
  title: "About",
  description: `${SITE_NAME} was built inside a working mobile detailing business, for the people who run one. Who we are, what we believe and how we look after your data.`,
};

export default function AboutPage() {
  return (
    <>
      <PageHero
        eyebrow="About"
        title="Built inside a working detailing business"
        intro="Who we are, what we believe and how we look after your data."
      />

      <Section id="story" eyebrow="Our story" title="Why it exists">
        <Slot className="h-64">The story</Slot>
      </Section>

      <Section id="beliefs" eyebrow="Principles" title="What we won't compromise on">
        <Slot className="h-48">Principles</Slot>
      </Section>

      <Section id="data" eyebrow="Your data" title="How we look after your data">
        <Slot className="h-48">Data and privacy</Slot>
      </Section>

      <ClosingCta title="Spend less time on admin" />
    </>
  );
}
