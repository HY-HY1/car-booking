import { CalendarDays, Camera, CreditCard, Inbox, Mail, Route, Users, type LucideIcon } from "lucide-react";
import { Section, Slot } from "./site-ui";

// The home page's feature highlights: the main tools only, as a bento grid.
// The full list lives on /features. What the "how it works" sections already
// cover (domain, branding, qualification steps) isn't repeated here. Each
// Slot marks where an image goes.

type Feature = {
  icon: LucideIcon;
  title: string;
  text: string;
  image: string;
  // Two columns wide, for the headline features.
  wide?: boolean;
};

const FEATURES: Feature[] = [
  {
    icon: Camera,
    title: "Instant, accurate quotes",
    text: "Prices set by the car's size, the extras and its condition. Customers add photos, and a car that needs more work is priced for it before you arrive.",
    image: "Image: a quote updating as the car and extras are chosen",
    wide: true,
  },
  {
    icon: CreditCard,
    title: "Deposits and payment links",
    text: "Deposits on booking and balances by link, paid straight into your Stripe account. We never take a cut.",
    image: "Image: a deposit paid on a booking",
  },
  {
    icon: Mail,
    title: "Emails that send themselves",
    text: "Confirmations, reminders and review requests, sent from your own email address.",
    image: "Image: a booking confirmation email",
  },
  {
    icon: Route,
    title: "Route-aware scheduling",
    text: "Times are only offered when there's room to drive from your last job. Each morning's run sheet gives leave-by times from live traffic, with one tap to Waze or Google Maps.",
    image: "Image: a day's run sheet with leave-by times",
    wide: true,
  },
  {
    icon: Inbox,
    title: "Every lead in one place",
    text: "Enquiries from your booking page and Facebook and Instagram lead forms, tracked until they book.",
    image: "Image: the leads list",
  },
  {
    icon: CalendarDays,
    title: "A diary that keeps up",
    text: "Drag jobs to move them. Two-way sync with Google Calendar keeps your own plans out of the booking times.",
    image: "Image: the diary with jobs across the week",
  },
  {
    icon: Users,
    title: "Built for a team",
    text: "Each van with its own hours, and each person with their own login and access.",
    image: "Image: vans and staff in the dashboard",
  },
];

export function FeaturesSection() {
  return (
    <Section
      id="features"
      eyebrow="Features"
      title="Everything between the enquiry and the payment"
      intro="The tools that do the admin, so you can get on with the car in front of you."
      link={["See every feature", "/features"]}
      center
    >
      <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map(({ icon: Icon, title, text, image, wide }) => (
          <li
            key={title}
            className={`flex flex-col rounded-xl border border-(--line) bg-(--soft) p-6 transition-colors hover:border-(--accent)/30 md:last:col-span-2 lg:last:col-span-1 ${wide ? "md:col-span-2" : ""}`}
          >
            <span className="flex size-10 items-center justify-center rounded-lg border border-(--line) bg-(--bg)">
              <Icon aria-hidden className="size-5 text-(--accent)" />
            </span>
            <h3 className="mt-5 text-lg font-semibold tracking-tight">{title}</h3>
            <p className="mt-2 mb-6 text-sm text-pretty text-(--muted)">{text}</p>
            <Slot className="mt-auto h-44 bg-(--bg)">{image}</Slot>
          </li>
        ))}
      </ul>
    </Section>
  );
}
