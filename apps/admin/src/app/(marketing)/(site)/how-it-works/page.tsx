import type { Metadata } from "next";
import Link from "next/link";
import { DemoFrame } from "@/components/landing/demo-frame";
import { CtaBand, PageIntro, TrialButton, kicker } from "@/components/landing/ui";
import { PRICE, PRODUCT_NAME } from "@/lib/brand";
import { DEMOS } from "@/lib/demos";
import { marketingUrl } from "@/lib/urls";

export const metadata: Metadata = {
  title: "How it works",
  description: `How ${PRODUCT_NAME} works, from setting up to a customer's first booking, the day of the job and getting paid. With demos.`,
};

// Setting up, in the order the dashboard's checklist asks for it.
const SETUP = [
  ["Sign up", "Business name, trade and postcode. Your booking page is live at a free address straight away."],
  ["Add your services", "Prices by car size, extras, how long each takes, and the photos customers see."],
  ["Set your hours and area", "When you work, where you'll travel to, and any vans or bays with their own hours."],
  ["Connect Stripe", "A few minutes on Stripe's own pages. Deposits then go straight to your bank account from there."],
  ["Share your link", "In your bio, your Google profile, your replies, or as a button on your website."],
] as const;

// One booking, as it happens. Times are an example.
const JOURNEY = [
  {
    when: "Tue 21:47",
    who: "Customer",
    title: "Gets a price",
    text: "Chooses a service, picks their car's size and any extras, and adds photos if they like. The price updates as they go.",
  },
  {
    when: "Tue 21:49",
    who: "Customer",
    title: "Books and pays the deposit",
    text: "Picks from times that fit your hours and the drive from your other jobs, then pays by card. The slot is held while they pay.",
  },
  {
    when: "Tue 21:49",
    who: "You",
    title: "It's in the diary",
    text: "The customer gets a confirmation from your email address. You get an alert, and the job is in the diary on the right van.",
  },
  {
    when: "Fri 09:00",
    who: "Customer",
    title: "A reminder",
    text: "Before the job, with the time and what you need from them, so the car's there and someone's in.",
  },
  {
    when: "Sat 07:30",
    who: "You",
    title: "Your day, planned",
    text: "The route planner tells you when to leave for each job from the traffic forecast, and opens each drive in Waze or Google Maps.",
  },
  {
    when: "Sat 11:00",
    who: "You",
    title: "The balance, paid",
    text: "Email a payment link from the booking. They pay by card, get a receipt, and the booking shows as paid in full.",
  },
  {
    when: "Sun 10:00",
    who: "Customer",
    title: "A review request",
    text: "If they've said yes to hearing from you, a thank-you asking for a review, with an unsubscribe link.",
  },
] as const;

// Why it's safe to rely on.
const TRUST = [
  ["Card payments by Stripe", "Card details go into Stripe's secure form and never touch our servers. Stripe handles payments for millions of businesses."],
  ["Your money never passes through us", "Deposits and payments are paid into your own Stripe account. We can't hold them and we don't take a cut."],
  ["Your data, your rules", "Your customers' details belong to your business. Export everything any time, and handle privacy requests from your dashboard."],
  ["No lock-in", `No contract. ${PRICE.trialDays} days free, then month to month. If you leave, take your data with you.`],
  ["Built for this trade", "Car sizes, extras, travel between jobs, vans and bays, condition from photos. Not a salon booking tool with a car photo on it."],
  ["A person to talk to", "Questions go to the people who build it, not a call centre. Send a message and we reply by email."],
] as const;

export default function HowItWorksPage() {
  return (
    <>
      <PageIntro
        eyebrow="How it works"
        title={
          <>
            From &ldquo;how much?&rdquo; to the review request<span className="text-(--hi)">.</span>
          </>
        }
      >
        <p>
          What happens when you sign up, what your customers see when they book, and what happens after, step by step.
        </p>
      </PageIntro>

      {/* ------------------------------------------------------- the tour */}
      <section aria-label="Demo" className="px-4 pb-20 sm:px-6 sm:pb-28">
        <div className="mx-auto max-w-6xl">
          <DemoFrame demo={DEMOS.tour} />
        </div>
      </section>

      {/* ------------------------------------------------------ setting up */}
      <section aria-labelledby="setup-heading" className="bg-(--paper) px-4 py-20 text-(--ink) sm:px-6 sm:py-28">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-6 lg:grid-cols-12">
            <div className="lg:col-span-6">
              <p className={`${kicker} text-(--graphite)`}>Day one</p>
              <h2 id="setup-heading" className="lp-display mt-4 text-[clamp(2.25rem,4.5vw,3.75rem)] leading-[0.95]">
                Setting up
              </h2>
            </div>
            <p className="max-w-md text-lg leading-relaxed text-(--graphite) lg:col-span-5 lg:col-start-8 lg:self-end">
              A checklist on your dashboard walks you through it and shows what&apos;s left. Nothing goes to customers
              until you share your link.
            </p>
          </div>

          <ol className="mt-12 grid gap-px border-2 border-(--ink) bg-(--ink) sm:grid-cols-2 lg:grid-cols-5">
            {SETUP.map(([title, text], i) => (
              <li key={title} className="bg-(--paper) p-6">
                <span className="lp-display lp-outline text-5xl">{i + 1}</span>
                <p className="mt-4 text-lg font-semibold">{title}</p>
                <p className="mt-2 text-(--graphite)">{text}</p>
              </li>
            ))}
          </ol>
          <p className="mt-8">
            <TrialButton />
          </p>
        </div>
      </section>

      {/* ----------------------------------------------------- one booking */}
      <section aria-labelledby="journey-heading" className="px-4 py-20 sm:px-6 sm:py-28">
        <div className="mx-auto grid max-w-7xl gap-14 lg:grid-cols-12">
          <div className="lg:sticky lg:top-8 lg:col-span-5 lg:self-start">
            <p className={`${kicker} text-(--mist)`}>Then, every booking</p>
            <h2 id="journey-heading" className="lp-display mt-4 text-[clamp(2.25rem,4.5vw,3.75rem)] leading-[0.95]">
              One booking, start to finish
            </h2>
            <p className="mt-5 max-w-md text-lg leading-relaxed text-(--mist)">
              An example job, booked on a Tuesday night while you&apos;re off the clock, done on Saturday. You do the
              valet. Everything else happens on its own.
            </p>
          </div>

          <ol className="relative lg:col-span-7">
            <span aria-hidden className="absolute top-2 bottom-2 left-[7.5rem] hidden w-px bg-(--rule-dark) sm:block" />
            {JOURNEY.map((step) => (
              <li key={`${step.when}${step.title}`} className="relative grid gap-2 py-6 sm:grid-cols-[7.5rem_1fr] sm:gap-8">
                <span className="lp-data pt-1 text-sm text-(--mist)">{step.when}</span>
                <span className="relative">
                  <span aria-hidden className="absolute top-2 -left-[2.3rem] hidden size-3 border-2 border-(--hi) bg-(--ink) sm:block" />
                  <span className={`lp-data text-[11px] tracking-[0.14em] uppercase ${step.who === "You" ? "text-(--hi)" : "text-(--mist)"}`}>
                    {step.who}
                  </span>
                  <span className="mt-1 block text-xl font-semibold">{step.title}</span>
                  <span className="mt-1 block text-(--mist)">{step.text}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ---------------------------------------------------- short demos */}
      <section aria-labelledby="demos-heading" className="border-t border-(--rule-dark) px-4 py-20 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <h2 id="demos-heading" className="lp-display text-[clamp(2.25rem,4.5vw,3.75rem)] leading-[0.95]">
              Watch it work
            </h2>
            <Link href="/contact?topic=demo" className="lp-data text-sm underline decoration-(--hi) decoration-2 underline-offset-8">
              Or book a live demo →
            </Link>
          </div>
          <ul className="mt-12 grid gap-10 md:grid-cols-3 md:gap-6">
            {[DEMOS.booking, DEMOS.day, DEMOS.paid].map((d) => (
              <li key={d.title}>
                <DemoFrame demo={d} size="small" />
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ---------------------------------------------------------- trust */}
      <section aria-labelledby="trust-heading" className="bg-(--paper) px-4 py-20 text-(--ink) sm:px-6 sm:py-28">
        <div className="mx-auto max-w-7xl">
          <h2 id="trust-heading" className="lp-display max-w-3xl text-[clamp(2.25rem,4.5vw,3.75rem)] leading-[0.95]">
            Why you can rely on it
          </h2>
          <ul className="mt-12 grid gap-px border-2 border-(--ink) bg-(--ink) md:grid-cols-2 lg:grid-cols-3">
            {TRUST.map(([title, text]) => (
              <li key={title} className="bg-(--paper) p-6 sm:p-8">
                <span aria-hidden className="lp-data text-(--hi)">
                  ■
                </span>
                <p className="mt-3 text-xl font-semibold">{title}</p>
                <p className="mt-2 text-(--graphite)">{text}</p>
              </li>
            ))}
          </ul>
          <p className="mt-8 text-(--graphite)">
            How we handle data is set out in our{" "}
            <Link href={marketingUrl("/legal/privacy")} className="text-(--ink) underline decoration-(--hi) decoration-2 underline-offset-4">
              privacy policy
            </Link>{" "}
            and{" "}
            <Link href={marketingUrl("/legal/dpa")} className="text-(--ink) underline decoration-(--hi) decoration-2 underline-offset-4">
              data processing terms
            </Link>
            , and who else is involved is on the{" "}
            <Link href="/about" className="text-(--ink) underline decoration-(--hi) decoration-2 underline-offset-4">
              about page
            </Link>
            .
          </p>
        </div>
      </section>

      <CtaBand title="See it with your own prices." />
    </>
  );
}
