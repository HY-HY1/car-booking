import { listCustomers, searchTerm } from "@/lib/customers";
import { createClient } from "@/lib/supabase/server";

// The dashboard search: one box that looks across customers, bookings and
// leads. Bookings and leads are found through the customer who made them, and
// bookings also by postcode. Each list is capped; the Customers page has the
// full paged search.

const LIMIT = 10;

export type SearchResults = {
  customers: Awaited<ReturnType<typeof listCustomers>>["customers"];
  customersTotal: number;
  bookings: {
    id: string;
    starts_at: string;
    status: string;
    postcode: string | null;
    customer: { name: string } | null;
    service: { name: string } | null;
  }[];
  leads: {
    id: string;
    status: string;
    created_at: string;
    customer: { name: string } | null;
  }[];
};

export async function searchDashboard(tenantId: string, q: string): Promise<SearchResults> {
  const term = searchTerm(q);
  if (term.length < 2) return { customers: [], customersTotal: 0, bookings: [], leads: [] };

  const { customers, total } = await listCustomers(tenantId, { q: term, page: 1 });
  const ids = customers.map((c) => c.id);

  const supabase = await createClient();
  const bookingFilter = [`postcode.ilike.%${term}%`, ids.length > 0 && `customer_id.in.(${ids.join(",")})`]
    .filter(Boolean)
    .join(",");

  const [bookings, leads] = await Promise.all([
    supabase
      .from("bookings")
      .select("id, starts_at, status, postcode, customer:customers(name), service:services(name)")
      .eq("tenant_id", tenantId)
      .neq("status", "expired")
      .or(bookingFilter)
      .order("starts_at", { ascending: false })
      .limit(LIMIT),
    ids.length === 0
      ? Promise.resolve({ data: [], error: null })
      : supabase
          .from("leads")
          .select("id, status, created_at, customer:customers(name)")
          .eq("tenant_id", tenantId)
          .in("customer_id", ids)
          .order("created_at", { ascending: false })
          .limit(LIMIT),
  ]);
  if (bookings.error) throw bookings.error;
  if (leads.error) throw leads.error;

  return {
    customers: customers.slice(0, LIMIT),
    customersTotal: total,
    bookings: bookings.data as unknown as SearchResults["bookings"],
    leads: leads.data as unknown as SearchResults["leads"],
  };
}
