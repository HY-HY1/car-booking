"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { allowedStatusChanges, diaryRange } from "@leadgen/core/booking/diary";
import { driveSource, driveTimes, type DriveSource } from "@leadgen/core/booking/drive-times";
import { planRoute, type RouteStop } from "@leadgen/core/booking/route-plan";
import { addDays, isIsoDate, zonedTimeToUtc } from "@leadgen/core/booking/time";
import { notifyBookingCancelled } from "@leadgen/core/email/notify";
import { requireTenant } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const DEFAULT_TIMEZONE = "Europe/London";

async function timezoneOf(tenantId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("booking_settings")
    .select("timezone")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error) throw error;
  return data?.timezone ?? DEFAULT_TIMEZONE;
}

// ------------------------------------------------------------- booking status

const statusSchema = z.enum(["confirmed", "completed", "no_show", "cancelled"]);

// Completed, no-show, cancelled, or put back. The booking is found within the
// business from the URL's membership check; the change has to be one the
// current status allows, and is only applied if the status hasn't moved since
// the page was drawn. Money is untouched: a cancelled job's deposit is dealt
// with on the booking's own page.
export async function setBookingStatusAction(
  slug: string,
  bookingId: string,
  next: string,
): Promise<{ error?: string }> {
  const { tenant, user, can } = await requireTenant(slug);
  const status = statusSchema.safeParse(next);
  if (!status.success || !z.uuid().safeParse(bookingId).success) return { error: "That isn't a change we can make." };
  // Technicians mark jobs done or a no-show; cancelling and putting a job
  // back are for whoever manages bookings.
  const manages = can("bookings.manage");
  if (!manages && (status.data === "cancelled" || status.data === "confirmed")) {
    return { error: "Your access level doesn't include cancelling jobs. Ask the office." };
  }

  const supabase = await createClient();
  const { data: booking, error: readError } = await supabase
    .from("bookings")
    .select("status")
    .eq("tenant_id", tenant.id)
    .eq("id", bookingId)
    .maybeSingle();
  if (readError) {
    console.error("Booking status read failed", readError);
    return { error: "Couldn't load the booking. Try again." };
  }
  if (!booking) return { error: "That booking no longer exists." };
  if (!allowedStatusChanges(booking.status).includes(status.data)) {
    return { error: "This booking has changed since you opened it. Reload the diary." };
  }

  const { data: updated, error } = await supabase
    .from("bookings")
    .update({ status: status.data })
    .eq("tenant_id", tenant.id)
    .eq("id", bookingId)
    .eq("status", booking.status)
    .select("id");
  if (error) {
    // 23P01: another live booking now sits in this time (putting back a
    // cancelled job whose slot was rebooked).
    if (error.code === "23P01") return { error: "Another booking has taken that time, so this one can't be put back." };
    console.error("Booking status update failed", error);
    return { error: "Couldn't update the booking. Try again." };
  }
  if (!updated?.length) return { error: "This booking has changed since you opened it. Reload the diary." };

  if (status.data === "cancelled") await notifyBookingCancelled(tenant.id, bookingId, { by: user.email ?? null });
  refresh();
  return {};
}

// ------------------------------------------------------------- time off

export type BlockTimeState = {
  errors?: Record<string, string | undefined>;
  message?: string;
  saved?: boolean;
  // Echoed back so the form keeps what was typed after an error.
  values?: Record<string, string>;
};

const clock = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use a time like 09:00");
const optionalDate = z
  .string()
  .trim()
  .refine((v) => v === "" || isIsoDate(v), "Pick a date");

const blockSchema = z.object({
  start_date: z.string().trim().refine(isIsoDate, "Pick a date"),
  end_date: optionalDate,
  all_day: z.boolean(),
  start_time: z.string(),
  end_time: z.string(),
  reason: z.string().trim().max(120, "Keep it under 120 characters"),
});

const MAX_DAYS = 366;

// Holidays, a day off, the van in for a service: time no one can book, for
// the whole business or one van or bay. Jobs already there are not moved, so
// the owner is told when one falls inside it.
export async function addBlockedTime(
  slug: string,
  _prev: BlockTimeState,
  formData: FormData,
): Promise<BlockTimeState> {
  const { tenant } = await requireTenant(slug);

  const text = (name: string) => {
    const v = formData.get(name);
    return typeof v === "string" ? v : "";
  };
  const values = {
    start_date: text("start_date"),
    end_date: text("end_date"),
    all_day: formData.get("all_day") === "on" ? "on" : "",
    start_time: text("start_time"),
    end_time: text("end_time"),
    reason: text("reason"),
    resource_id: text("resource_id"),
  };

  const parsed = blockSchema.safeParse({ ...values, all_day: values.all_day === "on" });
  const resourceId = values.resource_id || null;
  const errors: Record<string, string | undefined> = {};
  if (!parsed.success) {
    for (const [field, messages] of Object.entries(z.flattenError(parsed.error).fieldErrors)) {
      errors[field] = (messages as string[] | undefined)?.[0];
    }
  }
  if (parsed.success && !parsed.data.all_day) {
    for (const field of ["start_time", "end_time"] as const) {
      if (!clock.safeParse(parsed.data[field]).success) errors[field] = "Use a time like 09:00";
    }
  }
  if (Object.values(errors).some(Boolean) || !parsed.success) return { values, errors };
  const input = parsed.data;

  const endDate = input.end_date || input.start_date;
  if (endDate < input.start_date) return { values, errors: { end_date: "That's before the start date." } };

  const timeZone = await timezoneOf(tenant.id);
  const startsAt = zonedTimeToUtc(input.start_date, input.all_day ? "00:00" : input.start_time, timeZone);
  const endsAt = input.all_day
    ? zonedTimeToUtc(addDays(endDate, 1), "00:00", timeZone)
    : zonedTimeToUtc(endDate, input.end_time, timeZone);

  if (endsAt <= startsAt) return { values, errors: { end_time: "The end has to be after the start." } };
  if (endsAt.getTime() - startsAt.getTime() > MAX_DAYS * 86_400_000) {
    return { values, errors: { end_date: "That's more than a year. Block it in parts." } };
  }

  const supabase = await createClient();
  // For one van or bay: it has to be one of this business's.
  if (resourceId) {
    const found = z.uuid().safeParse(resourceId).success
      ? await supabase.from("resources").select("id").eq("tenant_id", tenant.id).eq("id", resourceId).maybeSingle()
      : null;
    if (!found?.data) return { values, errors: { resource_id: "Pick one of your vans or bays." } };
  }
  const { error } = await supabase.from("blocked_times").insert({
    tenant_id: tenant.id,
    starts_at: startsAt.toISOString(),
    ends_at: endsAt.toISOString(),
    reason: input.reason || null,
    resource_id: resourceId,
  });
  if (error) {
    console.error("Blocked time insert failed", error);
    return { values, message: "Couldn't save that. Try again." };
  }

  // Jobs already in this time stay where they are; say so rather than let the
  // owner assume they've gone.
  let clashQuery = supabase
    .from("bookings")
    .select("id, status, hold_expires_at")
    .eq("tenant_id", tenant.id)
    .in("status", ["held", "requested", "confirmed"])
    .lt("starts_at", endsAt.toISOString())
    .gt("ends_at", startsAt.toISOString());
  if (resourceId) clashQuery = clashQuery.eq("resource_id", resourceId);
  const { data: clashes } = await clashQuery;
  const now = Date.now();
  const live = (clashes ?? []).filter(
    (b) => b.status !== "held" || (b.hold_expires_at && new Date(b.hold_expires_at).getTime() > now),
  ).length;

  refresh();
  return {
    saved: true,
    message:
      live > 0
        ? `Blocked. ${live === 1 ? "A booking is" : `${live} bookings are`} already in this time and ${live === 1 ? "is" : "are"} still on your diary.`
        : undefined,
  };
}

export async function removeBlockedTime(slug: string, id: string): Promise<{ error?: string }> {
  const { tenant } = await requireTenant(slug);
  if (!z.uuid().safeParse(id).success) return { error: "That time off no longer exists." };

  const supabase = await createClient();
  const { error } = await supabase.from("blocked_times").delete().eq("tenant_id", tenant.id).eq("id", id);
  if (error) {
    console.error("Blocked time delete failed", error);
    return { error: "Couldn't remove it. Try again." };
  }
  refresh();
  return {};
}

// ------------------------------------------------------------- route planner

// Arrive this long before each job starts.
const ROUTE_MARGIN_MINS = 10;

export type RouteView = {
  home: string | null;
  source: DriveSource;
  marginMins: number;
  late: boolean;
  stops: { id: string; address: string; start: string; end: string; customer: string | null; service: string | null }[];
  legs: {
    fromId: string | null;
    toId: string | null;
    driveMins: number | null;
    leaveBy: string;
    arriveBy: string;
    spareMins: number | null;
  }[];
};

// One van's jobs on one day as a route, from its start postcode and back.
// Worked out when asked for, not on every diary load: each drive is a call
// to Google. The business comes from the URL's membership check.
export async function planRouteAction(
  slug: string,
  date: string,
  resourceId: string,
): Promise<{ route?: RouteView; message?: string }> {
  const { tenant, can } = await requireTenant(slug);
  if (!can("diary.view")) return { message: "Your access level doesn't include the diary." };
  if (!isIsoDate(date) || !z.uuid().safeParse(resourceId).success) return { message: "Pick a day and a van." };

  const supabase = await createClient();
  const settings = await supabase
    .from("booking_settings")
    .select("timezone, base_postcode")
    .eq("tenant_id", tenant.id)
    .maybeSingle();
  if (settings.error) throw settings.error;
  const timeZone = settings.data?.timezone ?? DEFAULT_TIMEZONE;
  const home = settings.data?.base_postcode ?? null;
  const range = diaryRange([date], timeZone);

  const { data, error } = await supabase
    .from("bookings")
    .select("id, status, starts_at, ends_at, hold_expires_at, address_line, postcode, customer:customers(name), service:services(name)")
    .eq("tenant_id", tenant.id)
    .eq("resource_id", resourceId)
    .in("status", ["held", "requested", "confirmed", "completed"])
    .lt("starts_at", range.end.toISOString())
    .gt("ends_at", range.start.toISOString())
    .order("starts_at");
  if (error) throw error;

  type Row = {
    id: string;
    status: string;
    starts_at: string;
    ends_at: string;
    hold_expires_at: string | null;
    address_line: string | null;
    postcode: string;
    customer: { name: string } | null;
    service: { name: string } | null;
  };
  const now = Date.now();
  const stops: RouteStop[] = (data as unknown as Row[])
    // A hold that's run out is an abandoned checkout, not a job.
    .filter((b) => b.status !== "held" || (b.hold_expires_at && new Date(b.hold_expires_at).getTime() > now))
    .map((b) => ({
      id: b.id,
      address: [b.address_line, b.postcode].filter(Boolean).join(", "),
      postcode: b.postcode,
      start: new Date(b.starts_at),
      end: new Date(b.ends_at),
      customer: b.customer?.name ?? null,
      service: b.service?.name ?? null,
    }));
  if (stops.length === 0) return { message: "Nothing booked for this van on this day." };

  try {
    const postcodes = new Map(stops.map((s) => [s.address, s.postcode]));
    if (home) postcodes.set(home, home);
    const plan = await planRoute({ home, stops, marginMins: ROUTE_MARGIN_MINS, driveMins: await driveTimes(postcodes) });
    return {
      route: {
        home,
        source: driveSource(),
        marginMins: ROUTE_MARGIN_MINS,
        late: plan.late,
        stops: plan.stops.map((s) => ({
          id: s.id,
          address: s.address,
          start: s.start.toISOString(),
          end: s.end.toISOString(),
          customer: s.customer,
          service: s.service,
        })),
        legs: plan.legs.map((l) => ({ ...l, leaveBy: l.leaveBy.toISOString(), arriveBy: l.arriveBy.toISOString() })),
      },
    };
  } catch (err) {
    console.error("Planning a route failed", err);
    return { message: "Couldn't work out the route just now. Try again in a minute." };
  }
}
