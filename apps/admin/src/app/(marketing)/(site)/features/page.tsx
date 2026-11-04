import type { Metadata } from "next";
import Image, { type StaticImageData } from "next/image";
import bookingHome from "@/components/landing/booking-home.webp";
import bookings from "@/components/landing/bookings.webp";
import overview from "@/components/landing/overview.webp";
import { TestimonialCard } from "@/components/landing/proof";
import { RouteDay } from "@/components/landing/route-day";
import { CtaBand, PageIntro, TrialButton, kicker } from "@/components/landing/ui";
import { PRODUCT_NAME } from "@/lib/brand";
import { TESTIMONIALS } from "@/lib/proof";
import { docsUrl } from "@/lib/urls";

export const metadata: Metadata = {
  title: "Features",
  description: `Everything in ${PRODUCT_NAME}: a booking page with instant quotes, deposits to your own Stripe, a diary and route planner, emails from your own address, staff logins and privacy tools.`,
};

type Feature = [title: string, text: string];

type Group = {
  id: string;
  name: string;
  title: string;
  intro: string;
  features: Feature[];
  shot?: { src: StaticImageData; alt: string; caption: string; phone?: boolean };
};

// Only what's built and working. Add to this as features ship.
const GROUPS: Group[] = [
  {
    id: "booking-page",
    name: "Booking page",
    title: "A booking page that quotes, books and takes the deposit",
    intro:
      "Customers price their own car, choose a time and pay, without a single message. It's yours from the day you sign up.",
    features: [
      ["Instant quotes", "Prices by car size, with extras on top, worked out the way you'd price it yourself."],
      ["Photo condition check", "Customers can add photos and the quote allows for a car that needs more work. If it can't tell, it flags the job for you to check."],
      ["Real availability", "Only times inside your working hours, clear of your other jobs, with room to drive between them."],
      ["Your brand", "Your logo, colours and cover photo. Run it on your own web address, like book.yourbusiness.co.uk."],
      ["The questions you need", "Reg, colour, access, where to find the car, and anything else you switch on. Photos can be required."],
      ["Approve first, if you prefer", "Switch on approval and bookings wait for your OK. Decline one and the deposit goes straight back."],
      ["A button for your website", "One line of code adds an instant quote button to any website, or link straight to your page."],
      ["Enquiries kept", "Anyone who gets a quote and leaves their details is saved, even if they don't book, so you can follow up."],
    ],
    shot: {
      src: bookingHome,
      alt: "A booking page on a phone: services, prices and an instant quote button",
      caption: "A booking page on a customer's phone",
      phone: true,
    },
  },
  {
    id: "payments",
    name: "Payments",
    title: "Get paid up front, and for the rest without chasing",
    intro: "Card payments go straight into your own Stripe account. We never hold your money and never take a cut.",
    features: [
      ["Deposits on booking", "A fixed amount, a percentage, or the full price. The slot is theirs once it's paid."],
      ["Refunds by your rules", "Your cancellation policy decides what's refunded and when. Full or part refunds from the booking."],
      ["Payment links", "Email a customer the balance in one tap. When they pay, they get a thank-you and a receipt."],
      ["See what's come in", "Every payment matched to its booking, with income by day, week, month and year."],
      ["Disputes flagged", "If a customer disputes a payment with their bank, you hear about it straight away."],
    ],
    shot: {
      src: overview,
      alt: `The ${PRODUCT_NAME} overview: the week's income, jobs, booked value, new bookings, leads and new customers, with charts`,
      caption: "The overview: income, jobs and enquiries against the week before",
    },
  },
  {
    id: "your-day",
    name: "Your day",
    title: "A diary that knows you drive between jobs",
    intro: "Every booking lands in the diary, van by van, with the drive between jobs already allowed for.",
    features: [
      ["Day and week views", "Jobs by status, time off shaded, and a column per van or bay."],
      ["Vans and bays", "Each with its own hours. New bookings go to whichever one is free."],
      ["Travel time built in", "The gap between two jobs is never shorter than the drive between them."],
      ["Route planner", "Works back from each start time with Google's traffic forecast and tells you when to leave."],
      ["One tap to navigate", "Every drive opens in Waze or Google Maps, and the whole day opens as one route."],
      ["Block out time", "Holidays, the school run, a van in for its MOT. Blocked time is never offered to customers."],
    ],
  },
  {
    id: "customers",
    name: "Customers",
    title: "Every customer kept in the loop, from your own address",
    intro: "Emails go out from your business's own email address, and replies come back to you.",
    features: [
      ["Confirmations", "Sent the moment a booking is secured, with everything the customer needs to know."],
      ["Reminders", "Before every job, so customers are in and the car's where you need it."],
      ["Review requests", "After the job, to customers who've said yes to hearing from you, with an unsubscribe link."],
      ["Alerts for you", "New bookings, and enquiries that got a price but didn't book, so you can call them."],
      ["Everything they told you", "Each booking keeps the customer's answers, notes and photos, so nothing lives in a text thread."],
    ],
    shot: {
      src: bookings,
      alt: "The bookings list: upcoming jobs with the customer, service, car, postcode, price, payment and status",
      caption: "Upcoming bookings, with what's paid and what's still to pay",
    },
  },
  {
    id: "team",
    name: "Team & data",
    title: "Room for your team, and your data stays yours",
    intro: "Give everyone their own login, and stay on the right side of data protection law without thinking about it.",
    features: [
      ["Staff logins", "Owner, manager, office and technician access. Each sees what their job needs and nothing else."],
      ["Privacy tools", "Export or erase a customer's data on request, a log of what they agreed to, and automatic clear-out of old records."],
      ["Your data, any time", "Download everything about your business whenever you like."],
      ["For your website", "Keep your own website's prices in step with your booking page through a simple API."],
      ["Setup checklist", "Your dashboard shows what's left to do before you take your first booking."],
    ],
  },
];

export default function FeaturesPage() {
  const docs = docsUrl();

  return (
    <>
      <PageIntro
        eyebrow="Features"
        title={
          <>
            Everything between &ldquo;how much?&rdquo; and &ldquo;paid&rdquo;<span className="text-(--hi)">.</span>
          </>
        }
      >
        <p>
          {PRODUCT_NAME} is one system for the whole job: the quote, the booking, the deposit, the drive, the reminder
          and the balance. Every feature is included in the one plan.
        </p>
      </PageIntro>

      {/* Jump links, sticky under the header on wide screens. */}
      <nav aria-label="Feature groups" className="sticky top-0 z-10 border-y border-(--rule-dark) bg-(--ink)/95 backdrop-blur">
        <ul className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 sm:px-6 [scrollbar-width:none]">
          {GROUPS.map((g, i) => (
            <li key={g.id} className="shrink-0">
              <a href={`#${g.id}`} className="lp-data flex gap-2 px-3 py-4 text-xs tracking-[0.14em] text-(--mist) uppercase hover:text-(--paper)">
                <span className="text-(--hi)">{String(i + 1).padStart(2, "0")}</span>
                {g.name}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      {GROUPS.map((g, i) => (
        <FeatureGroup key={g.id} group={g} index={i} />
      ))}

      {TESTIMONIALS.length > 0 && (
        <section aria-label="What detailers say" className="bg-(--paper) px-4 py-20 text-(--ink) sm:px-6 sm:py-24">
          <ul className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-3">
            {TESTIMONIALS.map((t) => (
              <li key={t.name}>
                <TestimonialCard t={t} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="px-4 py-20 sm:px-6 sm:py-24">
        <div className="mx-auto flex max-w-7xl flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <h2 className="lp-display text-[clamp(2.25rem,4.5vw,3.75rem)] leading-[0.95]">See it with your own prices</h2>
            <p className="mt-5 text-lg leading-relaxed text-(--mist)">
              Set up your services and hours, then book yourself in from your phone. That&apos;s the quickest way to
              know if it&apos;s right for you.
              {docs && (
                <>
                  {" "}
                  Or read{" "}
                  <a href={docs} className="text-(--paper) underline decoration-(--hi) decoration-2 underline-offset-4">
                    how each part works
                  </a>{" "}
                  first.
                </>
              )}
            </p>
          </div>
          <TrialButton />
        </div>
      </section>

      <CtaBand />
    </>
  );
}

// Groups alternate ink and paper; screenshots sit beside the list on wide
// screens, the day's route runs full width under "Your day".
function FeatureGroup({ group: g, index }: { group: Group; index: number }) {
  const paper = index % 2 === 1;
  return (
    <section id={g.id} aria-labelledby={`${g.id}-heading`} className={`scroll-mt-14 py-20 sm:py-28 ${paper ? "bg-(--paper) text-(--ink)" : ""}`}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <p className={`${kicker} ${paper ? "text-(--graphite)" : "text-(--mist)"}`}>
          <span className="text-(--hi)">{String(index + 1).padStart(2, "0")}</span> · {g.name}
        </p>
        <h2 id={`${g.id}-heading`} className="lp-display mt-4 max-w-4xl text-[clamp(2.25rem,4.5vw,3.75rem)] leading-[0.95]">
          {g.title}
        </h2>
        <p className={`mt-5 max-w-2xl text-lg leading-relaxed ${paper ? "text-(--graphite)" : "text-(--mist)"}`}>{g.intro}</p>

        <div className={`mt-12 grid gap-12 ${g.shot ? (g.shot.phone ? "lg:grid-cols-[minmax(0,1fr)_18rem]" : "lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]") : ""}`}>
          <dl className={`grid content-start border-t-2 ${paper ? "border-(--ink)" : "border-(--paper)"} ${g.shot ? "" : "md:grid-cols-2 md:gap-x-16"} ${g.shot?.phone ? "md:grid-cols-2 md:gap-x-12" : ""}`}>
            {g.features.map(([title, text]) => (
              <div key={title} className={`border-b py-5 ${paper ? "border-(--rule)" : "border-(--rule-dark)"}`}>
                <dt className="flex gap-3 text-lg font-semibold">
                  <span aria-hidden className="mt-2.5 size-2 shrink-0 bg-(--hi)" />
                  {title}
                </dt>
                <dd className={`mt-1 pl-5 ${paper ? "text-(--graphite)" : "text-(--mist)"}`}>{text}</dd>
              </div>
            ))}
          </dl>

          {g.shot && (
            <figure className={g.shot.phone ? "mx-auto w-60 lg:w-full" : ""}>
              <div className={`border-2 ${paper ? "lp-printed border-(--ink)" : "lp-printed-hi border-(--paper)"} bg-[#0a0a0a]`}>
                <Image src={g.shot.src} alt={g.shot.alt} sizes={g.shot.phone ? "18rem" : "(min-width: 1024px) 42rem, 100vw"} className="h-auto w-full" />
              </div>
              <figcaption className={`lp-data mt-4 text-xs ${paper ? "text-(--graphite)" : "text-(--mist)"}`}>{g.shot.caption}</figcaption>
            </figure>
          )}
        </div>
      </div>

      {g.id === "your-day" && (
        <div className="mt-16">
          <RouteDay />
        </div>
      )}
    </section>
  );
}
