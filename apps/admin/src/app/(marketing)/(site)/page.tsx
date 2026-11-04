import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import bookingHome from "@/components/landing/booking-home.webp";
import bookingQuote from "@/components/landing/booking-quote.webp";
import overview from "@/components/landing/overview.webp";
import { DemoFrame } from "@/components/landing/demo-frame";
import { ProofStats, ResultBlock, Testimonials } from "@/components/landing/proof";
import { QuoteDemo } from "@/components/landing/quote-demo";
import { RouteDay } from "@/components/landing/route-day";
import { CtaBand, PlaceholderTag, TrialButton, kicker } from "@/components/landing/ui";
import { PRICE, PRODUCT_NAME } from "@/lib/brand";
import { DEMOS } from "@/lib/demos";
import { HERO_PROOF } from "@/lib/proof";
import { appUrl } from "@/lib/urls";

// The public landing page. Layout, fonts, header and footer: ./layout.tsx.

export const metadata: Metadata = {
  title: { absolute: `${PRODUCT_NAME}: booking software for mobile detailers and valeters` },
  description: `Instant quotes, online bookings and deposits for mobile car detailers and valeters, on your own booking page. ${PRICE.monthly} a month after a ${PRICE.trialDays}-day free trial.`,
};

// Everyday problems, what used to happen and what happens now.
const PROBLEMS = [
  {
    moment: "A message at 10pm: “How much for a valet on a Focus?”",
    before: "You reply in the morning. By then they've booked someone who answered.",
    after: "They get a price for their car on your page straight away, and book themselves in.",
  },
  {
    moment: "Saturday, 9am. Nobody answers the door.",
    before: "An empty slot, a wasted drive, and no way to get the time back.",
    after: "They paid a deposit to hold the slot, and got a reminder the day before.",
  },
  {
    moment: "You open the door to a car full of dog hair.",
    before: "You do it for the standard price you quoted over text.",
    after: "Their photos flagged it when they booked, so the price already covers it.",
  },
  {
    moment: "Two jobs on opposite sides of town.",
    before: "Booked back to back with no time to drive between them. You're late to the second.",
    after: "Times are only offered when there's room to drive from your last job.",
  },
  {
    moment: "Chasing the balance after the job.",
    before: "Bank details by text, then checking your account to see if it's arrived.",
    after: "A payment link by email. They get a receipt, you see it marked paid on the booking.",
  },
  {
    moment: "Planning tomorrow at 7am.",
    before: "Working out leave times in your head and copying postcodes into the sat nav.",
    after: "A run sheet with leave-by times from live traffic, and one tap to Waze.",
  },
] as const;

const STEPS = [
  ["Pick a service", "With photos, what's included and your prices."],
  ["Tell us the car", "Its size sets the price. Extras go on top."],
  ["Add photos, if they like", "We check the condition, so a car that needs more work is priced for it."],
  ["Pick a time", "Only times inside your hours that leave room to drive from your last job."],
  ["Pay the deposit", "By card, straight to your Stripe account. Booked."],
] as const;

const HANDLES = [
  ["Deposits, straight to you", "Paid by card into your own Stripe account. We don't take a cut."],
  ["Your own web address", "Run your booking page on book.yourbusiness.co.uk, or use the free address you get on day one."],
  ["Emails from you", "Confirmations, reminders and review requests come from your own email address, and replies come back to you."],
  ["Payment links", "Email a customer the balance. When they pay, they get a thank-you and a receipt."],
  ["Photo condition check", "Customers add photos and the quote allows for a car that needs more work. If it can't tell, it asks you to check."],
  ["Vans and bays", "Each with its own hours. Bookings go to whichever one is free."],
] as const;

const GETTING_STARTED = [
  ["Sign up", `Your business name, trade and postcode. Your booking page exists the moment you finish, and the ${PRICE.trialDays}-day trial starts.`],
  ["Add your prices and hours", "Services, car sizes, extras and working hours. A checklist on your dashboard shows what's left."],
  ["Share your link", "Connect Stripe to take deposits, then put the link in your bio, your Google profile and your replies. Or add the button to your website."],
] as const;

const QUESTIONS = [
  [
    "Do I need a website?",
    "No. You get a booking page at a free address the day you sign up. If you already have a website, add the booking button to it.",
  ],
  [
    "Where do deposits go?",
    "Straight into your own Stripe account. We never hold your money and don't take a percentage. Stripe charges its normal card fee.",
  ],
  [
    "What about no-shows?",
    "Customers pay a deposit when they book, and your cancellation policy decides what's refunded. A reminder goes out before every job.",
  ],
  ["Can my staff log in?", "Yes. Each person gets their own login with office, technician or manager access."],
  ["Who owns the data?", "You do. Export everything whenever you like. Tools for customers' privacy requests are built in."],
] as const;

export default function Home() {
  const signup = appUrl("/signup");

  return (
    <>
      {/* ------------------------------------------------------------ hero */}
      <section className="relative overflow-hidden px-4 pt-12 pb-16 sm:px-6 sm:pt-20 lg:pb-24">
        <div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[1fr_auto]">
          <div className="relative z-10">
            <p className={`${kicker} text-(--mist)`}>Booking software for mobile detailers &amp; valeters</p>
            <h1 className="lp-display mt-6 text-[clamp(3rem,7.5vw,6.25rem)] leading-[0.98]">
              Quoted. Booked.
              <br />
              Deposit paid<span className="text-(--hi)">.</span>
            </h1>
            <p className="mt-3 text-xl text-(--hi) sm:text-2xl">While you&apos;re busy on the job you&apos;re on.</p>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-(--mist)">
              Customers get a price for their car, pick a time that fits around your other jobs and pay a deposit, on
              your own booking page, at any hour. You finish the car in front of you and the next one is already in the
              diary.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-x-8 gap-y-4">
              <TrialButton />
              <a href="#customer" className="lp-data text-sm text-(--paper) underline decoration-(--hi) decoration-2 underline-offset-8">
                Try the customer side ↓
              </a>
            </div>
            <p className="lp-data mt-5 text-xs text-(--mist)">
              {PRICE.monthly} a month after the trial · no contract · no booking fees
            </p>

            <p className="mt-10 flex max-w-md items-center gap-4 border-t border-(--rule-dark) pt-5 text-sm">
              <span aria-hidden className="size-2 shrink-0 animate-pulse rounded-full bg-[#3ddc84] motion-reduce:animate-none" />
              <span className="text-(--mist)">
                {HERO_PROOF ? (
                  <>
                    <span className="text-(--paper)">{HERO_PROOF.text}</span>
                    {HERO_PROOF.placeholder && <PlaceholderTag />}
                  </>
                ) : (
                  "Your deposits go straight to your own Stripe account. We never take a cut."
                )}
              </span>
            </p>
          </div>

          <div className="relative lg:pr-4">
            <JobTicket />
          </div>
        </div>
      </section>

      {/* --------------------------------------------- the dashboard, for real */}
      <figure className="bg-[linear-gradient(var(--ink)_0_55%,var(--paper)_55%_100%)] px-4 sm:px-6">
        <div className="lp-tilt mx-auto max-w-6xl border border-(--rule-dark) bg-[#0a0a0a]">
          <div className="lp-data flex items-center justify-between gap-4 border-b border-(--rule-dark) px-4 py-2.5 text-[11px] text-(--mist)">
            <span>{PRODUCT_NAME} · Overview</span>
            <span aria-hidden className="flex gap-1.5">
              <span className="size-2 rounded-full bg-(--rule-dark)" />
              <span className="size-2 rounded-full bg-(--rule-dark)" />
              <span className="size-2 rounded-full bg-(--rule-dark)" />
            </span>
          </div>
          <Image
            src={overview}
            alt={`The ${PRODUCT_NAME} dashboard overview: this week's income, jobs, booked value, new bookings, leads and new customers, each against the week before, above income and jobs charts`}
            sizes="(min-width: 1152px) 72rem, 100vw"
            placeholder="blur"
            priority
            className="h-auto w-full"
          />
        </div>
        <figcaption className="lp-data mx-auto max-w-6xl pt-3 text-xs text-(--graphite)">
          Your week at a glance: income, jobs and enquiries, against the week before.
        </figcaption>
      </figure>

      {/* ------------------------------------- proof in numbers, then problems */}
      <section id="problems" aria-labelledby="problems-heading" className="scroll-mt-4 bg-(--paper) px-4 pt-16 pb-20 text-(--ink) sm:px-6 sm:pt-20 sm:pb-28">
        <div className="mx-auto max-w-7xl">
          <ProofStats />

          <div className="mt-20 grid gap-6 lg:grid-cols-12">
            <h2 id="problems-heading" className="lp-display text-[clamp(2.25rem,4.5vw,3.75rem)] leading-[0.95] lg:col-span-6">
              The bits of the job that aren&apos;t the job
            </h2>
            <p className="max-w-md text-lg leading-relaxed text-(--graphite) lg:col-span-5 lg:col-start-8 lg:self-end">
              Six things every mobile detailer knows, what usually happens, and what happens with {PRODUCT_NAME}.
            </p>
          </div>

          <div className="mt-14">
            <div aria-hidden className="hidden grid-cols-12 gap-6 border-b-2 border-(--ink) pb-3 md:grid">
              <span className={`${kicker} col-span-4 text-(--graphite)`}>When</span>
              <span className={`${kicker} col-span-4 text-(--graphite)`}>Usually</span>
              <span className={`${kicker} col-span-4 text-(--ink)`}>With {PRODUCT_NAME}</span>
            </div>
            <ol>
              {PROBLEMS.map((p) => (
                <li key={p.moment} className="grid gap-3 border-b border-(--rule) py-6 md:grid-cols-12 md:gap-6">
                  <p className="text-lg font-semibold md:col-span-4">{p.moment}</p>
                  <p className="text-(--graphite) md:col-span-4">
                    <span className={`${kicker} mr-2 text-(--graphite) md:hidden`}>Usually</span>
                    {p.before}
                  </p>
                  <p className="border-l-2 border-(--hi) pl-4 md:col-span-4">
                    <span className={`${kicker} mr-2 md:hidden`}>Now</span>
                    {p.after}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------- the customer side */}
      <section id="customer" aria-labelledby="customer-heading" className="scroll-mt-4 px-4 py-20 sm:px-6 sm:py-24">
        <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-20">
          <div>
            <h2 id="customer-heading" className="lp-display text-[clamp(2.25rem,4.5vw,3.75rem)]">
              The customer side
            </h2>
            <p className="mt-5 max-w-md text-lg leading-relaxed text-(--mist)">
              This is what your customers see. Have a go: it works the way the real thing does, with example prices.
            </p>
            <ol className="mt-10 max-w-md">
              {STEPS.map(([title, text], i) => (
                <li key={title} className="grid grid-cols-[3rem_1fr] border-t border-(--rule-dark) py-4 last:border-b">
                  <span className="lp-data pt-0.5 text-sm text-(--hi)">{String(i + 1).padStart(2, "0")}</span>
                  <span>
                    <span className="block font-semibold">{title}</span>
                    <span className="block text-sm text-(--mist)">{text}</span>
                  </span>
                </li>
              ))}
            </ol>
          </div>
          <div className="lg:pt-20">
            <QuoteDemo signupHref={signup} />
          </div>
        </div>
      </section>

      {/* ------------------------------------------------ in their own words */}
      <Testimonials />

      {/* ------------------------------------------------------- the tour */}
      <section aria-labelledby="tour-heading" className="px-4 py-20 sm:px-6 sm:py-24">
        <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] lg:items-center lg:gap-16">
          <div>
            <h2 id="tour-heading" className="lp-display text-[clamp(2.25rem,4.5vw,3.75rem)] leading-[0.95]">
              See the whole thing
            </h2>
            <p className="mt-5 max-w-md text-lg leading-relaxed text-(--mist)">
              A booking from the first price to the payment, on both sides: what your customer sees, and what lands on
              your phone.
            </p>
            <div className="mt-8 grid gap-4">
              <Link href="/how-it-works" className="lp-data text-sm underline decoration-(--hi) decoration-2 underline-offset-8">
                How it works, step by step →
              </Link>
              <Link href="/contact?topic=demo" className="lp-data text-sm underline decoration-(--hi) decoration-2 underline-offset-8">
                Book a live demo →
              </Link>
            </div>
          </div>
          <DemoFrame demo={DEMOS.tour} />
        </div>
      </section>

      {/* ------------------------------------------------------ your side */}
      <section aria-labelledby="your-side" className="border-t border-(--rule-dark) py-20 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="grid gap-6 lg:grid-cols-[auto_1fr] lg:items-end lg:gap-16">
            <h2 id="your-side" className="lp-display text-[clamp(2.25rem,4.5vw,3.75rem)]">
              Your side
            </h2>
            <p className="max-w-2xl text-lg leading-relaxed text-(--mist)">
              Bookings land in your diary, van by van. The route planner works back from each start time with
              Google&apos;s traffic forecast, tells you when to leave, and opens each drive in Waze or Google Maps.
            </p>
          </div>
        </div>
        <div className="mt-14">
          <RouteDay />
        </div>
      </section>

      {/* ------------------------------------------------- what it handles */}
      <section aria-labelledby="handles" className="bg-(--paper) px-4 py-24 text-(--ink) sm:px-6 sm:py-28">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <h2 id="handles" className="lp-display max-w-3xl text-[clamp(2.25rem,5vw,4.25rem)]">
              What it takes off your plate
            </h2>
            <Link href="/features" className="lp-data text-sm underline decoration-(--hi) decoration-2 underline-offset-8">
              Every feature →
            </Link>
          </div>
          <ol className="mt-12 grid border-t-2 border-(--ink) md:grid-cols-2 md:gap-x-16">
            {HANDLES.map(([title, text], i) => (
              <li key={title} className="grid grid-cols-[3.5rem_1fr] items-start gap-4 border-b border-(--rule) py-6 sm:grid-cols-[4.5rem_1fr]">
                <span aria-hidden className="lp-display lp-outline text-4xl sm:text-5xl">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span>
                  <span className="block text-lg font-semibold">{title}</span>
                  <span className="mt-1 block text-(--graphite)">{text}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* --------------------------------------------- a booking page, a result */}
      <section aria-labelledby="result-heading" className="px-4 py-24 sm:px-6 sm:py-32">
        <div className="mx-auto grid max-w-7xl gap-14 lg:grid-cols-12 lg:gap-10">
          {/* A real booking page, as customers see it on their phone. */}
          <div className="relative mx-auto flex w-full max-w-md justify-center lg:col-span-5 lg:mx-0">
            <Image
              src={bookingHome}
              alt="A booking page on a phone: the business's services and prices, with a button for an instant quote"
              sizes="(min-width: 1024px) 15rem, 45vw"
              className="lp-printed-hi relative z-10 h-auto w-[56%] border-2 border-(--paper)"
            />
            <Image
              src={bookingQuote}
              alt="The first step of booking: choosing a service"
              sizes="(min-width: 1024px) 15rem, 45vw"
              className="mt-16 -ml-[12%] h-auto w-[56%] border-2 border-(--paper)"
            />
          </div>

          <div className="lg:col-span-6 lg:col-start-7">
            <ResultBlock />
            <BookingPageFacts />
          </div>
        </div>
      </section>

      {/* ------------------------------------------------- getting started */}
      <section aria-labelledby="start-heading" className="bg-(--paper) px-4 py-20 text-(--ink) sm:px-6 sm:py-28">
        <div className="mx-auto max-w-7xl">
          <h2 id="start-heading" className="lp-display max-w-3xl text-[clamp(2.25rem,4.5vw,3.75rem)] leading-[0.95]">
            Three steps to your first booking
          </h2>
          <ol className="mt-12 grid gap-px border-2 border-(--ink) bg-(--ink) md:grid-cols-3">
            {GETTING_STARTED.map(([title, text], i) => (
              <li key={title} className="bg-(--paper) p-6 sm:p-8">
                <span className="lp-display lp-outline text-6xl">{i + 1}</span>
                <p className="mt-4 text-xl font-semibold">{title}</p>
                <p className="mt-2 text-(--graphite)">{text}</p>
              </li>
            ))}
          </ol>
          <Link href="/how-it-works" className="lp-data mt-8 inline-block text-sm underline decoration-(--hi) decoration-2 underline-offset-8">
            What happens after that, step by step →
          </Link>
        </div>
      </section>

      {/* ---------------------------------------------------------- pricing */}
      <section id="pricing" aria-labelledby="pricing-heading" className="scroll-mt-4 px-4 py-20 sm:px-6 sm:py-28">
        <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[auto_1fr] lg:gap-24">
          <div>
            <h2 id="pricing-heading" className={`${kicker} text-(--mist)`}>
              Pricing
            </h2>
            <p className="mt-4 flex items-start gap-3">
              <span className="lp-display text-[clamp(6rem,15vw,10rem)] leading-[0.8]">{PRICE.monthly}</span>
              <span className="lp-data pt-2 text-base text-(--mist)">
                a<br />
                month
              </span>
            </p>
            <TrialButton className="mt-10" />
          </div>

          <div className="lg:pt-6">
            <ul className="border-t border-(--rule-dark)">
              {[
                `${PRICE.trialDays} days free, then ${PRICE.monthly} a month.`,
                "No contract. Stop whenever you like.",
                "No booking fees and no cut of your deposits. Stripe charges its standard card fee.",
                "Everything, with no limit on bookings, customers or vans.",
              ].map((line) => (
                <li key={line} className="flex gap-4 border-b border-(--rule-dark) py-4 text-lg">
                  <span aria-hidden className="mt-2.5 size-2 shrink-0 bg-(--hi)" />
                  {line}
                </li>
              ))}
            </ul>
            <Link href="/pricing" className="lp-data mt-6 inline-block text-sm underline decoration-(--hi) decoration-2 underline-offset-8">
              What&apos;s included, and what a no-show costs you →
            </Link>
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------- questions */}
      <section aria-labelledby="questions" className="bg-(--paper) px-4 py-20 text-(--ink) sm:px-6 sm:py-24">
        <div className="mx-auto max-w-7xl">
          <h2 id="questions" className={`${kicker} text-(--graphite)`}>
            Questions
          </h2>
          <dl className="mt-6">
            {QUESTIONS.map(([q, a]) => (
              <div key={q} className="grid gap-3 border-t border-(--rule) py-7 md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] md:gap-12">
                <dt className="lp-display text-2xl sm:text-3xl">{q}</dt>
                <dd className="text-lg leading-relaxed text-(--graphite) md:pt-1">{a}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 border-t border-(--rule) pt-6 text-(--graphite)">
            More about billing on the{" "}
            <Link href="/pricing" className="text-(--ink) underline decoration-(--hi) decoration-2 underline-offset-4">
              pricing page
            </Link>
            .
          </p>
        </div>
      </section>

      <CtaBand />
    </>
  );
}

// Beside the phones when there's no result to show, and under it when there is.
function BookingPageFacts() {
  return (
    <div className="mt-10 first:mt-0">
      <p className={`${kicker} text-(--mist)`}>Your booking page</p>
      <dl className="mt-4 grid gap-x-8 gap-y-5 border-t-2 border-(--paper) pt-6 sm:grid-cols-2">
        {[
          ["Your brand", "Your logo, colours and photos, on your own web address if you have one."],
          ["Live prices", "Worked out from the car's size, the extras and the photos. Never a guess."],
          ["Real availability", "Only times that fit your hours, your other jobs and the drive between them."],
          ["Deposit on booking", "Paid by card into your own Stripe account, before the slot is theirs."],
        ].map(([title, text]) => (
          <div key={title}>
            <dt className="font-semibold">{title}</dt>
            <dd className="mt-1 text-(--mist)">{text}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

// A printed booking, as it lands: perforated across the middle, with the
// deposit stamped paid.
function JobTicket() {
  return (
    <div
      className="lp-ticket relative mx-auto w-full max-w-[21rem] bg-(--paper) text-(--ink) [--tilt:1.5deg] lg:mx-0 lg:w-[21rem] lg:[--tilt:-2deg]"
      aria-label="Example booking: full valet on a Ford Focus, Thursday 30 October, 8:30am, £105 with a £20 deposit paid"
      role="img"
    >
      <div className="lp-data flex justify-between border-b-2 border-(--ink) px-5 py-3 text-xs">
        <span>JOB 0412</span>
        <span>THU 30 OCT</span>
      </div>
      <div className="px-5 pt-4 pb-5">
        <p className="lp-data text-sm text-(--graphite)">08:30–11:00 · Driveway · 6 miles</p>
        <p className="lp-display mt-2 text-4xl">Full valet</p>
        <p className="mt-1 text-sm">Ford Focus · Medium</p>
        <p className="text-sm text-(--graphite)">+ Pet hair removal</p>
      </div>

      {/* Perforation, with notches cut out of each side. */}
      <div aria-hidden className="relative h-0 border-t-2 border-dashed border-(--rule)">
        <span className="absolute -top-3 -left-3 size-6 rounded-full bg-(--ink)" />
        <span className="absolute -top-3 -right-3 size-6 rounded-full bg-(--ink)" />
      </div>

      <dl className="lp-data grid grid-cols-[1fr_auto] gap-y-1.5 px-5 pt-5 pb-6 text-sm">
        <dt className="text-(--graphite)">Total</dt>
        <dd>£105.00</dd>
        <dt className="text-(--graphite)">Deposit</dt>
        <dd>£20.00</dd>
        <dt className="text-(--graphite)">On the day</dt>
        <dd className="font-semibold">£85.00</dd>
      </dl>

      <p
        aria-hidden
        className="lp-data absolute top-[5.9rem] right-4 -rotate-12 border-2 border-[#d9430b] px-2 py-1 text-xs font-semibold tracking-[0.2em] text-[#d9430b] uppercase"
      >
        Deposit paid
      </p>
    </div>
  );
}
