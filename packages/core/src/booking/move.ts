import "server-only";
import { z } from "zod";
import { syncBookingEvent } from "../calendar/sync";
import { notifyBookingMoved } from "../email/notify";
import { createAdminClient } from "../supabase/admin";
import { canMoveJob } from "./diary";
import { isIsoDate, zonedTimeToUtc } from "./time";

// The business moving a job in the diary: a new time, a new van or bay, or
// both. As with adding a booking by hand, the owner is trusted with the time
// (outside opening hours or in time off is their call), but never on top of
// another job on the same van. It doesn't use up the customer's own moves.
// The caller has already checked this person may manage bookings.

const requestSchema = z.object({
  date: z.string().refine(isIsoDate),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  resourceId: z.uuid(),
  // Email the customer the new time. Ignored for a time already gone.
  notify: z.boolean(),
});

export type MoveRequest = z.infer<typeof requestSchema>;

const CHANGED = "This job has changed since you opened it. Reload the diary.";

export async function moveBooking(tenantId: string, bookingId: string, input: MoveRequest): Promise<{ error?: string }> {
  const request = requestSchema.safeParse(input);
  if (!request.success || !z.uuid().safeParse(bookingId).success) return { error: "Pick a date and a time." };
  const { date, time, resourceId, notify } = request.data;

  const db = createAdminClient();
  const [bookingResult, resourceResult, settingsResult] = await Promise.all([
    db
      .from("bookings")
      .select("status, starts_at, ends_at, location_type, resource_id")
      .eq("tenant_id", tenantId)
      .eq("id", bookingId)
      .maybeSingle(),
    db.from("resources").select("id, name, active, location_types").eq("tenant_id", tenantId).eq("id", resourceId).maybeSingle(),
    db.from("booking_settings").select("timezone").eq("tenant_id", tenantId).maybeSingle(),
  ]);
  const readError = bookingResult.error ?? resourceResult.error ?? settingsResult.error;
  if (readError) {
    console.error("Reading a booking to move failed", readError);
    return { error: "Couldn't load the job. Try again." };
  }

  const booking = bookingResult.data;
  const resource = resourceResult.data;
  if (!booking) return { error: "That booking no longer exists." };
  if (!canMoveJob(booking.status)) return { error: "Only confirmed jobs and requests can be moved." };
  if (!resource || (!resource.active && resource.id !== booking.resource_id)) return { error: "Pick one of your vans or bays." };
  if (!(resource.location_types as string[]).includes(booking.location_type)) {
    return {
      error: booking.location_type === "unit" ? `${resource.name} doesn't take jobs at your unit.` : `${resource.name} doesn't do mobile jobs.`,
    };
  }

  const was = new Date(booking.starts_at);
  const start = zonedTimeToUtc(date, time, settingsResult.data?.timezone ?? "Europe/London");
  const end = new Date(start.getTime() + (new Date(booking.ends_at).getTime() - was.getTime()));
  const timeChanged = start.getTime() !== was.getTime();
  if (!timeChanged && resourceId === booking.resource_id) return {};

  const { data, error } = await db
    .from("bookings")
    .update({
      starts_at: start.toISOString(),
      ends_at: end.toISOString(),
      resource_id: resourceId,
      // Stamped so the reminder goes out again for the new time.
      ...(timeChanged && { rescheduled_at: new Date().toISOString(), rescheduled_from: booking.starts_at }),
    })
    .eq("tenant_id", tenantId)
    .eq("id", bookingId)
    .eq("status", booking.status)
    .eq("starts_at", booking.starts_at)
    .eq("resource_id", booking.resource_id)
    .select("id");
  if (error) {
    // 23P01: another live job on this van or bay overlaps the new time.
    if (error.code === "23P01") return { error: `${resource.name} already has a job in that time.` };
    console.error("Moving a booking failed", error);
    return { error: "Couldn't move the job. Try again." };
  }
  if (!data.length) return { error: CHANGED };

  if (notify && timeChanged && start.getTime() > Date.now()) await notifyBookingMoved(tenantId, bookingId, { from: booking.starts_at });
  await syncBookingEvent(tenantId, bookingId);
  return {};
}
