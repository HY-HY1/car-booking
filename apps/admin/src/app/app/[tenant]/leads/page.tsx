import type { Metadata } from "next";
import Link from "next/link";
import { Camera } from "lucide-react";
import { formatPence } from "@leadgen/core/booking/config";
import { formatPhone } from "@leadgen/core/customer-fields";
import { formatDate } from "@leadgen/core/dates";
import { conversionBySource, LOST_REASONS, lostReasonCounts } from "@leadgen/core/leads/rules";
import { PageHeader } from "@/components/dashboard/page-header";
import { requireAccess } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { appUrl } from "@/lib/urls";
import { EmptyState } from "@/components/ui/empty-state";
import { BOOKING_SOURCE } from "@/lib/booking-display";

export const metadata: Metadata = { title: "Leads" };

const FILTERS = { open: "Open", booked: "Booked", lost: "Lost" } as const;
type Filter = keyof typeof FILTERS;

const STATUS: Record<string, string> = {
  new: "New",
  quoted: "Quoted",
  booked: "Booked",
  lost: "Lost",
};

type LeadRow = {
  id: string;
  status: string;
  source: string;
  quote_snapshot: { service_name?: string; total_pence?: number } | null;
  created_at: string;
  customer: { id: string; name: string; email: string | null; phone: string | null } | null;
  photos: { count: number }[];
};

export default async function LeadsPage({
  params,
  searchParams,
}: PageProps<"/app/[tenant]/leads">) {
  const { tenant: slug } = await params;
  const { tenant } = await requireAccess(slug, "leads.view");
  const sp = await searchParams;
  const filter: Filter = sp.status === "booked" || sp.status === "lost" ? sp.status : "open";

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("leads")
    .select("id, status, source, quote_snapshot, created_at, customer:customers(id, name, email, phone), photos(count)")
    .eq("tenant_id", tenant.id)
    .in("status", filter === "open" ? ["new", "quoted"] : [filter])
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  const leads = data as unknown as LeadRow[];

  // How the last 90 days went. A fixed window, so the numbers don't change
  // with the tab being looked at.
  const since = new Date(new Date().getTime() - 90 * 86_400_000).toISOString();
  const recent = await supabase.from("leads").select("source, status, lost_reason").eq("tenant_id", tenant.id).gte("created_at", since).limit(5000);
  if (recent.error) throw recent.error;
  const bySource = conversionBySource(recent.data);
  const lost = lostReasonCounts(recent.data);

  const base = appUrl(`/${slug}/leads`);

  return (
    <>
      <PageHeader title="Leads" />

      <nav className="mb-4 flex gap-1">
        {(Object.keys(FILTERS) as Filter[]).map((f) => (
          <Link
            key={f}
            href={f === "open" ? base : `${base}?status=${f}`}
            aria-current={filter === f ? "page" : undefined}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted",
              filter === f && "bg-muted text-foreground",
            )}
          >
            {FILTERS[f]}
          </Link>
        ))}
      </nav>

      {bySource.length > 0 && (
        <section aria-label="Last 90 days" className="mb-4 grid gap-4 rounded-xl border p-4 text-sm sm:grid-cols-2">
          <div>
            <h2 className="mb-2 font-medium">Where leads came from, last 90 days</h2>
            <ul className="grid gap-1">
              {bySource.map((s) => (
                <li key={s.source} className="flex justify-between gap-3">
                  <span>{BOOKING_SOURCE[s.source] ?? s.source}</span>
                  <span className="text-muted-foreground">
                    {s.total} {s.total === 1 ? "lead" : "leads"} · {s.rate}% booked
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="mb-2 font-medium">Why leads were lost</h2>
            {lost.length === 0 ? (
              <p className="text-muted-foreground">None marked as lost.</p>
            ) : (
              <ul className="grid gap-1">
                {lost.map((l) => (
                  <li key={l.reason} className="flex justify-between gap-3">
                    <span>{LOST_REASONS[l.reason as keyof typeof LOST_REASONS] ?? "No reason given"}</span>
                    <span className="text-muted-foreground">{l.count}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}

      {leads.length === 0 ? (
        <EmptyState>
          {filter === "open"
            ? "No open leads. Anyone who leaves the booking flow after giving their details will show up here."
            : "Nothing here yet."}
        </EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Customer</th>
                <th className="px-4 py-2 font-medium">Quote</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Received</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {leads.map((l) => (
                <tr key={l.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3">
                    {l.customer ? (
                      <div className="grid">
                        <Link
                          href={appUrl(`/${slug}/customers/${l.customer.id}`)}
                          className="font-medium underline-offset-4 hover:underline"
                        >
                          {l.customer.name}
                        </Link>
                        <span className="text-muted-foreground">
                          {[l.customer.phone && formatPhone(l.customer.phone), l.customer.email]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      </div>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {l.quote_snapshot?.service_name ?? "—"}
                    {l.quote_snapshot?.total_pence != null && (
                      <span className="text-muted-foreground">
                        {" "}
                        · {formatPence(l.quote_snapshot.total_pence)}
                      </span>
                    )}
                    {l.customer && l.photos[0]?.count > 0 && (
                      <Link
                        href={appUrl(`/${slug}/customers/${l.customer.id}#photos`)}
                        className="mt-0.5 flex w-fit items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                      >
                        <Camera className="size-3.5" />
                        {l.photos[0].count} {l.photos[0].count === 1 ? "photo" : "photos"}
                      </Link>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {STATUS[l.status] ?? l.status}
                    <Link
                      href={appUrl(`/${slug}/leads/${l.id}`)}
                      className="block text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                    >
                      View answers
                    </Link>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                    {formatDate(l.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
