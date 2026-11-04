import type { Metadata } from "next";
import Link from "next/link";
import { NoShowCalculator } from "@/components/landing/no-show-calculator";
import { TestimonialCard } from "@/components/landing/proof";
import { CtaBand, PageIntro, TrialButton, kicker } from "@/components/landing/ui";
import { PRICE, PRODUCT_NAME } from "@/lib/brand";
import { TESTIMONIALS } from "@/lib/proof";
import { docsUrl } from "@/lib/urls";

export const metadata: Metadata = {
  title: "Pricing",
  description: `One plan with everything in it: ${PRICE.monthly} a month after a ${PRICE.trialDays}-day free trial. No contract, no booking fees and no cut of your deposits.`,
};

const INCLUDED = [
  {
    group: "Your booking page",
    items: [
      "Instant quotes by car size, with extras",
      "Photo condition check",
      "Your logo, colours and own web address",
      "A quote button for your website",
    ],
  },
  {
    group: "Getting paid",
    items: ["Deposits by card, to your own Stripe", "Refunds by your cancellation policy", "Payment links with receipts", "Income and payments at a glance"],
  },
  {
    group: "Running the day",
    items: ["Diary by van or bay", "Travel time between jobs", "Route planner with live traffic", "Approve bookings first, if you like"],
  },
  {
    group: "Customers and team",
    items: ["Confirmations and reminders from your email", "Review requests and enquiry follow-ups", "Staff logins with their own access", "Privacy tools and full data export"],
  },
] as const;

const COSTS = [
  [PRODUCT_NAME, `${PRICE.monthly} a month`, `After ${PRICE.trialDays} days free. The same price however busy you get.`],
  ["Booking fees", "None", "Take one booking a month or three hundred."],
  ["Our cut of your deposits", "0%", "Deposits are paid into your own Stripe account. We never hold your money."],
  ["Card fees", "Stripe's rate", "Stripe takes its standard fee from each card payment, as it would anywhere. Nothing is added on top."],
  ["Limits", "None", "No caps on bookings, customers, vans or bays."],
] as const;

const BILLING_QUESTIONS = [
  [
    "When am I charged?",
    `You add a card when you sign up. Nothing is charged for the first ${PRICE.trialDays} days, then it's ${PRICE.monthly} a month from the day the trial ends.`,
  ],
  ["Is there a contract?", "No. It's month to month. Stop whenever you like and you won't be charged again."],
  [
    "Do I need Stripe?",
    "Only to take card deposits and payment links. Setting it up takes a few minutes from your dashboard, and the money goes straight to your bank from there. If you don't take deposits, you don't need it.",
  ],
  [
    "What happens to my data if I leave?",
    "It's yours. Download everything, from customers to bookings, whenever you like, including before you go.",
  ],
  ["Can I bring my own web address?", "Yes, at no extra cost. Add two records where your domain is managed and your booking page runs on it."],
  [
    "Do you build websites?",
    "Yes, for detailing businesses, built to plug straight into your bookings so prices and availability are always live. It's a one-off fee, quoted for your project: ask through the contact page.",
  ],
] as const;

export default function PricingPage() {
  const docs = docsUrl();
  const quote = TESTIMONIALS.find((t) => /deposit/i.test(t.quote)) ?? TESTIMONIALS[0];

  return (
    <>
      <PageIntro
        eyebrow="Pricing"
        title={
          <>
            One plan<span className="text-(--hi)">.</span> Everything in it<span className="text-(--hi)">.</span>
          </>
        }
      >
        <p>
          Every feature, for every business, at one monthly price. No booking fees, no cut of your deposits and no
          contract.
        </p>
      </PageIntro>

      {/* ----------------------------------------------------------- the plan */}
      <section aria-labelledby="plan-heading" className="px-4 pb-24 sm:px-6">
        <div className="mx-auto grid max-w-7xl border-2 border-(--paper) lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          <div className="flex flex-col justify-between gap-10 bg-(--paper) p-8 text-(--ink) sm:p-10">
            <div>
              <h2 id="plan-heading" className={`${kicker} text-(--graphite)`}>
                {PRODUCT_NAME}
              </h2>
              <p className="mt-4 flex items-start gap-3">
                <span className="lp-display text-[clamp(6rem,14vw,9rem)] leading-[0.8]">{PRICE.monthly}</span>
                <span className="lp-data pt-2 text-base text-(--graphite)">
                  a<br />
                  month
                </span>
              </p>
              <p className="mt-6 text-lg">
                {PRICE.trialDays} days free to start. Set it up, take real bookings, and decide when you&apos;ve seen it
                work.
              </p>
            </div>
            <div>
              <TrialButton className="w-full text-center" />
              <p className="lp-data mt-3 text-center text-xs text-(--graphite)">No contract · cancel any time</p>
            </div>
          </div>

          <div className="grid gap-px bg-(--rule-dark) sm:grid-cols-2">
            {INCLUDED.map(({ group, items }) => (
              <div key={group} className="bg-(--ink) p-6 sm:p-8">
                <h3 className={`${kicker} text-(--hi)`}>{group}</h3>
                <ul className="mt-4 grid gap-2.5">
                  {items.map((item) => (
                    <li key={item} className="flex gap-3">
                      <span aria-hidden className="lp-data text-(--hi)">
                        ✓
                      </span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
        <p className="mx-auto mt-5 max-w-7xl text-sm text-(--mist)">
          The full list, with how each part works, is on the{" "}
          <Link href="/features" className="text-(--paper) underline decoration-(--hi) decoration-2 underline-offset-4">
            features page
          </Link>
          .
        </p>
      </section>

      {/* --------------------------------------------- what you pay and don't */}
      <section aria-labelledby="costs-heading" className="bg-(--paper) px-4 py-20 text-(--ink) sm:px-6 sm:py-28">
        <div className="mx-auto max-w-7xl">
          <h2 id="costs-heading" className="lp-display max-w-3xl text-[clamp(2.25rem,4.5vw,3.75rem)] leading-[0.95]">
            What you pay, and what you don&apos;t
          </h2>
          <table className="mt-12 w-full border-t-2 border-(--ink) text-left">
            <caption className="sr-only">Costs of using {PRODUCT_NAME}</caption>
            <tbody>
              {COSTS.map(([what, amount, note]) => (
                <tr key={what} className="grid gap-1 border-b border-(--rule) py-5 md:table-row">
                  <th scope="row" className="text-lg font-semibold md:w-1/4 md:py-6 md:pr-6">
                    {what}
                  </th>
                  <td className="lp-display text-4xl md:w-1/5 md:py-6 md:pr-6">{amount}</td>
                  <td className="text-(--graphite) md:py-6">{note}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-5 text-sm text-(--graphite)">
            Stripe&apos;s fees are set by Stripe and depend on the card. See{" "}
            <a href="https://stripe.com/gb/pricing" target="_blank" rel="noreferrer" className="text-(--ink) underline decoration-(--hi) decoration-2 underline-offset-4">
              Stripe&apos;s pricing ↗
            </a>
            .
          </p>
        </div>
      </section>

      {/* ------------------------------------------------ what no-shows cost */}
      <section aria-labelledby="calc-heading" className="px-4 py-20 sm:px-6 sm:py-28">
        <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-20">
          <div>
            <h2 id="calc-heading" className="lp-display text-[clamp(2.25rem,4.5vw,3.75rem)] leading-[0.95]">
              What no-shows cost you
            </h2>
            <p className="mt-5 max-w-md text-lg leading-relaxed text-(--mist)">
              Put in your own numbers. An empty slot is the price of the job, plus the drive there, plus the job you
              turned away to fit it in.
            </p>
            {quote && (
              <div className="mt-10 max-w-md text-(--ink)">
                <TestimonialCard t={quote} />
              </div>
            )}
          </div>
          <NoShowCalculator yearlyPounds={PRICE.yearlyPounds} />
        </div>
      </section>

      {/* ------------------------------------------------- billing questions */}
      <section aria-labelledby="billing-heading" className="bg-(--paper) px-4 py-20 text-(--ink) sm:px-6 sm:py-24">
        <div className="mx-auto max-w-7xl">
          <h2 id="billing-heading" className={`${kicker} text-(--graphite)`}>
            Billing questions
          </h2>
          <dl className="mt-6">
            {BILLING_QUESTIONS.map(([q, a]) => (
              <div key={q} className="grid gap-3 border-t border-(--rule) py-7 md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] md:gap-12">
                <dt className="lp-display text-2xl sm:text-3xl">{q}</dt>
                <dd className="text-lg leading-relaxed text-(--graphite) md:pt-1">{a}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 border-t border-(--rule) pt-6 text-(--graphite)">
            Something else?{" "}
            <Link href="/contact" className="text-(--ink) underline decoration-(--hi) decoration-2 underline-offset-4">
              Send us a message
            </Link>
            {docs && (
              <>
                {" "}
                or read{" "}
                <a href={docs} className="text-(--ink) underline decoration-(--hi) decoration-2 underline-offset-4">
                  the docs
                </a>
              </>
            )}
            .
          </p>
        </div>
      </section>

      <CtaBand title={`Try it free for ${PRICE.trialDays} days.`} />
    </>
  );
}
