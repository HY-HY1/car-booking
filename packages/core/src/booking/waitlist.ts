import "server-only";
import { createAdminClient } from "../supabase/admin";

// The waiting list is the customers who ticked "I'm flexible" when they
// booked: a later job that could come forward when a time opens up.

export type FlexibleJob = {
  id: string;
  startsAt: string;
  endsAt: string;
  customerName: string | null;
  customerEmail: string | null;
  serviceName: string | null;
};

const fits = (job: { startsAt: string; endsAt: string }, freed: { start: Date; end: Date }) =>
  new Date(job.endsAt).getTime() - new Date(job.startsAt).getTime() <= freed.end.getTime() - freed.start.getTime();

// Jobs after a freed-up time that asked to come earlier and would fit in it.
export async function flexibleJobs(
  tenantId: string,
  freed: { startsAt: string; endsAt: string; locationType: string },
  limit = 10,
): Promise<FlexibleJob[]> {
  const start = new Date(freed.startsAt);
  const { data, error } = await createAdminClient()
    .from("bookings")
    .select("id, starts_at, ends_at, customer:customers(name, email), service:services(name)")
    .eq("tenant_id", tenantId)
    .eq("status", "confirmed")
    .eq("location_type", freed.locationType)
    .gt("starts_at", start.toISOString())
    .eq("quote_snapshot->answers->details->>flexible", "true")
    .order("starts_at")
    .limit(50);
  if (error) throw error;

  const span = { start, end: new Date(freed.endsAt) };
  return data
    .map((b) => {
      const customer = b.customer as unknown as { name: string; email: string | null } | null;
      return {
        id: b.id,
        startsAt: b.starts_at,
        endsAt: b.ends_at,
        customerName: customer?.name ?? null,
        customerEmail: customer?.email ?? null,
        serviceName: (b.service as unknown as { name: string } | null)?.name ?? null,
      };
    })
    .filter((j) => fits(j, span))
    .slice(0, limit);
}
