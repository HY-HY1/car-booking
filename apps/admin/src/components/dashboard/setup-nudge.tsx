import Link from "next/link";
import { cookies } from "next/headers";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { loadSetup } from "@/lib/setup";
import { tipsCookieName } from "@/lib/setup-tips";
import { connectStripeAction } from "@/app/app/[tenant]/settings/actions";
import { dismissTipsAction } from "@/app/app/[tenant]/setup/actions";
import { appUrl } from "@/lib/urls";

// On the Overview, for owners. While required setup steps remain it's a
// banner into the checklist; once they're done it becomes a card of optional
// next steps that can be dismissed. A failed lookup just hides it: the
// overview shouldn't break over a nudge.
export async function SetupNudge({ tenantId, slug }: { tenantId: string; slug: string }) {
  let setup: Awaited<ReturnType<typeof loadSetup>>;
  try {
    setup = await loadSetup(tenantId);
  } catch (error) {
    console.error("Couldn't load the setup checklist", error);
    return null;
  }
  if (!setup) return null;

  const href = appUrl(`/${slug}/setup`);

  if (!setup.progress.ready) {
    const { doneRequired, totalRequired } = setup.progress;
    return (
      <Link
        href={href}
        className="mb-6 flex items-center justify-between gap-3 rounded-xl bg-card p-4 text-sm ring-1 ring-foreground/10 hover:bg-muted/40"
      >
        <span className="min-w-0">
          <span className="block font-medium">Finish setting up</span>
          <span className="block text-muted-foreground">
            {doneRequired} of {totalRequired} steps done before you take real bookings.
          </span>
        </span>
        <ArrowRight className="size-4 shrink-0" />
      </Link>
    );
  }

  if ((await cookies()).has(tipsCookieName(slug))) return null;

  const done = (key: string) => setup.steps.find((s) => s.key === key)?.done ?? false;
  const tips = [
    !done("payments") && {
      key: "payments",
      title: "Take deposits with Stripe",
      text: "Deposits cut no-shows and go straight into your own Stripe account.",
      action: (
        <form action={connectStripeAction.bind(null, slug)}>
          <Button type="submit" variant="outline" size="sm">
            Connect Stripe
          </Button>
        </form>
      ),
    },
    {
      key: "website",
      title: "Add the quote button to your website",
      text: "One line of code puts an Instant quote button on every page.",
      action: (
        <Link href={href} className="inline-flex items-center gap-1 text-sm underline underline-offset-4">
          Get the code
        </Link>
      ),
    },
    !done("enquiry") && {
      key: "enquiry",
      title: "Share your booking link",
      text: "Put it in your Instagram bio, Google profile and WhatsApp replies.",
      action: (
        <Link href={href} className="inline-flex items-center gap-1 text-sm underline underline-offset-4">
          Get the link
        </Link>
      ),
    },
  ].filter((t) => t !== false);

  return (
    <section aria-labelledby="next-steps" className="mb-6 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 id="next-steps" className="text-sm font-medium">
            You&apos;re ready for bookings
          </h2>
          <p className="text-sm text-muted-foreground">A few optional things that help it bring in more.</p>
        </div>
        <form action={dismissTipsAction.bind(null, slug)}>
          <Button type="submit" variant="ghost" size="sm">
            Dismiss
          </Button>
        </form>
      </div>
      <ul className="grid gap-3 sm:grid-cols-3">
        {tips.map((t) => (
          <li key={t.key} className="grid content-between gap-2 rounded-lg border p-3 text-sm">
            <div>
              <p className="font-medium">{t.title}</p>
              <p className="text-muted-foreground">{t.text}</p>
            </div>
            {t.action}
          </li>
        ))}
      </ul>
    </section>
  );
}
