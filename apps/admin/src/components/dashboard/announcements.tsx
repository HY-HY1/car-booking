import Link from "next/link";
import { CalendarCheck, Check, ChevronDown, Hourglass, Inbox, Megaphone, TriangleAlert, Wrench } from "lucide-react";
import { closureDate } from "@leadgen/core/settings/account";
import type { SetupStepKey } from "@leadgen/core/onboarding/steps";
import { requireTenant } from "@/lib/auth";
import { loadSetup } from "@/lib/setup";
import { createClient } from "@/lib/supabase/server";
import { appUrl } from "@/lib/urls";

// The announcement bar across the top of every dashboard page. Nothing is
// stored: each line is worked out from the business's current state (setup
// progress, enquiries in the last week), the same way the checklist ticks
// itself off. It shows the most important line, with the rest a click away. A
// failed lookup just drops that part rather than breaking the page.

const DONE_TEXT: Record<SetupStepKey, string> = {
  services: "Services and prices checked",
  hours: "Working hours set",
  area: "Starting point set",
  payments: "Stripe connected, deposits are live",
  email: "Emails come from your own address",
  address: "Booking page is live",
  enquiry: "First enquiry received",
};

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

type Item = { key: string; icon: React.ReactNode; text: string; href?: string };

// Outside the component: the time is read once per request on the server.
function weekAgo() {
  return new Date(Date.now() - WEEK_MS).toISOString();
}

export async function Announcements({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant: slug } = await params;
  const { tenant, can } = await requireTenant(slug);
  const base = appUrl(`/${slug}`);
  const items: Item[] = [];
  const icon = (I: typeof Check) => <I className="size-4" />;

  // Setup comes first: unfinished work matters most, finished steps least.
  const done: Item[] = [];
  if (can("setup")) {
    try {
      const setup = await loadSetup(tenant.id);
      if (setup) {
        if (!setup.progress.ready) {
          items.push({
            key: "setup",
            icon: icon(Wrench),
            text: `Finish setting up: ${setup.progress.doneRequired} of ${setup.progress.totalRequired} steps done`,
            href: `${base}/setup`,
          });
        } else {
          items.push({
            key: "ready",
            icon: icon(Check),
            text: "Setup complete: you're ready to take bookings",
            href: `${base}/setup`,
          });
        }
        for (const s of setup.steps) {
          if (s.done) done.push({ key: s.key, icon: icon(Check), text: DONE_TEXT[s.key], href: `${base}/setup` });
        }
      }
    } catch (error) {
      console.error("Couldn't load the setup checklist for announcements", error);
    }
  }

  const since = weekAgo();
  try {
    const supabase = await createClient();
    const [bookings, leads, requested, closing] = await Promise.all([
      supabase
        .from("bookings")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenant.id)
        .in("status", ["confirmed", "completed"])
        .gte("created_at", since),
      supabase
        .from("leads")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenant.id)
        .gte("created_at", since),
      supabase
        .from("bookings")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenant.id)
        .eq("status", "requested"),
      supabase.from("tenants").select("deletion_requested_at").eq("id", tenant.id).single(),
    ]);
    if (bookings.error) throw bookings.error;
    if (leads.error) throw leads.error;
    if (requested.error) throw requested.error;
    if (closing.error) throw closing.error;
    // Things that need doing go before everything else.
    if (closing.data.deletion_requested_at && can("account.close")) {
      const when = closureDate(closing.data.deletion_requested_at).toLocaleDateString("en-GB", { day: "numeric", month: "long" });
      items.unshift({
        key: "closing",
        icon: icon(TriangleAlert),
        text: `This account is set to be deleted on ${when}. Undo it in Settings → Privacy.`,
        href: `${base}/settings/privacy#close-account`,
      });
    }
    if (requested.count && can("bookings.manage")) {
      items.unshift({
        key: "requested",
        icon: icon(Hourglass),
        text: `${requested.count} ${requested.count === 1 ? "booking is" : "bookings are"} waiting for your approval`,
        href: `${base}/bookings`,
      });
    }
    if (bookings.count) {
      items.push({
        key: "bookings",
        icon: icon(CalendarCheck),
        text: `${bookings.count} new ${bookings.count === 1 ? "booking" : "bookings"} in the last 7 days`,
        href: `${base}/bookings`,
      });
    }
    if (leads.count && can("leads.view")) {
      items.push({
        key: "leads",
        icon: icon(Inbox),
        text: `${leads.count} new ${leads.count === 1 ? "lead" : "leads"} in the last 7 days`,
        href: `${base}/leads`,
      });
    }
  } catch (error) {
    console.error("Couldn't load recent activity", error);
  }

  items.push(...done);
  if (items.length === 0) return null;

  const [first, ...rest] = items;

  return (
    <section aria-label="Announcements" className="border-b bg-muted/40 text-sm">
      <details className="group">
        <summary
          className={`flex items-center gap-2 px-4 py-2 md:px-8 ${rest.length > 0 ? "cursor-pointer" : "list-none"} [&::-webkit-details-marker]:hidden`}
        >
          <Megaphone className="size-4 shrink-0 text-muted-foreground" />
          <span className="min-w-0 truncate">{first.text}</span>
          {rest.length > 0 && (
            <span className="ml-auto flex shrink-0 items-center gap-1 text-muted-foreground">
              {rest.length} more
              <ChevronDown className="size-4 transition-transform group-open:rotate-180" />
            </span>
          )}
        </summary>
        <ul className="grid gap-1 px-4 pb-3 sm:grid-cols-2 md:px-8">
          {items.map((i) => (
            <li key={i.key}>
              {i.href ? (
                <Link href={i.href} className="flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-muted">
                  <span className="text-muted-foreground">{i.icon}</span>
                  {i.text}
                </Link>
              ) : (
                <span className="flex items-center gap-2 px-2 py-1">
                  <span className="text-muted-foreground">{i.icon}</span>
                  {i.text}
                </span>
              )}
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}
