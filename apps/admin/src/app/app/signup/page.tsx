import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { TRIAL_DAYS } from "@leadgen/core/billing/rules";
import { landingFonts } from "@/components/landing/fonts";
import { Wordmark } from "@/components/landing/site-header";
import { getCurrentUser } from "@/lib/auth";
import { PRICE, PRODUCT_NAME } from "@/lib/brand";
import { appUrl, marketingUrl } from "@/lib/urls";
import { SignUpForm } from "./signup-form";
// The marketing site's colours and type, for the panel beside the form.
import "../../(marketing)/(site)/landing.css";

export const metadata: Metadata = { title: `Start your free trial · ${PRODUCT_NAME}` };

const POINTS = [
  { title: "Instant quotes", text: "Customers get a price from your own rules, in seconds." },
  { title: "Real availability", text: "Only times you can do, with travel between jobs worked out." },
  { title: "Deposits that cut no-shows", text: "Paid straight into your own Stripe account." },
];

// Sign-up: the product's own look down the side (fixed colours, the same in
// light and dark mode, as on the marketing site), the form in the dashboard's
// theme beside it. On a phone the side panel becomes a band across the top.
export default function SignUpPage() {
  const signIn = (
    <p className="text-sm text-muted-foreground">
      Already have an account?{" "}
      <Link href={appUrl("/login")} className="font-medium text-foreground underline underline-offset-4">
        Sign in
      </Link>
    </p>
  );

  return (
    <main className={`${landingFonts} grid flex-1 content-start lg:min-h-dvh lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:content-normal`}>
      <aside className="lp relative hidden flex-col justify-between gap-10 overflow-hidden px-12 py-10 lg:flex xl:px-16">
        {/* A strip of hi-vis down the edge, as on the marketing pages. */}
        <span aria-hidden className="absolute inset-y-0 right-0 w-1 bg-(--hi)" />
        <Link href={marketingUrl("/")} aria-label={`${PRODUCT_NAME} home`} className="justify-self-start">
          <Wordmark />
        </Link>

        <div className="grid gap-8">
          <div className="grid gap-4">
            <p className="lp-data text-xs tracking-[0.2em] text-(--hi) uppercase">Free for {TRIAL_DAYS} days</p>
            <h1 className="lp-display max-w-xl text-5xl xl:text-6xl 2xl:text-7xl">
              Turn every enquiry into a <span className="text-(--hi)">booked, paid job.</span>
            </h1>
            <p className="max-w-sm text-(--mist)">
              A booking page and an Instant quote button for your detailing business, set up in about two minutes.
            </p>
          </div>
          <ol className="grid max-w-lg gap-3 [@media(max-height:879px)]:hidden">
            {POINTS.map(({ title, text }, i) => (
              <li key={title} className="grid grid-cols-[2.5rem_1fr] gap-1 border-t border-(--rule-dark) pt-3">
                <span className="lp-data text-sm text-(--hi)">{String(i + 1).padStart(2, "0")}</span>
                <span className="grid gap-0.5">
                  <span className="font-semibold">{title}</span>
                  <span className="text-sm text-(--mist)">{text}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>

        <PlanTicket />
      </aside>

      {/* On a phone: the brand and the price, across the top. */}
      <header className="lp grid gap-4 px-4 pt-5 pb-6 sm:px-10 lg:hidden">
        <Link href={marketingUrl("/")} aria-label={`${PRODUCT_NAME} home`} className="justify-self-start">
          <Wordmark />
        </Link>
        <div className="grid gap-1.5">
          <h1 className="lp-display text-4xl">
            Start your <span className="text-(--hi)">{TRIAL_DAYS}-day</span> free trial
          </h1>
          <p className="lp-data text-sm text-(--mist)">
            £0 today · then {PRICE.monthly} a month · cancel any time
          </p>
        </div>
      </header>

      <div className="flex flex-col px-4 pt-6 pb-10 sm:px-10 lg:px-16 lg:py-10">
        <div className="hidden justify-end lg:flex">{signIn}</div>
        <div className="mx-auto grid w-full max-w-md flex-1 content-start gap-8 lg:content-center lg:py-12">
          <Suspense fallback={<div className="h-96" />}>
            <Form />
          </Suspense>
          <div className="lg:hidden">{signIn}</div>
        </div>
      </div>
    </main>
  );
}

// What they're signing up for, as a job ticket: nothing today, then the price.
function PlanTicket() {
  const rows: [string, string][] = [
    ["Due today", "£0.00"],
    ["Free trial", `${TRIAL_DAYS} days`],
    ["Then", `${PRICE.monthly} / month`],
    ["Cancel", "Any time"],
  ];
  return (
    <div className="lp-ticket w-full max-w-sm bg-(--paper) p-5 text-(--ink) shadow-2xl [--tilt:-1.5deg]">
      <div className="lp-data flex items-center justify-between text-[0.7rem] tracking-[0.18em] uppercase">
        <span>Your plan</span>
        <span className="text-(--graphite)">One plan · everything in</span>
      </div>
      <dl className="lp-data mt-3 grid gap-1.5 border-t border-dashed border-(--rule) pt-3 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-baseline justify-between gap-4">
            <dt className="text-(--graphite)">{k}</dt>
            <dd className="font-semibold">{v}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 border-t border-dashed border-(--rule) pt-3 text-xs text-(--graphite)">
        Your card is checked, not charged. Payments are handled by Stripe.
      </p>
    </div>
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
