import type { Metadata } from "next";
import Link from "next/link";
import { formatDate, formatPhone } from "@leadgen/core/customer-fields";
import { DashboardSearch } from "@/components/dashboard/dashboard-search";
import { PageHeader } from "@/components/dashboard/page-header";
import { requireAccess } from "@/lib/auth";
import { searchDashboard } from "@/lib/search";
import { appUrl } from "@/lib/urls";

export const metadata: Metadata = { title: "Search" };

export default async function SearchPage({ params, searchParams }: PageProps<"/app/[tenant]/search">) {
  const { tenant: slug } = await params;
  const { tenant, role } = await requireAccess(slug, "customers.view");
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 100) : "";

  const r = await searchDashboard(tenant.id, q);
  const base = appUrl(`/${slug}`);
  const empty = r.customers.length + r.bookings.length + r.leads.length === 0;

  return (
    <>
      <PageHeader title="Search" description="Find customers by name, email, phone or postcode, and their bookings and leads." />
      <DashboardSearch slug={slug} role={role} defaultValue={q} />

      {q.length < 2 ? (
        <p className="text-sm text-muted-foreground">Type at least two characters to search.</p>
      ) : empty ? (
        <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          Nothing matches &ldquo;{q}&rdquo;.
        </div>
      ) : (
        <div className="grid gap-6">
          {r.customers.length > 0 && (
            <Results title="Customers">
              {r.customers.map((c) => (
                <li key={c.id}>
                  <Link href={`${base}/customers/${c.id}`} className="grid gap-0.5 px-4 py-3 text-sm hover:bg-muted/40">
                    <span className="font-medium">{c.name}</span>
                    <span className="text-muted-foreground">
                      {[c.email, c.phone && formatPhone(c.phone), c.postcode].filter(Boolean).join(" · ")}
                    </span>
                  </Link>
                </li>
              ))}
              {r.customersTotal > r.customers.length && (
                <li className="px-4 py-3 text-sm">
                  <Link href={`${base}/customers?q=${encodeURIComponent(q)}`} className="underline underline-offset-4">
                    See all {r.customersTotal} matching customers
                  </Link>
                </li>
              )}
            </Results>
          )}
          {r.bookings.length > 0 && (
            <Results title="Bookings">
              {r.bookings.map((b) => (
                <li key={b.id}>
                  <Link href={`${base}/bookings/${b.id}`} className="grid gap-0.5 px-4 py-3 text-sm hover:bg-muted/40">
                    <span className="font-medium">
                      {[b.customer?.name, b.service?.name].filter(Boolean).join(" · ") || "Booking"}
                    </span>
                    <span className="text-muted-foreground">
                      {[formatDate(b.starts_at), b.postcode, b.status].filter(Boolean).join(" · ")}
                    </span>
                  </Link>
                </li>
              ))}
            </Results>
          )}
          {r.leads.length > 0 && (
            <Results title="Leads">
              {r.leads.map((l) => (
                <li key={l.id}>
                  <Link href={`${base}/leads`} className="grid gap-0.5 px-4 py-3 text-sm hover:bg-muted/40">
                    <span className="font-medium">{l.customer?.name ?? "Lead"}</span>
                    <span className="text-muted-foreground">
                      {formatDate(l.created_at)} · {l.status}
                    </span>
                  </Link>
                </li>
              ))}
            </Results>
          )}
        </div>
      )}
    </>
  );
}

function Results({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 text-sm font-medium">{title}</h2>
      <ul className="divide-y overflow-hidden rounded-xl border">{children}</ul>
    </section>
  );
}
