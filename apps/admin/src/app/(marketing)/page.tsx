import Link from "next/link";
import { CalendarCheck, CreditCard, Globe, Inbox, MapPin, Users } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { appUrl, docsUrl } from "@/lib/urls";

const features = [
  {
    icon: Globe,
    title: "Your own booking website",
    text: "A page for every service, with photos, what's included and your prices. Live on your own address.",
  },
  {
    icon: CalendarCheck,
    title: "Instant quotes and bookings",
    text: "Customers pick a service, see a price for their car and book a time, any hour of the day.",
  },
  {
    icon: CreditCard,
    title: "Deposits paid to you",
    text: "Take deposits by card straight into your own Stripe account. Fewer no-shows.",
  },
  {
    icon: MapPin,
    title: "Travel-aware diary",
    text: "Times are offered around your working hours and the drive between jobs.",
  },
  {
    icon: Inbox,
    title: "Never lose a lead",
    text: "Everyone who gets a quote is kept, so you can follow up with the ones who didn't book.",
  },
  {
    icon: Users,
    title: "Customers in one place",
    text: "Contact details, vehicles, photos and past jobs, ready before you arrive.",
  },
];

const steps = [
  { title: "Set up your services", text: "Add what you offer, your prices and your working hours." },
  { title: "Share your booking link", text: "Put it in your Instagram bio, Google profile and WhatsApp replies." },
  { title: "Get booked", text: "Bookings and deposits arrive in your diary. You turn up and do the work." },
];

export default function Home() {
  const docs = docsUrl();

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <Link href="/" className="text-lg font-semibold tracking-tight">
            ASCND
          </Link>
          <nav className="flex items-center gap-2">
            {docs && (
              <a href={docs} className={buttonVariants({ variant: "ghost" })}>
                Docs
              </a>
            )}
            <Link href={appUrl("/login")} className={buttonVariants({ variant: "ghost" })}>
              Sign in
            </Link>
            <Link href={appUrl("/signup")} className={buttonVariants()}>
              Get started
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <section className="px-4 py-16 text-center sm:py-24">
          <div className="mx-auto max-w-2xl">
            <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
              Online booking for mobile detailers
            </h1>
            <p className="mt-4 text-lg text-balance text-muted-foreground">
              Give customers an instant quote and a booking page of your own. You get a full diary and deposits paid up
              front.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link href={appUrl("/signup")} className={buttonVariants({ size: "lg" })}>
                Get started
              </Link>
              <Link href={appUrl("/login")} className={buttonVariants({ size: "lg", variant: "outline" })}>
                Sign in
              </Link>
            </div>
          </div>
        </section>

        <section aria-labelledby="features" className="border-t bg-muted/30 px-4 py-16">
          <div className="mx-auto max-w-5xl">
            <h2 id="features" className="mb-8 text-center text-2xl font-semibold tracking-tight">
              Everything you need to take bookings
            </h2>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {features.map(({ icon: Icon, title, text }) => (
                <li key={title} className="rounded-xl border bg-card p-5">
                  <Icon className="size-5 text-primary" aria-hidden />
                  <h3 className="mt-3 font-medium">{title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{text}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section aria-labelledby="how" className="px-4 py-16">
          <div className="mx-auto max-w-3xl">
            <h2 id="how" className="mb-8 text-center text-2xl font-semibold tracking-tight">
              How it works
            </h2>
            <ol className="grid gap-6 sm:grid-cols-3">
              {steps.map((s, i) => (
                <li key={s.title} className="text-center">
                  <span
                    aria-hidden
                    className="mx-auto grid size-9 place-items-center rounded-full bg-primary text-sm font-semibold text-primary-foreground"
                  >
                    {i + 1}
                  </span>
                  <h3 className="mt-3 font-medium">{s.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{s.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="border-t bg-muted/30 px-4 py-16 text-center">
          <div className="mx-auto max-w-xl">
            <h2 className="text-2xl font-semibold tracking-tight">Ready to fill your diary?</h2>
            <Link href={appUrl("/signup")} className={cn(buttonVariants({ size: "lg" }), "mt-6")}>
              Get started
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t px-4 py-6 text-center text-sm text-muted-foreground">
        &copy; ASCND
      </footer>
    </div>
  );
}
