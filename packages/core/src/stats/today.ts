import "server-only";
import { addDays, localDate, zonedTimeToUtc } from "../booking/time";
import { paidByBooking } from "../stripe/ledger";
import { createAdminClient } from "../supabase/admin";
import { balancesDue } from "./today-rules";

// The top of the overview page: what's on today and what's waiting on someone.
// Each list is only read for people allowed to see it; null means not for them.

// How many of each list the panel shows.
const SHOWN = 4;
// A job unpaid for longer than this has been dealt with some other way. The
// same reach as the booking picker on the payment links page.
const UNPAID_DAYS = 45;
// Nothing closes a lead that goes quiet, so "new" has to mean recent.
const LEAD_DAYS = 7;

export type TodayJob = {
  id: string;
  startsAt: string;
  endsAt: string;
  status: string;
  customer: string | null;
  service: string | null;
  postcode: string | null;
};
export type AttentionBooking = { id: string; startsAt: string; customer: string | null; service: string | null };
export type AttentionBalance = AttentionBooking & { balancePence: number };
export type AttentionLead = { id: string; createdAt: string; customer: string | null; service: string | null; quotePence: number | null };

export type AttentionList<T> = { total: number; rows: T[] };

export type Today = {
  timezone: string;
  // The business's own date, YYYY-MM-DD.
  date: string;
  jobs: TodayJob[];
  approvals: AttentionList<AttentionBooking> | null;
  unpaid: (AttentionList<AttentionBalance> & { totalPence: number }) | null;
  leads: AttentionList<AttentionLead> | null;
};

type Db = ReturnType<typeof createAdminClient>;
type Named = { name: string } | null;

async function readApprovals(db: Db, tenantId: string): Promise<AttentionList<AttentionBooking>> {
  const { data, count, error } = await db
    .from("bookings")
    .select("id, starts_at, customer:customers(name), service:services(name)", { count: "exact" })
    .eq("tenant_id", tenantId)
    .eq("status", "requested")
    .order("starts_at")
    .limit(SHOWN);
  if (error) throw error;
  return {
    total: count ?? data.length,
    rows: data.map((b) => ({
      id: b.id,
      startsAt: b.starts_at,
      customer: (b.customer as unknown as Named)?.name ?? null,
      service: (b.service as unknown as Named)?.name ?? null,
    })),
  };
}

// Finished jobs only: a balance on a job that hasn't happened yet isn't late.
async function readUnpaid(db: Db, tenantId: string, now: Date) {
  const since = new Date(now.getTime() - UNPAID_DAYS * 86_400_000);
  const { data, error } = await db
    .from("bookings")
    .select("id, starts_at, ends_at, price_pence, deposit_pence, deposit_status, customer:customers(name), service:services(name)")
    .eq("tenant_id", tenantId)
    .in("status", ["confirmed", "completed"])
    .gt("price_pence", 0)
    .gte("ends_at", since.toISOString())
    .lt("ends_at", now.toISOString())
    .order("ends_at", { ascending: false })
    .limit(200);
  if (error) throw error;

  const paid = await paidByBooking(
    tenantId,
    data.map((b) => b.id),
  );
  const due = balancesDue(data, paid);
  return {
    total: due.length,
    totalPence: due.reduce((sum, d) => sum + d.balancePence, 0),
    rows: due.slice(0, SHOWN).map(({ job, balancePence }) => ({
      id: job.id,
      startsAt: job.starts_at,
      customer: (job.customer as unknown as Named)?.name ?? null,
      service: (job.service as unknown as Named)?.name ?? null,
      balancePence,
    })),
  };
}

async function readLeads(db: Db, tenantId: string, now: Date): Promise<AttentionList<AttentionLead>> {
  const since = new Date(now.getTime() - LEAD_DAYS * 86_400_000);
  const { data, count, error } = await db
    .from("leads")
    .select("id, created_at, quote_snapshot, customer:customers(name)", { count: "exact" })
    .eq("tenant_id", tenantId)
    .in("status", ["new", "quoted"])
    .gte("created_at", since.toISOString())
    .order("created_at", { ascending: false })
    .limit(SHOWN);
  if (error) throw error;
  return {
    total: count ?? data.length,
    rows: data.map((l) => {
      const quote = l.quote_snapshot as { service_name?: string; total_pence?: number } | null;
      return {
        id: l.id,
        createdAt: l.created_at,
        customer: (l.customer as unknown as Named)?.name ?? null,
        service: quote?.service_name ?? null,
        quotePence: quote?.total_pence ?? null,
      };
    }),
  };
}

export async function getToday(
  tenantId: string,
  allowed: { approvals: boolean; unpaid: boolean; leads: boolean },
): Promise<Today> {
  const db = createAdminClient();
  const now = new Date();

  const settings = await db.from("booking_settings").select("timezone").eq("tenant_id", tenantId).maybeSingle();
  if (settings.error) throw settings.error;
  const timezone = settings.data?.timezone ?? "Europe/London";
  const date = localDate(now, timezone);
  const dayStart = zonedTimeToUtc(date, "00:00", timezone);
  const dayEnd = zonedTimeToUtc(addDays(date, 1), "00:00", timezone);

  const [jobs, approvals, unpaid, leads] = await Promise.all([
    db
      .from("bookings")
      .select("id, starts_at, ends_at, status, postcode, customer:customers(name), service:services(name)")
      .eq("tenant_id", tenantId)
      .in("status", ["confirmed", "completed", "no_show"])
      .lt("starts_at", dayEnd.toISOString())
      .gt("ends_at", dayStart.toISOString())
      .order("starts_at")
      .limit(50),
    allowed.approvals ? readApprovals(db, tenantId) : null,
    allowed.unpaid ? readUnpaid(db, tenantId, now) : null,
    allowed.leads ? readLeads(db, tenantId, now) : null,
  ]);
  if (jobs.error) throw jobs.error;

  return {
    timezone,
    date,
    jobs: jobs.data.map((b) => ({
      id: b.id,
      startsAt: b.starts_at,
      endsAt: b.ends_at,
      status: b.status,
      customer: (b.customer as unknown as Named)?.name ?? null,
      service: (b.service as unknown as Named)?.name ?? null,
      postcode: b.postcode,
    })),
    approvals,
    unpaid,
    leads,
  };
}
