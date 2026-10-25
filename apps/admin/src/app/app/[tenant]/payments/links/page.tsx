import type { Metadata } from "next";
import { formatPence } from "@leadgen/core/booking/config";
import { balanceDuePence } from "@leadgen/core/stripe/payment-rules";
import { CopyText } from "@/components/platform/copy-text";
import { DeactivateLink, PaymentLinkForm, type BookingChoice } from "@/components/dashboard/payment-link-form";
import { requireTenant } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { OwnersOnly } from "../notices";

export const metadata: Metadata = { title: "Payment links" };

type BookingRow = {
  id: string;
  starts_at: string;
  price_pence: number;
  deposit_pence: number;
  deposit_status: string;
  customer: { name: string } | null;
  service: { name: string } | null;
};

export default async function PaymentLinksPage({ params }: PageProps<"/app/[tenant]/payments/links">) {
  const { tenant: slug } = await params;
  const { tenant, can } = await requireTenant(slug);
  if (!can("money")) return <OwnersOnly />;

  // RLS limits both reads to this business; owners only for the links.
  const supabase = await createClient();
  const sinceDate = new Date();
  sinceDate.setDate(sinceDate.getDate() - 45);
  const since = sinceDate.toISOString();
  const [links, bookings, payments] = await Promise.all([
    supabase
      .from("payment_links")
      .select("id, url, description, amount_pence, single_use, active, created_at")
      .eq("tenant_id", tenant.id)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("bookings")
      .select("id, starts_at, price_pence, deposit_pence, deposit_status, customer:customers(name), service:services(name)")
      .eq("tenant_id", tenant.id)
      .in("status", ["confirmed", "completed"])
      .gte("ends_at", since)
      .order("starts_at", { ascending: false })
      .limit(100),
    supabase.from("tenants").select("stripe_ready").eq("id", tenant.id).single(),
  ]);
  if (links.error) throw links.error;
  if (bookings.error) throw bookings.error;
  if (payments.error) throw payments.error;

  const choices: BookingChoice[] = (bookings.data as unknown as BookingRow[])
    .map((b) => ({ b, balancePence: balanceDuePence(b) }))
    .filter(({ balancePence }) => balancePence > 0)
    .map(({ b, balancePence }) => {
      const service = b.service?.name ?? "Booking";
      const when = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "Europe/London" }).format(
        new Date(b.starts_at),
      );
      return {
        id: b.id,
        label: `${b.customer?.name ?? "Customer"}, ${service}, ${when}`,
        balancePence,
        description: `Balance: ${service}, ${when}`,
      };
    });

  return (
    <div className="grid gap-8">
      {payments.data.stripe_ready ? (
        <section className="grid gap-3">
          <h2 className="text-lg font-semibold">Create a payment link</h2>
          <PaymentLinkForm slug={slug} bookings={choices} />
        </section>
      ) : (
        <p className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
          Payment links need Stripe connected and set up. Finish it under Settings → Payments.
        </p>
      )}

      <section className="grid gap-3">
        <h2 className="text-lg font-semibold">Your links</h2>
        {links.data.length === 0 ? (
          <p className="text-sm text-muted-foreground">No links yet.</p>
        ) : (
          <ul className="divide-y rounded-xl border">
            {links.data.map((l) => (
              <li key={l.id} className="grid gap-2 px-4 py-3 text-sm">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="font-medium">{l.description}</span>
                  <span>{formatPence(l.amount_pence)}</span>
                  <span className="text-xs text-muted-foreground">
                    {[l.single_use ? "One-off" : "Reusable", l.active ? "Active" : "Switched off", formatDay(l.created_at)].join(" · ")}
                  </span>
                  {l.active && (
                    <div className="ml-auto">
                      <DeactivateLink slug={slug} id={l.id} />
                    </div>
                  )}
                </div>
                {l.active && <CopyText value={l.url} label="payment link" />}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function formatDay(iso: string) {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/London" }).format(
    new Date(iso),
  );
}
