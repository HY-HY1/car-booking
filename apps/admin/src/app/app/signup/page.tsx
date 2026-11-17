import type { Metadata } from "next";
import { Check, Sparkles } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { TRIAL_DAYS } from "@leadgen/core/billing/rules";
import { siteFont } from "@/components/landing/fonts";
import { Logo } from "@/components/landing/site-header";
import { getCurrentUser } from "@/lib/auth";
import { PRICE, SITE_NAME } from "@/lib/brand";
import { appUrl, marketingUrl } from "@/lib/urls";
import { SignUpForm } from "./signup-form";
// The marketing site's look (dark, one green accent), so sign-up reads as the
// same product as the page that sent people here.
import "../../(marketing)/(site)/site.css";

export const metadata: Metadata = { title: `Start your free trial · ${SITE_NAME}` };

const POINTS = [
  { title: "Instant quotes", text: "Customers get a price from your own rules, in seconds." },
  { title: "Real availability", text: "Only times you can do, with travel between jobs worked out." },
  { title: "Deposits that cut no-shows", text: "Paid straight into your own Stripe account." },
];

// Sign-up, in the marketing site's style: the pitch and the price down the
// side, the form beside it. On a phone the side becomes a band across the
// top. The form is built from the dashboard's components, recoloured to the
// site's palette by the .site-form wrapper (site.css).
export default function SignUpPage() {
  const signIn = (
    // Shown inside the .site-form wrapper, so in the dashboard's colour names.
    <p className="text-sm text-muted-foreground">
      Already have an account?{" "}
      <Link href={appUrl("/login")} className="font-medium text-foreground underline underline-offset-4 hover:text-primary">
        Sign in
      </Link>
    </p>
  );

  return (
    <main
      className={`site ${siteFont} grid flex-1 content-start antialiased lg:min-h-dvh lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:content-normal`}
    >
      <aside className="relative isolate hidden flex-col justify-between gap-10 overflow-hidden border-r border-(--line) px-12 py-10 lg:flex xl:px-16">
        <div aria-hidden className="site-grid absolute inset-0 -z-10" />
        <div aria-hidden className="site-glow absolute inset-0 -z-10" />
        <Link href={marketingUrl("/")} aria-label={`${SITE_NAME} home`} className="justify-self-start">
          <Logo />
        </Link>

        <div className="grid gap-8">
          <div className="grid gap-5">
            <Badge />
            <h1 className="max-w-xl text-5xl leading-[1.05] font-semibold tracking-tighter text-balance [@media(min-height:960px)]:xl:text-6xl">
              Turn every enquiry into a <span className="text-(--accent)">booked, paid job.</span>
            </h1>
            <p className="max-w-sm text-lg text-pretty text-(--muted)">
              A booking page and an Instant quote button for your detailing business, set up in about two minutes.
            </p>
          </div>
          {/* Left out on short screens, so the plan card stays in view. */}
          <ul className="grid max-w-md gap-4 [@media(max-height:919px)]:hidden">
            {POINTS.map(({ title, text }) => (
              <li key={title} className="flex gap-3">
                <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border border-(--line) bg-(--soft)">
                  <Check aria-hidden className="size-3.5 text-(--accent)" />
                </span>
                <span className="grid gap-0.5">
                  <span className="font-medium">{title}</span>
                  <span className="text-sm text-(--muted)">{text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <PlanCard />
      </aside>

      {/* On a phone: the brand and the price, across the top. */}
      <header className="relative isolate grid gap-5 overflow-hidden border-b border-(--line) px-4 pt-5 pb-7 sm:px-10 lg:hidden">
        <div aria-hidden className="site-glow absolute inset-0 -z-10" />
        <Link href={marketingUrl("/")} aria-label={`${SITE_NAME} home`} className="justify-self-start">
          <Logo className="h-5" />
        </Link>
        <div className="grid gap-2">
          <h1 className="text-4xl leading-[1.05] font-semibold tracking-tighter">
            Start your <span className="text-(--accent)">{TRIAL_DAYS}-day</span> free trial
          </h1>
          <p className="text-sm text-(--muted)">£0 today · then {PRICE.monthly} a month · cancel any time</p>
        </div>
      </header>

      <div className="site-form dark flex flex-col px-4 pt-6 pb-10 sm:px-10 lg:px-16 lg:py-10">
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

function Badge() {
  return (
    <p className="inline-flex items-center gap-2 justify-self-start rounded-full border border-(--line) bg-(--soft) px-3 py-1 text-sm text-(--muted)">
      <Sparkles aria-hidden className="size-4 text-(--accent)" />
      Free for {TRIAL_DAYS} days
    </p>
  );
}

// What they're signing up for: nothing today, then the price.
function PlanCard() {
  const rows: [string, string][] = [
    ["Due today", "£0.00"],
    ["Free trial", `${TRIAL_DAYS} days`],
    ["Then", `${PRICE.monthly} / month`],
    ["Cancel", "Any time"],
  ];
  return (
    <div className="w-full max-w-sm rounded-xl border border-(--line) bg-(--bg)/70 p-5 backdrop-blur">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">Your plan</span>
        <span className="text-(--muted)">One plan, everything in</span>
      </div>
      <dl className="mt-4 grid gap-2 border-t border-(--line) pt-4 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-baseline justify-between gap-4">
            <dt className="text-(--muted)">{k}</dt>
            <dd className="font-medium tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-4 border-t border-(--line) pt-4 text-xs text-(--muted)">
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
