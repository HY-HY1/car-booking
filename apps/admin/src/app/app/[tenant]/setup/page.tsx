import type { Metadata } from "next";
import Link from "next/link";
import { Check } from "lucide-react";
import type { SetupStep, SetupStepKey } from "@leadgen/core/onboarding/steps";
import { ComingSoon, PageHeader } from "@/components/dashboard/page-header";
import { CopyText } from "@/components/platform/copy-text";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAccess } from "@/lib/auth";
import { loadSetup } from "@/lib/setup";
import { cn } from "@/lib/utils";
import { connectStripeAction } from "../settings/actions";
import { appUrl, tenantUrl } from "@/lib/urls";

export const metadata: Metadata = { title: "Get set up" };

// Steps that keep their button after they're ticked, so the owner can go back and edit.
const EDITABLE_WHEN_DONE: SetupStepKey[] = ["services", "hours", "area"];

export default async function SetupPage({ params }: PageProps<"/app/[tenant]/setup">) {
  const { tenant: slug } = await params;
  const { tenant, can } = await requireAccess(slug, "setup");
  const setup = await loadSetup(tenant.id);

  if (!setup) {
    return (
      <>
        <PageHeader title="Get set up" />
        <ComingSoon>Booking isn&apos;t set up for this business yet.</ComingSoon>
      </>
    );
  }

  const { steps, progress, customDomain } = setup;
  // The booking page works from the start, on the custom domain once one is verified.
  const bookingLink = tenantUrl(slug, "/", { absolute: true, customDomain });
  const bookingAddress = bookingLink.replace(/^https?:\/\//, "");
  const base = appUrl(`/${slug}`);
  // Connecting Stripe is the owner's.
  const isOwner = can("stripe.connect");

  const copy: Record<SetupStepKey, { title: string; text: string; action?: React.ReactNode }> = {
    services: {
      title: "Check your services and prices",
      text: "Your booking page starts with two example services. Change them to what you actually offer, with your own prices, and add any extras.",
      action: <StepLink href={`${base}/pricing`}>Edit pricing</StepLink>,
    },
    hours: {
      title: "Set your working hours",
      text: "Customers can only book times inside these hours. Set different hours for your van and your unit if you have both.",
      action: <StepLink href={`${base}/settings/booking`}>Edit hours</StepLink>,
    },
    area: {
      title: "Say where your van starts from",
      text: "Add the postcode you set off from. It's used to work out travel time between jobs, and who is inside your service area.",
      action: <StepLink href={`${base}/settings/booking`}>Add postcode</StepLink>,
    },
    payments: {
      title: "Connect Stripe to take deposits",
      text: "Deposits go straight into your own Stripe account. Until it's connected, bookings are taken without a deposit step.",
      action: isOwner ? (
        <form action={connectStripeAction.bind(null, slug)}>
          <Button type="submit" size="sm">
            {steps.find((s) => s.key === "payments")?.state === "in_progress" ? "Continue Stripe setup" : "Connect Stripe"}
          </Button>
        </form>
      ) : (
        <p className="text-sm text-muted-foreground">Ask the business owner to connect Stripe.</p>
      ),
    },
    email: {
      title: "Set up your email address",
      text: "Customers get their confirmations and reminders from your own address, like hello@yourbusiness.co.uk. Add it, then add the DNS records it shows. Until it's verified, customers aren't emailed.",
      action: (
        <StepLink href={`${base}/settings/notifications`}>
          {steps.find((s) => s.key === "email")?.state === "in_progress" ? "Finish email setup" : "Set up email"}
        </StepLink>
      ),
    },
    address: {
      title: "Your booking page goes live",
      text: `Customers can book at ${bookingAddress}.`,
    },
    enquiry: {
      title: "Try it yourself, then share it",
      text: "Make a test enquiry on your own booking page, then put the link in your Instagram bio, Google profile and WhatsApp replies. Bookings and enquiries appear under Bookings and Leads.",
      action: (
        <a href={bookingLink} target="_blank" rel="noreferrer" className={buttonVariants({ variant: "outline", size: "sm" })}>
          Open your booking page
        </a>
      ),
    },
  };

  // Once live, say where.
  const doneText: Partial<Record<SetupStepKey, string>> = {
    address: `Customers can book at ${bookingAddress}.`,
  };

  const { doneRequired, totalRequired, ready } = progress;

  return (
    <>
      <PageHeader
        title="Get set up"
        description={`Welcome to ${tenant.name}. A few things to check before you take real bookings.`}
      />

      <div className="grid max-w-3xl gap-8">
        <section aria-labelledby="progress-heading">
          <div className="mb-2 flex items-baseline justify-between gap-3">
            <h2 id="progress-heading" className="font-medium">
              {ready ? "You're ready to take bookings" : `${doneRequired} of ${totalRequired} steps done`}
            </h2>
            {!ready && <span className="text-sm text-muted-foreground">{totalRequired - doneRequired} to go</span>}
          </div>
          <div
            role="progressbar"
            aria-labelledby="progress-heading"
            aria-valuemin={0}
            aria-valuemax={totalRequired}
            aria-valuenow={doneRequired}
            className="h-2 overflow-hidden rounded-full bg-muted"
          >
            <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${(doneRequired / totalRequired) * 100}%` }} />
          </div>
        </section>

        <ol className="grid gap-3">
          {steps.map((step, i) => (
            <StepCard key={step.key} number={i + 1} step={step} title={copy[step.key].title}>
              <p className="text-sm text-muted-foreground">
                {step.done ? (doneText[step.key] ?? "Done. You can still change it any time.") : copy[step.key].text}
              </p>
              {/* Connecting Stripe and trying the page only make sense until they're done. */}
              {(!step.done || EDITABLE_WHEN_DONE.includes(step.key)) && copy[step.key].action && (
                <div className="mt-3">{copy[step.key].action}</div>
              )}
            </StepCard>
          ))}
        </ol>

        <Card>
          <CardHeader>
            <CardTitle>Preview your booking page</CardTitle>
            <CardDescription>This is what customers see when they visit {bookingAddress}.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <iframe
              src={bookingLink}
              title={`Preview of ${tenant.name} booking page`}
              loading="lazy"
              className="h-160 w-full rounded-lg border bg-background"
            />
            <div className="flex items-center justify-end gap-3">
              <a
                href={bookingLink}
                target="_blank"
                rel="noreferrer"
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                Open in new tab
              </a>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Add the quote button to your website</CardTitle>
            <CardDescription>
              Optional. Your own website gets a floating &ldquo;Instant quote&rdquo; button that opens your booking
              page in a panel.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <p className="text-muted-foreground">
              Paste this into your website just before the closing body tag. If someone else looks after your site,
              send it to them.
            </p>
            <CopyText value={`<script src="${tenantUrl(slug, "/embed.js", { absolute: true, customDomain })}" async></script>`} label="website script" />
            <p className="text-muted-foreground">Or share the booking page link directly:</p>
            <CopyText value={bookingLink} label="booking page link" />
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function StepLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className={buttonVariants({ variant: "outline", size: "sm" })}>
      {children}
    </Link>
  );
}

function StepCard({
  number,
  step,
  title,
  children,
}: {
  number: number;
  step: SetupStep;
  title: string;
  children: React.ReactNode;
}) {
  const note = step.done
    ? null
    : step.state === "in_progress"
      ? "Started"
      : step.state === "waiting_on_us"
        ? "On us"
        : !step.required
          ? "Optional"
          : null;

  return (
    <li className="flex gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
      <span
        aria-hidden
        className={cn(
          "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-medium",
          step.done ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
        )}
      >
        {step.done ? <Check className="size-3.5" /> : number}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <h3 className="font-medium">
            {title}
            <span className="sr-only">{step.done ? " (done)" : " (not done yet)"}</span>
          </h3>
          {note && <span className="text-xs text-muted-foreground">{note}</span>}
        </div>
        {children}
      </div>
    </li>
  );
}
