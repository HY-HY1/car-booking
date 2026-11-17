import { Globe, LayoutDashboard, Link2, Lock, Palette, type LucideIcon } from "lucide-react";
import Image from "next/image";
import bookingFlow from "./booking-flow.webp";
import dashboardBookings from "./dashboard-bookings.webp";
import { BrowserFrame, Ctas, Section, Slot } from "./site-ui";

// The home page's two "how it works" sections: what a customer goes through
// on the booking page, then how the business gets set up on it. Some images
// are still to come: each Slot marks where one goes.

// ASCND's live booking page, where the screenshot was taken.
const BOOKING_PAGE = "book.ascnddetailing.co.uk/quote";

const FLOW = [
  ["Arrives on your booking page", "From your website, Google profile, ads or socials, at any hour of the day."],
  ["Gets an accurate price", "The car's size, the extras and its condition set the price. No guessing over text."],
  ["Is qualified automatically", "Only customers inside your service area, with the details you need, can go on to book."],
  ["Picks a time that fits", "Only slots that fit your hours, your other jobs and the drive between them."],
  ["Pays a deposit to confirm", "By card, straight into your Stripe account. The job lands in your diary."],
] as const;

export function CustomerFlow() {
  return (
    <Section
      id="how"
      eyebrow="How it works · Your customers"
      title="Customer Lead Qualification Flow"
      intro="Every enquiry is priced, qualified and booked before it reaches you."
      center
    >
      <ol className="relative grid gap-4 lg:grid-cols-5">
        {/* The line that runs through the step numbers on wide screens. */}
        <span aria-hidden className="absolute inset-x-[10%] top-[2.375rem] hidden h-px bg-linear-to-r from-transparent via-(--accent)/40 to-transparent lg:block" />
        {FLOW.map(([title, text], i) => (
          <li key={title} className="relative rounded-xl border border-(--line) bg-(--bg) p-5">
            <span className="flex size-7 items-center justify-center rounded-full border border-(--accent)/50 bg-(--bg) text-sm font-semibold text-(--accent)">
              {i + 1}
            </span>
            <p className="mt-4 font-semibold">{title}</p>
            <p className="mt-1.5 text-sm text-(--muted)">{text}</p>
          </li>
        ))}
      </ol>
      {/* A real booking page, with test booking details, fading into the page. */}
      <BrowserFrame
        address={BOOKING_PAGE}
        secure
        className="mx-auto mt-12 max-w-4xl shadow-2xl shadow-black/60 mask-[linear-gradient(to_bottom,#000_75%,transparent)]"
      >
        <Image
          src={bookingFlow}
          alt="A booking page part-way through: service, car, extras, address, date and time ticked off, beside a running total with the deposit to pay"
          sizes="(min-width: 896px) 56rem, 100vw"
          placeholder="blur"
          className="h-auto w-full"
        />
      </BrowserFrame>
    </Section>
  );
}

// The card screenshots are cut off at the bottom, so they fade out there.
const SHOT_FADE = "mask-[linear-gradient(to_bottom,#000_80%,transparent)]";

// `image` describes a picture still to come; `shot` is the real one, once
// there is one, and replaces the placeholder. Cards with neither are text only.
type SetupItem = {
  icon: LucideIcon;
  title: string;
  text: string;
  callout?: React.ReactNode;
  image?: string;
  shot?: React.ReactNode;
};

const SETUP: SetupItem[] = [
  {
    icon: Globe,
    title: "Hosted on your domain",
    text: "Your booking page lives on your own web address. We run the hosting, security and updates, so there's nothing for you to look after.",
    callout: <AddressBar sub="book" name="yourbusiness" tld="com" />,
    image: "Image: the booking page on the business's own web address",
    shot: (
      <BrowserFrame address={BOOKING_PAGE.replace("/quote", "")} secure className={`mt-auto ${SHOT_FADE}`}>
        <div className="relative aspect-9/4">
          <Image
            src={bookingFlow}
            alt="A detailer's booking page, in their own brand, on their own web address"
            fill
            sizes="(min-width: 768px) 32rem, 100vw"
            placeholder="blur"
            className="object-cover object-top"
          />
        </div>
      </BrowserFrame>
    ),
  },
  {
    icon: LayoutDashboard,
    title: "Your admin dashboard",
    text: "Every booking, lead, customer and payment in one place, on desktop or phone. Plan the day, move jobs in the diary and give staff their own logins.",
    callout: <AddressBar sub="yourbusiness" name="ascnd" tld="com" />,
    shot: (
      <BrowserFrame address="yourbusiness.ascnd.com" secure className={`mt-auto ${SHOT_FADE}`}>
        <div className="relative aspect-9/4">
          {/* The real dashboard, filled with demo bookings (made-up customers). */}
          <Image
            src={dashboardBookings}
            alt="The dashboard's Bookings tab: a week of upcoming jobs, each with the customer, car, service, postcode, price, deposit paid and status"
            fill
            sizes="(min-width: 768px) 32rem, 100vw"
            placeholder="blur"
            className="object-cover object-left-top"
          />
        </div>
      </BrowserFrame>
    ),
  },
  {
    icon: Palette,
    title: "Fully customised to your brand",
    text: "Your logo, colours, photos, services and prices. Customers see your business from the first click to the confirmation email.",
  },
  {
    icon: Link2,
    title: "Seamless with your website",
    text: "Book now buttons on your site, Google profile and socials go straight to your booking page, styled to match, so it feels like one site.",
  },
];

// A web address, shown the way a browser's address bar shows it, with the
// business's own name picked out.
function AddressBar({ sub, name, tld }: { sub: string; name: string; tld: string }) {
  return (
    <p className="mb-6 inline-flex items-center gap-2.5 self-start rounded-lg border border-(--line) bg-(--bg) px-4 py-2.5 font-mono text-sm">
      <Lock aria-hidden className="size-3.5 text-(--accent)" />
      <span>
        <span className="text-(--muted)">{sub}.</span>
        <span className="text-(--accent)">{name}</span>
        <span className="text-(--muted)">.{tld}</span>
      </span>
    </p>
  );
}

export function Implementation() {
  return (
    <Section
      id="implementation"
      eyebrow="How it works · Your business"
      title="Software Implementation"
      intro="We set it up for you: your booking page, on your domain, in your brand, connected to the site you already have."
      center
    >
      <ul className="grid gap-4 md:grid-cols-2">
        {SETUP.map(({ icon: Icon, title, text, callout, image, shot }) => (
          <li key={title} className="flex flex-col rounded-xl border border-(--line) bg-(--soft) p-6 sm:p-8">
            <span className="flex size-10 items-center justify-center rounded-lg border border-(--line) bg-(--bg)">
              <Icon aria-hidden className="size-5 text-(--accent)" />
            </span>
            <h3 className="mt-5 text-xl font-semibold tracking-tight">{title}</h3>
            <p className="mt-2 mb-6 text-(--muted)">{text}</p>
            {callout}
            {/* Pinned to the card's foot, so images line up across a row. */}
            {shot ?? (image && <Slot className="mt-auto aspect-16/10 bg-(--bg)">{image}</Slot>)}
          </li>
        ))}
      </ul>
      <Ctas className="mt-12 justify-center" />
    </Section>
  );
}
