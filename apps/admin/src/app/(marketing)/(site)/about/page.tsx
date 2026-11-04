import type { Metadata } from "next";
import Link from "next/link";
import { PLATFORM, SUBPROCESSORS } from "@leadgen/core/privacy/platform";
import { ProofStats } from "@/components/landing/proof";
import { CtaBand, PageIntro, kicker } from "@/components/landing/ui";
import { PRODUCT_NAME } from "@/lib/brand";
import { marketingUrl } from "@/lib/urls";

export const metadata: Metadata = {
  title: "About",
  description: `${PRODUCT_NAME} was built inside a working mobile detailing business, for the people who run one. Who we are, what we believe and how we look after your data.`,
};

const BELIEFS = [
  ["Your money goes straight to you", "Deposits and payments land in your own Stripe account. We never hold them and never take a percentage."],
  ["Your customers are yours", "Your list, your bookings, your data. Download all of it whenever you like, and take it with you if you leave."],
  ["One honest price", "One plan with everything in it. No booking fees, no add-ons, no tiers that hold back the useful bits."],
  ["Built for the van, not the office", "Your customers book on their phones, and you run the day from yours: it has to work standing on a driveway."],
] as const;

export default function AboutPage() {
  return (
    <>
      <PageIntro
        eyebrow="About"
        title={
          <>
            Built on a driveway, not in an office<span className="text-(--hi)">.</span>
          </>
        }
      >
        <p>
          {PRODUCT_NAME} started as the booking system for a working mobile detailing business, written by the person
          running it, between jobs.
        </p>
      </PageIntro>

      {/* ------------------------------------------------------------ story */}
      <section aria-labelledby="story-heading" className="bg-(--paper) px-4 py-20 text-(--ink) sm:px-6 sm:py-28">
        <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-12">
          <h2 id="story-heading" className="lp-display text-[clamp(2.25rem,4.5vw,3.75rem)] leading-[0.95] lg:col-span-5">
            Why it exists
          </h2>
          <div className="grid gap-6 text-lg leading-relaxed lg:col-span-6 lg:col-start-7">
            <p>
              Running a mobile detailing business means doing two jobs. One is the work on the car. The other is
              everything around it: answering &ldquo;how much?&rdquo; at ten at night, juggling a diary across town,
              chasing a balance, and standing on a driveway when the customer forgot you were coming.
            </p>
            <p>
              Most booking software is built for salons and gyms, where the customer comes to you. It doesn&apos;t know
              that a car&apos;s size changes the price, that a van has to drive between jobs, or that a deposit is what
              stops a no-show.
            </p>
            <p>
              So we built one that does, and ran our own business on it first. Every feature in {PRODUCT_NAME} is there
              because a real day on the road needed it, and it&apos;s still built and tested that way.
            </p>
            <p className="border-l-4 border-(--hi) pl-5 font-semibold">
              It&apos;s software for people who&apos;d rather be detailing than doing admin. That&apos;s the test every
              change has to pass.
            </p>
          </div>
        </div>
        <div className="mx-auto mt-20 max-w-7xl">
          <ProofStats />
        </div>
      </section>

      {/* -------------------------------------------------------- beliefs */}
      <section aria-labelledby="beliefs-heading" className="px-4 py-20 sm:px-6 sm:py-28">
        <div className="mx-auto max-w-7xl">
          <h2 id="beliefs-heading" className="lp-display max-w-3xl text-[clamp(2.25rem,4.5vw,3.75rem)] leading-[0.95]">
            What we won&apos;t compromise on
          </h2>
          <ol className="mt-12 grid border-t-2 border-(--paper) md:grid-cols-2 md:gap-x-16">
            {BELIEFS.map(([title, text], i) => (
              <li key={title} className="grid grid-cols-[3.5rem_1fr] items-start gap-4 border-b border-(--rule-dark) py-7 sm:grid-cols-[4.5rem_1fr]">
                <span aria-hidden className="lp-display text-4xl text-(--hi) sm:text-5xl">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span>
                  <span className="block text-xl font-semibold">{title}</span>
                  <span className="mt-1 block text-(--mist)">{text}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ------------------------------------------------------- your data */}
      <section aria-labelledby="data-heading" className="bg-(--paper) px-4 py-20 text-(--ink) sm:px-6 sm:py-28">
        <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <h2 id="data-heading" className="lp-display text-[clamp(2.25rem,4.5vw,3.75rem)] leading-[0.95]">
              How we look after your data
            </h2>
            <div className="mt-6 grid gap-4 text-lg leading-relaxed text-(--graphite)">
              <p>
                Your customers&apos; details belong to your business. Under UK data protection law you&apos;re in charge
                of them and we handle them on your behalf, under a written agreement.
              </p>
              <p>
                Card details are typed into Stripe&apos;s secure form and never reach our servers. Customers can ask
                for their data or ask to be forgotten, and the tools to do it are built in.
              </p>
            </div>
            <p className="mt-6 flex flex-wrap gap-x-6 gap-y-2">
              <Link href={marketingUrl("/legal/privacy")} className="underline decoration-(--hi) decoration-2 underline-offset-4">
                Privacy policy
              </Link>
              <Link href={marketingUrl("/legal/dpa")} className="underline decoration-(--hi) decoration-2 underline-offset-4">
                Data processing terms
              </Link>
            </p>
          </div>

          <div className="lg:col-span-6 lg:col-start-7">
            <h3 className={`${kicker} text-(--graphite)`}>Who else handles data, and why</h3>
            <dl className="mt-4 border-t-2 border-(--ink)">
              {SUBPROCESSORS.map((s) => (
                <div key={s.name} className="grid gap-1 border-b border-(--rule) py-4 sm:grid-cols-[10rem_1fr] sm:gap-6">
                  <dt className="font-semibold">{s.name}</dt>
                  <dd className="text-(--graphite)">{s.does}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      {/* --------------------------------------------------------- contact */}
      <section aria-labelledby="contact-heading" className="px-4 py-20 sm:px-6 sm:py-24">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-12">
          <h2 id="contact-heading" className="lp-display text-[clamp(2.25rem,4.5vw,3.75rem)] leading-[0.95] lg:col-span-5">
            Talk to a person
          </h2>
          <div className="lg:col-span-6 lg:col-start-7">
            <p className="text-lg leading-relaxed text-(--mist)">
              Questions before you sign up, a live demo, help setting up, or a website built around your bookings: send a
              message and you&apos;ll hear back from someone who knows the trade.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-x-8 gap-y-4">
              <Link href="/contact" className="inline-block bg-(--hi) px-6 py-3.5 font-semibold text-(--ink) hover:bg-[#ff7140]">
                Send a message
              </Link>
              <Link href="/contact?topic=demo" className="lp-data text-sm underline decoration-(--hi) decoration-2 underline-offset-8">
                Book a live demo →
              </Link>
            </div>
            <dl className="lp-data mt-10 grid gap-3 border-t border-(--rule-dark) pt-6 text-sm text-(--mist)">
              <div className="flex gap-3">
                <dt>Company</dt>
                <dd className="text-(--paper)">{PLATFORM.name}</dd>
              </div>
              {PLATFORM.companyNumber && (
                <div className="flex gap-3">
                  <dt>Company no.</dt>
                  <dd className="text-(--paper)">{PLATFORM.companyNumber}</dd>
                </div>
              )}
              {PLATFORM.icoRegistration && (
                <div className="flex gap-3">
                  <dt>ICO registration</dt>
                  <dd className="text-(--paper)">{PLATFORM.icoRegistration}</dd>
                </div>
              )}
              {PLATFORM.address && (
                <div className="flex gap-3">
                  <dt>Address</dt>
                  <dd className="text-(--paper)">{PLATFORM.address}</dd>
                </div>
              )}
            </dl>
          </div>
        </div>
      </section>

      <CtaBand title="Spend less time on admin." />
    </>
  );
}
