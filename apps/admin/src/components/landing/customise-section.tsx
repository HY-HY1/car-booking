import { CalendarClock, ClipboardCheck, MapPin, PoundSterling, Tag, Wallet, type LucideIcon } from "lucide-react";
import { Section } from "./site-ui";

// The home page's "make it work your way" section: the rules a business sets
// in its dashboard, not its look (logo and colours are in "how it works").
// Each line is something a business can really change today: keep it in step
// with Settings, Pricing and Coverage.

type Item = { icon: LucideIcon; title: string; text: string };

const ITEMS: Item[] = [
  {
    icon: PoundSterling,
    title: "Your services and prices",
    text: "Every service, extra and price is yours to set, with prices that change with the car's size and condition.",
  },
  {
    icon: Wallet,
    title: "Your deposits and payments",
    text: "Choose the deposit, send payment links for the balance, record cash and decide what's refunded when customers cancel.",
  },
  {
    icon: CalendarClock,
    title: "Your hours and vans",
    text: "Opening hours for the business, and for each van or bay, so only the times you can do are offered.",
  },
  {
    icon: MapPin,
    title: "Where you work",
    text: "Mark the areas you cover on a map, each as far out as you'll travel. Customers outside them are told before they book, not after.",
  },
  {
    icon: ClipboardCheck,
    title: "Your booking rules",
    text: "Approve bookings first, ask for photos and questions, set cancellation terms and take more than one car per visit.",
  },
  {
    icon: Tag,
    title: "Your offers",
    text: "Promo codes for regulars, quiet days or a launch, applied to the price before the customer pays.",
  },
];

export function CustomiseSection() {
  return (
    <Section
      id="customise"
      eyebrow="Make it yours"
      title="Fully customisable to your business"
      intro="Every business runs differently. Set the rules once and your booking page follows them."
      center
    >
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ITEMS.map(({ icon: Icon, title, text }) => (
          <li key={title} className="flex gap-4 rounded-xl border border-(--line) bg-(--soft) p-6 transition-colors hover:border-(--accent)/30">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-(--line) bg-(--bg)">
              <Icon aria-hidden className="size-5 text-(--accent)" />
            </span>
            <div>
              <h3 className="font-semibold tracking-tight">{title}</h3>
              <p className="mt-1.5 text-sm text-pretty text-(--muted)">{text}</p>
            </div>
          </li>
        ))}
      </ul>
    </Section>
  );
}
