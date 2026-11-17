import { Check, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import overview from "@/components/landing/overview.webp";
import { Faq } from "@/components/landing/faq";
import { FeaturesSection } from "@/components/landing/features-section";
import { CustomerFlow, Implementation } from "@/components/landing/how-it-works-sections";
import { RotatingWord } from "@/components/landing/rotating-word";
import { BrowserFrame, ClosingCta, Ctas, Section, Slot } from "@/components/landing/site-ui";
import { PRICE, SITE_NAME } from "@/lib/brand";

// The public landing page, stripped back to its bones to be rebuilt: each
// section is a title, a line, a call to action and a marked slot for what
// goes there next. Layout, header and footer: ./layout.tsx.

export const metadata: Metadata = {
  title: { absolute: `${SITE_NAME}: booking software for mobile detailers and valeters` },
  description: `Instant quotes, online bookings and deposits for mobile car detailers and valeters, on your own booking page. ${PRICE.monthly} a month after a ${PRICE.trialDays}-day free trial.`,
};

// Who the headline is for, in turn: "Booking Infrastructure for Detailers."
const AUDIENCES = [
  { text: "Detailers", ms: 4000 },
  { text: "Valeters", ms: 4000 },
  { text: "Car Washes", ms: 3000 },
] as const;

const TERMS =`${PRICE.trialDays} days free, then ${PRICE.monthly} a month. No contract.`;

export default function Home() {
  return (
    <>
      {/* hero */}
      <section className="relative isolate overflow-hidden px-4 pt-20 pb-20 sm:px-6 sm:pt-28">
        <div aria-hidden className="site-grid absolute inset-0 -z-10" />
        <div aria-hidden className="site-glow absolute inset-0 -z-10" />

        <div className="mx-auto max-w-6xl text-center">
          <p className="site-rise inline-flex items-center gap-2 rounded-full border border-(--line) bg-(--soft) px-4 py-1.5 text-sm">
            <Sparkles aria-hidden className="size-4 text-(--accent)" />
            Built for mobile detailers and valeters
          </p>

          <h1
            className="site-rise mx-auto mt-8 max-w-4xl text-5xl leading-[1.05] font-semibold tracking-tighter text-balance sm:text-7xl"
            style={{ "--delay": "80ms" } as React.CSSProperties}
          >
            <span className="sr-only">Booking Infrastructure for detailers, valeters and car washes.</span>
            <span aria-hidden>
              Booking Infrastructure <br className="max-sm:hidden" />
              for{" "}
              <span className="text-(--accent)">
                <RotatingWord words={AUDIENCES} />.
              </span>
            </span>
        </h1>

          <p
            className="site-rise mx-auto mt-6 max-w-2xl text-lg text-pretty text-(--muted) sm:text-xl"
            style={{ "--delay": "160ms" } as React.CSSProperties}
          >
            Accurately price qualified leads through your own booking page.
          </p>

          <div className="site-rise" style={{ "--delay": "240ms" } as React.CSSProperties}>
            <Ctas className="mt-10 justify-center" />
            <ul className="mt-6 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-(--muted)">
              {[`${PRICE.trialDays} days free`, "No contract", "No booking fees"].map((fact) => (
                <li key={fact} className="flex items-center gap-1.5">
                  <Check aria-hidden className="size-4 text-(--accent)" />
                  {fact}
                </li>
              ))}
            </ul>
          </div>

          {/* The real dashboard, in a browser window, fading into the page. */}
          <figure className="site-rise relative mx-auto mt-20 max-w-5xl" style={{ "--delay": "360ms" } as React.CSSProperties}>
            <div aria-hidden className="absolute -inset-x-10 -top-10 bottom-1/3 -z-10 rounded-[3rem] bg-(--glow) blur-3xl" />
            <BrowserFrame address="Dashboard" className="shadow-2xl shadow-black/60 mask-[linear-gradient(to_bottom,#000_70%,transparent)]">
              <Image
                src={overview}
                alt="The dashboard overview: this week's income, jobs, booked value, new bookings, leads and new customers, above income and jobs charts"
                sizes="(min-width: 1024px) 64rem, 100vw"
                placeholder="blur"
                priority
                className="h-auto w-full"
              />
            </BrowserFrame>
          </figure>
        </div>
      </section>

      {/* proof: only real figures and quotes, never placeholders (lib/proof.ts) */}
      <section className="px-4 pb-20 sm:px-6">
        <Slot className="mx-auto h-28 max-w-6xl">Proof: real numbers, logos or a quote</Slot>
      </section>

      <CustomerFlow />

      <Implementation />

      <FeaturesSection />

      <Section id="pricing" title="One plan, everything included" link={["See pricing", "/pricing"]}>
        <div className="rounded-lg border border-(--line) p-8 text-center">
          <p className="text-5xl font-semibold tracking-tight">
            {PRICE.monthly}
            <span className="text-lg font-normal text-(--muted)"> / month</span>
          </p>
          <p className="mt-3 text-(--muted)">{TERMS}</p>
          <Ctas className="mt-8 justify-center" />
        </div>
      </Section>

      <Faq />

      <ClosingCta title="Take your next booking tonight" note={TERMS} />
    </>
  );
}
