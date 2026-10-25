import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CalendarCheck, CreditCard, Zap } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { SignUpForm } from "./signup-form";
import { appUrl } from "@/lib/urls";

export const metadata: Metadata = { title: "Start your free trial" };

const POINTS = [
  { icon: Zap, title: "Instant quotes", text: "Customers get a price from your own rules, in seconds." },
  { icon: CalendarCheck, title: "Real availability", text: "Only times you can do, with travel between jobs worked out." },
  { icon: CreditCard, title: "Deposits that cut no-shows", text: "Paid straight into your own Stripe account." },
];

export default function OnboardingPage() {
  return (
    <main className="grid flex-1 lg:grid-cols-[2fr_3fr]">
      <aside className="hidden flex-col justify-between bg-primary p-12 text-primary-foreground lg:flex">
        <div className="grid max-w-md gap-3">
          <h1 className="text-3xl font-semibold tracking-tight">Turn every enquiry into a booked, paid job.</h1>
          <p className="text-primary-foreground/70">
            A booking page and an Instant quote button for your detailing business, set up in about two minutes.
          </p>
        </div>
        <ul className="grid max-w-md gap-6">
          {POINTS.map(({ icon: Icon, title, text }) => (
            <li key={title} className="flex gap-4">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-foreground/10">
                <Icon className="size-4" aria-hidden />
              </span>
              <span className="grid gap-0.5 text-sm">
                <span className="font-medium">{title}</span>
                <span className="text-primary-foreground/70">{text}</span>
              </span>
            </li>
          ))}
        </ul>
        <p className="text-sm text-primary-foreground/70">14 days free. Cancel any time.</p>
      </aside>

      <div className="flex flex-col justify-center px-4 py-10 sm:px-10">
        <div className="mx-auto grid w-full max-w-lg gap-8">
          {/* The panel is hidden on small screens, so the pitch moves here. */}
          <header className="grid gap-1 lg:hidden">
            <h1 className="text-2xl font-semibold tracking-tight">Start your 14-day free trial</h1>
            <p className="text-sm text-muted-foreground">Instant quotes, real availability and deposits for your detailing business.</p>
          </header>

          <Suspense fallback={<div className="h-96" />}>
            <Form />
          </Suspense>

          <p className="text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href={appUrl("/login")} className="text-foreground underline underline-offset-4">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}

// Someone already signed in has an account, so they're sent to the dashboard
// to stop a second sign-up by accident. That's decided here, but acted on by
// the form only when the page first opens: signing up signs the new user in
// partway through, which re-renders this page, and a redirect then would pull
// them out of the sign-up before they've paid.
async function Form() {
  return <SignUpForm alreadySignedIn={Boolean(await getCurrentUser())} />;
}
