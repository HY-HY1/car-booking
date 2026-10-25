import type { Metadata } from "next";
import Link from "next/link";
import { paidByBooking } from "@leadgen/core/stripe/ledger";
import { BookingsTable, type BookingTableRow } from "@/components/dashboard/bookings-table";
import { PageHeader } from "@/components/dashboard/page-header";
import { requireTenant } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { appUrl } from "@/lib/urls";

export const metadata: Metadata = { title: "Bookings" };

const VIEWS = { upcoming: "Upcoming", past: "Past", all: "All" } as const;
type View = keyof typeof VIEWS;

export default async function BookingsPage({
  params,
  searchParams,
}: PageProps<"/app/[tenant]/bookings">) {
  const { tenant: slug } = await params;
  const { tenant } = await requireTenant(slug);
  const sp = await searchParams;
  const view: View = sp.view === "past" || sp.view === "all" ? sp.view : "upcoming";

  // Expired holds are abandoned checkouts, not bookings; they're left out.
  const supabase = await createClient();
  const now = new Date().toISOString();
  let query = supabase
    .from("bookings")
    .select(
      "id, starts_at, ends_at, created_at, status, location_type, address_line, postcode, access_notes, customer_notes, quote_snapshot, source, price_pence, deposit_pence, deposit_status, customer:customers(id, name, email, phone), service:services(name), vehicle:vehicles(make, model, registration, size_class), photos(count)",
    )
    .eq("tenant_id", tenant.id)
    .neq("status", "expired")
    .limit(200);
  if (view === "upcoming") query = query.gte("ends_at", now).order("starts_at");
  else if (view === "past") query = query.lt("ends_at", now).order("starts_at", { ascending: false });
  else query = query.order("starts_at", { ascending: false });

  const { data, error } = await query;
  if (error) throw error;
  const rows = data as unknown as Omit<BookingTableRow, "paid_pence">[];
  // What's actually been paid on each, from the payments ledger.
  const paid = await paidByBooking(
    tenant.id,
    rows.map((r) => r.id),
  );
  const bookings: BookingTableRow[] = rows.map((r) => ({ ...r, paid_pence: paid.get(r.id) ?? 0 }));

  const base = appUrl(`/${slug}/bookings`);

  return (
    <>
      <PageHeader
        title="Bookings"
        description="Held, confirmed, completed, cancelled and no-show jobs, with deposit status. Click a row for the details."
      />

      <nav className="mb-4 flex gap-1">
        {(Object.keys(VIEWS) as View[]).map((v) => (
          <Link
            key={v}
            href={v === "upcoming" ? base : `${base}?view=${v}`}
            aria-current={view === v ? "page" : undefined}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted",
              view === v && "bg-muted text-foreground",
            )}
          >
            {VIEWS[v]}
          </Link>
        ))}
      </nav>

      {bookings.length === 0 ? (
        <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          {view === "upcoming"
            ? "No upcoming bookings. They'll appear here as customers book through your booking page."
            : "No bookings to show."}
        </div>
      ) : (
        <BookingsTable rows={bookings} slug={slug} />
      )}
    </>
  );
}
