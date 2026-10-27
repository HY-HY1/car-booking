import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Big_Shoulders, IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import { PLATFORM } from "@leadgen/core/privacy/platform";
import ascndHome from "@/components/landing/ascnd-home.webp";
import ascndOverview from "@/components/landing/ascnd-overview.webp";
import ascndQuote from "@/components/landing/ascnd-quote.webp";
import { QuoteDemo } from "@/components/landing/quote-demo";
import { CASE_STUDY, PRODUCT_NAME, SALES_EMAIL } from "@/lib/brand";
import { appUrl, docsUrl, marketingUrl } from "@/lib/urls";
import "./landing.css";

// The public landing page. Its look is a printed job sheet: oil black and
// paper, condensed display type, times and prices in mono, one hi-vis orange.

const display = Big_Shoulders({ subsets: ["latin"], axes: ["opsz"], variable: "--font-display" });
const body = IBM_Plex_Sans({ subsets: ["latin"], variable: "--font-body" });
const data = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-data" });

export const metadata: Metadata = {
  title: { absolute: `${PRODUCT_NAME}: booking software for mobile detailers and valeters` },
  description:
    "Instant quotes, online bookings and deposits for mobile car detailers and valeters, on your own booking page. £49 a month after a 14-day free trial.",
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

// A van's day, as the route planner lays it out.
const ROUTE = [
  { kind: "home", time: "08:05", title: "Leave home", place: "GL51 0QX" },
  { kind: "drive", text: "15 min drive" },
  { kind: "job", time: "08:30–11:00", title: "Full valet", place: "Ford Focus · Charlton Kings" },
  { kind: "drive", text: "Leave by 11:16 · 16 min spare · 19 min drive" },
  { kind: "job", time: "11:45–13:15", title: "Mini valet", place: "VW Polo · Prestbury" },
  { kind: "drive", text: "Leave by 13:41 · 26 min spare · 24 min drive" },
  { kind: "job", time: "14:15–17:00", title: "Enhancement", place: "BMW X5 · Bishop's Cleeve" },
  { kind: "drive", text: "22 min drive" },
  { kind: "home", time: "17:22", title: "Back home", place: "GL51 0QX" },
] as const;

const HANDLES = [
  ["Deposits, straight to you", "Paid by card into your own Stripe account. We don't take a cut."],
  ["Your own web address", "Run your booking page on book.yourbusiness.co.uk, or use the free address you get on day one."],
  ["Emails from you", "Confirmations, reminders and review requests come from your own email address, and replies come back to you."],
  ["Payment links", "Email a customer the balance. When they pay, they get a thank-you and a receipt."],
  ["Photo condition check", "Customers add photos and the quote allows for a car that needs more work. If it can't tell, it asks you to check."],
  ["Vans and bays", "Each with its own hours. Bookings go to whichever one is free."],
  ["Every enquiry kept", "Anyone who gets a quote and leaves their details is saved, so you can follow up."],
  ["Approve first, if you prefer", "Switch on approval and every booking waits for your OK before it's confirmed."],
  ["Staff logins", "Office, technician and manager access, each seeing what their job needs."],
  ["A button for your website", "One line of code puts an instant quote button on any site you already have."],
] as const;

const QUESTIONS = [
  [
    "Do I need a website?",
    "No. You get a booking page at a free address the day you sign up. If you already have a website, add the booking button to it.",
  ],
  [
    "Can I use my own web address?",
    "Yes. Add two records at whoever manages your domain and your booking page runs on an address like book.yourbusiness.co.uk.",
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
  [
    "How long does setting up take?",
    "Add your services, prices and working hours, connect Stripe, and you're taking bookings. A checklist walks you through it.",
  ],
] as const;

const kicker = "lp-data text-xs tracking-[0.18em] uppercase";

export default function Home() {
  const signup = appUrl("/signup");
  const docs = docsUrl();
  const caseHost = CASE_STUDY.url.replace(/^https:\/\//, "");

  return (
    <div className={`lp ${display.variable} ${body.variable} ${data.variable} flex min-h-dvh flex-col antialiased`}>
      {/* ------------------------------------------------------------ header */}
      <header className="border-b border-(--rule-dark)">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/" className="lp-display flex items-center gap-2 text-2xl">
            <span aria-hidden className="size-2.5 bg-(--hi)" />
            {PRODUCT_NAME}
          </Link>
          <nav aria-label="Main" className="flex items-center gap-1 text-sm sm:gap-2">
            <a href="#problems" className="hidden px-3 py-2 text-(--mist) hover:text-(--paper) md:block">
              How it helps
            </a>
            <a href="#case-study" className="hidden px-3 py-2 text-(--mist) hover:text-(--paper) md:block">
              Customers
            </a>
            <a href="#pricing" className="hidden px-3 py-2 text-(--mist) hover:text-(--paper) md:block">
              Pricing
            </a>
            {docs && (
              <a href={docs} className="hidden px-3 py-2 text-(--mist) hover:text-(--paper) lg:block">
                Docs
              </a>
            )}
            <Link href={appUrl("/login")} className="px-3 py-2 text-(--mist) hover:text-(--paper)">
              Sign in
            </Link>
            <Link href={signup} className="bg-(--paper) px-4 py-2 font-semibold text-(--ink) hover:bg-white">
              <span className="sm:hidden">Free trial</span>
              <span className="hidden sm:inline">Start free trial</span>
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">
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
                Customers get a price for their car, pick a time that fits around your other jobs and pay a deposit,
                on your own booking page, at any hour. You finish the car in front of you and the next one is already
                in the diary.
              </p>
              <div className="mt-9 flex flex-wrap items-center gap-x-8 gap-y-4">
                <Link href={signup} className="bg-(--hi) px-6 py-3.5 font-semibold text-(--ink) hover:bg-[#ff7140]">
                  Start your 14-day free trial
                </Link>
                <a href="#customer" className="lp-data text-sm text-(--paper) underline decoration-(--hi) decoration-2 underline-offset-8">
                  Try the customer side ↓
                </a>
              </div>
              <p className="lp-data mt-5 text-xs text-(--mist)">£49 a month after the trial · no contract</p>

              {/* Proof, up front: a real business taking real bookings. */}
              <a
                href="#case-study"
                className="mt-10 flex max-w-md items-center gap-4 border-t border-(--rule-dark) pt-5 text-sm hover:text-(--paper)"
              >
                <span aria-hidden className="size-2 shrink-0 animate-pulse rounded-full bg-[#3ddc84] motion-reduce:animate-none" />
                <span className="text-(--mist)">
                  Live at <span className="text-(--paper)">{CASE_STUDY.name}</span>, {CASE_STUDY.place}: their customers
                  book and pay deposits through {PRODUCT_NAME} today.
                </span>
              </a>
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
              <span className="hidden sm:inline">{CASE_STUDY.name}</span>
            </div>
            <Image
              src={ascndOverview}
              alt={`${CASE_STUDY.name}'s overview in the ${PRODUCT_NAME} dashboard: this week's income, jobs, booked value, new bookings, leads and new customers, each against the week before, above income and jobs charts`}
              sizes="(min-width: 1152px) 72rem, 100vw"
              placeholder="blur"
              className="h-auto w-full"
            />
          </div>
          <figcaption className="lp-data mx-auto max-w-6xl pt-3 text-xs text-(--graphite)">
            {CASE_STUDY.name}&apos;s week, as the owner sees it.
          </figcaption>
        </figure>

        {/* ------------------------------------------------- problems, solved */}
        <section id="problems" aria-labelledby="problems-heading" className="scroll-mt-4 bg-(--paper) px-4 pt-16 pb-20 text-(--ink) sm:px-6 sm:pt-24 sm:pb-28">
          <div className="mx-auto max-w-7xl">
            <div className="grid gap-6 lg:grid-cols-12">
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
                This is what your customers see. Have a go: it works the way the real thing does, with example
                prices.
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

        {/* ------------------------------------------------- what it handles */}
        <section aria-labelledby="handles" className="bg-(--paper) px-4 py-24 text-(--ink) sm:px-6 sm:py-28">
          <div className="mx-auto max-w-7xl">
            <h2 id="handles" className="lp-display max-w-3xl text-[clamp(2.25rem,5vw,4.25rem)]">
              What it takes off your plate
            </h2>
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

        {/* ------------------------------------------------------ your side */}
        <section aria-labelledby="your-side" className="py-20 sm:py-24">
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

          {/* The day, full width. Scrolls sideways on a phone. */}
          <div className="mt-14 overflow-x-auto border-y border-(--rule-dark) [scrollbar-width:thin]">
            <ol className="flex w-max snap-x snap-mandatory items-stretch px-4 sm:px-6 lg:w-full lg:min-w-max lg:justify-center">
              {ROUTE.map((stop, i) =>
                stop.kind === "drive" ? (
                  <li key={i} className="flex w-36 shrink-0 flex-col justify-center px-3 py-8 lg:w-32">
                    <span aria-hidden className="block h-px w-full bg-[repeating-linear-gradient(90deg,var(--hi)_0_6px,transparent_6px_12px)]" />
                    <span className="lp-data mt-3 text-[11px] leading-snug text-(--mist)">{stop.text}</span>
                  </li>
                ) : (
                  <li
                    key={i}
                    className={`flex shrink-0 snap-start flex-col justify-center border-x border-(--rule-dark) px-5 py-8 ${stop.kind === "home" ? "w-36 bg-[#181b18]" : "w-52 lg:w-48"}`}
                  >
                    <span className="lp-data text-xl whitespace-nowrap text-(--paper) xl:text-2xl">{stop.time}</span>
                    <span className="mt-2 font-semibold">{stop.title}</span>
                    <span className="text-sm text-(--mist)">{stop.place}</span>
                  </li>
                ),
              )}
            </ol>
          </div>
          <p className="lp-data mx-auto mt-6 max-w-7xl px-4 text-xs text-(--mist) sm:px-6">
            An example day for one van · aims to get you there 10 minutes early · turns red if a job can&apos;t be
            reached in time · one tap to navigate
          </p>
        </section>

        {/* ---------------------------------------------------- case study */}
        <section id="case-study" aria-labelledby="case-heading" className="scroll-mt-4 bg-(--paper) px-4 py-24 text-(--ink) sm:px-6 sm:py-32">
          <div className="mx-auto grid max-w-7xl gap-14 lg:grid-cols-12 lg:gap-10">
            {/* The real booking page, as customers see it on their phone. */}
            <div className="relative mx-auto flex w-full max-w-md justify-center lg:col-span-5 lg:mx-0">
              <Image
                src={ascndHome}
                alt={`${CASE_STUDY.name}'s booking page on a phone: its services and prices, with a button for an instant quote`}
                sizes="(min-width: 1024px) 15rem, 45vw"
                className="lp-printed relative z-10 h-auto w-[56%] border-2 border-(--ink)"
              />
              <Image
                src={ascndQuote}
                alt={`The first step of booking with ${CASE_STUDY.name}: choosing a service`}
                sizes="(min-width: 1024px) 15rem, 45vw"
                className="mt-16 -ml-[12%] h-auto w-[56%] border-2 border-(--ink)"
              />
            </div>

            <div className="lg:col-span-6 lg:col-start-7">
              <p className={`${kicker} text-(--graphite)`}>Customer · since {CASE_STUDY.since}</p>
              <h2 id="case-heading" className="lp-display mt-4 text-[clamp(2.25rem,4.5vw,3.75rem)] leading-[0.95]">
                {CASE_STUDY.name}, {CASE_STUDY.place}
              </h2>
              <p className="mt-6 text-lg leading-relaxed">
                {CASE_STUDY.name} is a mobile detailer and the first business on {PRODUCT_NAME}. Its customers get
                their price, pick a time and pay a deposit on its own booking page. The screens here are that page, as
                it is today.
              </p>

              {CASE_STUDY.quote && (
                <figure className="mt-10 border-l-4 border-(--hi) pl-6">
                  <blockquote className="text-2xl leading-snug font-medium">“{CASE_STUDY.quote.text}”</blockquote>
                  <figcaption className="lp-data mt-3 text-sm text-(--graphite)">
                    {CASE_STUDY.quote.who}, {CASE_STUDY.name}
                  </figcaption>
                </figure>
              )}

              {CASE_STUDY.metrics.length > 0 && (
                <table className="mt-10 w-full border-t-2 border-(--ink) text-left">
                  <caption className="sr-only">
                    {CASE_STUDY.name}, before and with {PRODUCT_NAME}
                  </caption>
                  <thead>
                    <tr className={`${kicker} text-(--graphite)`}>
                      <th scope="col" className="py-3 font-normal">
                        <span className="sr-only">Measure</span>
                      </th>
                      <th scope="col" className="py-3 font-normal">
                        Before
                      </th>
                      <th scope="col" className="py-3 font-normal text-(--ink)">
                        With {PRODUCT_NAME}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {CASE_STUDY.metrics.map((m) => (
                      <tr key={m.label} className="border-t border-(--rule)">
                        <th scope="row" className="py-4 pr-4 font-medium">
                          {m.label}
                        </th>
                        <td className="lp-data py-4 pr-4 text-2xl text-(--graphite) line-through decoration-1">{m.before}</td>
                        <td className="lp-display py-4 text-4xl">{m.after}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              <dl className="mt-10 grid gap-x-8 gap-y-5 border-t-2 border-(--ink) pt-6 sm:grid-cols-2">
                <div>
                  <dt className={`${kicker} text-(--graphite)`}>Booking page</dt>
                  <dd className="mt-1">
                    <a href={CASE_STUDY.url} target="_blank" rel="noreferrer" className="underline decoration-(--hi) decoration-2 underline-offset-4">
                      {caseHost} ↗
                    </a>
                  </dd>
                </div>
                <div>
                  <dt className={`${kicker} text-(--graphite)`}>Deposits</dt>
                  <dd className="mt-1">Taken on booking, into its own Stripe account</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className={`${kicker} text-(--graphite)`}>On its page</dt>
                  <dd className="mt-1">{CASE_STUDY.services.join(" · ")}</dd>
                </div>
              </dl>
            </div>
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
                <span className="lp-display text-[clamp(6rem,15vw,10rem)] leading-[0.8]">£49</span>
                <span className="lp-data pt-2 text-base text-(--mist)">
                  a<br />
                  month
                </span>
              </p>
              <Link href={signup} className="mt-10 inline-block bg-(--hi) px-6 py-3.5 font-semibold text-(--ink) hover:bg-[#ff7140]">
                Start your 14-day free trial
              </Link>
            </div>

            <div className="lg:pt-6">
              <ul className="border-t border-(--rule-dark)">
                {[
                  "14 days free, then £49 a month.",
                  "Your card is taken when you sign up. Nothing is charged until the trial ends.",
                  "No contract. Stop whenever you like.",
                  "No booking fees and no cut of your deposits. Stripe charges its standard card fee.",
                  "Everything on this page, with no limit on bookings, customers or vans.",
                ].map((line) => (
                  <li key={line} className="flex gap-4 border-b border-(--rule-dark) py-4 text-lg">
                    <span aria-hidden className="mt-2.5 size-2 shrink-0 bg-(--hi)" />
                    {line}
                  </li>
                ))}
              </ul>

              <div className="mt-12 border-l-4 border-(--hi) pl-6">
                <h3 className="lp-display text-2xl sm:text-3xl">Want a website built around it?</h3>
                <p className="mt-3 max-w-xl text-(--mist)">
                  We design and build websites for detailing businesses that plug straight into your bookings, so
                  quotes, prices and availability are always live. A one-off fee, quoted for your project.
                </p>
                <a
                  href={`mailto:${SALES_EMAIL}?subject=${encodeURIComponent("A website for my detailing business")}`}
                  className="lp-data mt-4 inline-block text-sm underline decoration-(--hi) decoration-2 underline-offset-8"
                >
                  Ask about a website →
                </a>
              </div>
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
          </div>
        </section>

        {/* -------------------------------------------------------------- CTA */}
        <section className="bg-(--hi) px-4 py-14 text-(--ink) sm:px-6 sm:py-16">
          <div className="mx-auto flex max-w-7xl flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <p className="lp-display text-[clamp(2.5rem,6vw,5rem)] leading-[0.9]">
              Get your booking
              <br />
              link today.
            </p>
            <div className="shrink-0">
              <Link href={signup} className="inline-block bg-(--ink) px-6 py-3.5 font-semibold text-(--paper) hover:bg-black">
                Start free trial
              </Link>
              <p className="lp-data mt-3 text-xs">14 days free · £49 a month after</p>
            </div>
          </div>
        </section>
      </main>

      {/* ------------------------------------------------------------ footer */}
      <footer className="px-4 pt-14 pb-10 sm:px-6">
        <div className="mx-auto grid max-w-7xl gap-10 sm:grid-cols-[1fr_auto_auto_auto] sm:gap-16">
          <p className="lp-display flex items-center gap-2 text-2xl">
            <span aria-hidden className="size-2.5 bg-(--hi)" />
            {PRODUCT_NAME}
          </p>
          <FooterLinks
            title="Product"
            links={[
              ["How it helps", "#problems"],
              ["Customers", "#case-study"],
              ["Pricing", "#pricing"],
              ...(docs ? ([["Docs", docs]] as [string, string][]) : []),
            ]}
          />
          <FooterLinks
            title="Account"
            links={[
              ["Sign in", appUrl("/login")],
              ["Start free trial", signup],
            ]}
          />
          <FooterLinks
            title="Legal"
            links={[
              ["Privacy", marketingUrl("/legal/privacy")],
              ["Terms", marketingUrl("/legal/terms")],
              ["Data processing", marketingUrl("/legal/dpa")],
            ]}
          />
        </div>
        <p className="lp-data mx-auto mt-14 max-w-7xl border-t border-(--rule-dark) pt-6 text-xs text-(--mist)">
          © {PLATFORM.name}
          {PLATFORM.companyNumber && ` · Company no. ${PLATFORM.companyNumber}`}
          {PLATFORM.address && ` · ${PLATFORM.address}`}
        </p>
      </footer>
    </div>
  );
}

function FooterLinks({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div>
      <p className="lp-data text-[11px] tracking-[0.18em] text-(--mist) uppercase">{title}</p>
      <ul className="mt-3 grid gap-2 text-sm">
        {links.map(([label, href]) => (
          <li key={label}>
            <a href={href} className="hover:text-(--hi)">
              {label}
            </a>
          </li>
        ))}
      </ul>
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
        <p className="lp-data text-sm text-(--graphite)">08:30–11:00 · GL52 · Charlton Kings</p>
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
