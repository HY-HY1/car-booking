import "server-only";
import { bookingChanged } from "./changed";
import { createAdminClient } from "../supabase/admin";
import { getBookingConfig, travelMilesFor } from "./engine";
import { canEditBooking, editedPostcode, extraCarLabel, type EditBooking } from "./edit-rules";
import { settleManualPrice } from "./manual-rules";
import { getQuote, QuoteError, type Quote, type QuoteLine } from "./pricing";

// The business changing a job after it's made: what's being done, the price,
// the address, the van and who's doing it. Called by the dashboard after its
// permission check, so it writes with the secret key. The customer isn't
// emailed: a new price is something to tell them in person. Never on top of
// another job on the same van (the database's no-overlap constraint).

const CHANGED = "This booking has changed since you opened it. Reload the page.";

type Snapshot = (Record<string, unknown> & { condition_key?: string | null; lines?: QuoteLine[]; total_pence?: number; duration_mins?: number }) | null;

export async function editBooking(tenantId: string, bookingId: string, input: EditBooking): Promise<{ error?: string; field?: string }> {
  const config = await getBookingConfig(tenantId);
  if (!config) return { error: "Set up booking under Settings → Hours & rules first." };
  const { settings } = config;

  const db = createAdminClient();
  const [bookingResult, extrasResult, resourceResult, staffResult] = await Promise.all([
    db
      .from("bookings")
      .select("status, starts_at, ends_at, location_type, postcode, resource_id, staff_id, vehicle_id, deposit_pence, deposit_status, quote_snapshot")
      .eq("tenant_id", tenantId)
      .eq("id", bookingId)
      .maybeSingle(),
    db.from("booking_vehicles").select("make, model, registration, price_pence, extra_mins").eq("tenant_id", tenantId).eq("booking_id", bookingId),
    db.from("resources").select("id, name, active, location_types").eq("tenant_id", tenantId).eq("id", input.resourceId).maybeSingle(),
    input.staffId ? db.from("staff").select("id, active").eq("tenant_id", tenantId).eq("id", input.staffId).maybeSingle() : null,
  ]);
  for (const r of [bookingResult, extrasResult, resourceResult, staffResult]) if (r?.error) throw r.error;

  const booking = bookingResult.data;
  if (!booking) return { error: "That booking no longer exists." };
  if (!canEditBooking(booking.status)) return { error: "Only confirmed jobs and requests can be changed." };

  const resource = resourceResult.data;
  if (!resource || (!resource.active && resource.id !== booking.resource_id)) return { error: "Pick one of your vans or bays.", field: "resource_id" };
  if (!(resource.location_types as string[]).includes(booking.location_type)) {
    return { error: `${resource.name} doesn't do this kind of job.`, field: "resource_id" };
  }
  if (input.staffId && (!staffResult?.data || (!staffResult.data.active && input.staffId !== booking.staff_id))) {
    return { error: "Pick someone from the list.", field: "staff_id" };
  }

  const postcode = editedPostcode(booking.location_type, input.postcode, booking.postcode);
  if (!postcode) return { error: "Enter the full postcode where the car will be, like BS1 4DJ.", field: "postcode" };

  const service = config.services.find((s) => s.id === input.serviceId);
  if (!service) return { error: "That service isn't available any more. Pick another.", field: "service_id" };

  const snapshot = booking.quote_snapshot as Snapshot;
  const tier = settings.condition_tiers.find((t) => t.key === snapshot?.condition_key);
  let quote: Quote;
  try {
    quote = getQuote({
      service,
      addOns: config.addOns,
      addOnIds: input.addOnIds,
      sizeClass: input.sizeClass,
      conditionKey: tier?.key ?? null,
      locationType: booking.location_type,
      // Only worth looking up when the price list is deciding the price.
      travelMiles: input.pricePence === null && booking.location_type === "mobile" ? await travelMilesFor(settings, postcode) : null,
      // As when adding by hand, whatever customers can currently book.
      settings: { ...settings, offers_mobile: true, offers_unit: true },
    });
  } catch (error) {
    if (error instanceof QuoteError) return { error: error.message };
    throw error;
  }

  const extras = extrasResult.data ?? [];
  const withExtras: Quote = {
    ...quote,
    lines: [...quote.lines, ...extras.map((c) => ({ label: extraCarLabel(c), amount_pence: c.price_pence }))],
    total_pence: quote.total_pence + extras.reduce((sum, c) => sum + c.price_pence, 0),
    duration_mins: quote.duration_mins + extras.reduce((sum, c) => sum + c.extra_mins, 0),
  };
  const price = settleManualPrice(withExtras, settings.deposit, {
    pricePence: input.pricePence,
    durationMins: input.durationMins,
    depositPence: booking.deposit_pence,
  });

  const { data, error } = await db
    .from("bookings")
    .update({
      service_id: service.id,
      resource_id: resource.id,
      staff_id: input.staffId,
      ends_at: new Date(new Date(booking.starts_at).getTime() + price.durationMins * 60_000).toISOString(),
      address_line: booking.location_type === "mobile" ? input.addressLine : undefined,
      postcode,
      price_pence: price.totalPence,
      // Money already taken or refunded isn't rewritten by changing the job.
      ...(booking.deposit_status === "pending" && { deposit_pence: price.depositPence }),
      quote_snapshot: {
        ...snapshot,
        service_id: service.id,
        service_name: service.name,
        size_class: input.sizeClass,
        add_on_ids: input.addOnIds,
        lines: price.lines,
        total_pence: price.totalPence,
        duration_mins: price.durationMins,
        postcode,
      },
    })
    .eq("tenant_id", tenantId)
    .eq("id", bookingId)
    .eq("status", booking.status)
    .eq("starts_at", booking.starts_at)
    .select("id");
  if (error) {
    // 23P01: longer or on another van, it now runs into a job there.
    if (error.code === "23P01") return { error: `${resource.name} already has a job in that time.`, field: "resource_id" };
    throw error;
  }
  if (!data.length) return { error: CHANGED };

  if (booking.vehicle_id) {
    const size = await db.from("vehicles").update({ size_class: input.sizeClass }).eq("tenant_id", tenantId).eq("id", booking.vehicle_id);
    if (size.error) console.error("Updating the vehicle size failed", size.error);
  }
  await bookingChanged(tenantId, bookingId);
  return {};
}

// ---------------------------------------------------------------- extra cars

type Car = { make: string | null; model: string | null; registration: string | null; size_class: string | null; price: number; extra_mins: number };

async function loadForCars(tenantId: string, bookingId: string) {
  const { data, error } = await createAdminClient()
    .from("bookings")
    .select("status, starts_at, ends_at, price_pence, quote_snapshot")
    .eq("tenant_id", tenantId)
    .eq("id", bookingId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// The booking grows by the car's price and time, and the bill gets a line.
export async function addExtraCar(tenantId: string, bookingId: string, car: Car): Promise<{ error?: string }> {
  const booking = await loadForCars(tenantId, bookingId);
  if (!booking) return { error: "That booking no longer exists." };
  if (!canEditBooking(booking.status)) return { error: "Only confirmed jobs and requests can be changed." };

  const snapshot = booking.quote_snapshot as Snapshot;
  const total = booking.price_pence + car.price;
  const db = createAdminClient();
  const { data, error } = await db
    .from("bookings")
    .update({
      price_pence: total,
      ends_at: new Date(new Date(booking.ends_at).getTime() + car.extra_mins * 60_000).toISOString(),
      quote_snapshot: {
        ...snapshot,
        lines: [...(snapshot?.lines ?? []), { label: extraCarLabel(car), amount_pence: car.price }],
        total_pence: total,
        duration_mins: (snapshot?.duration_mins ?? 0) + car.extra_mins,
      },
    })
    .eq("tenant_id", tenantId)
    .eq("id", bookingId)
    .eq("ends_at", booking.ends_at)
    .select("id");
  if (error) {
    if (error.code === "23P01") return { error: "The extra time runs into the next job on that van. Move one of them first." };
    throw error;
  }
  if (!data.length) return { error: CHANGED };

  const inserted = await db.from("booking_vehicles").insert({
    tenant_id: tenantId,
    booking_id: bookingId,
    make: car.make,
    model: car.model,
    registration: car.registration,
    size_class: car.size_class,
    price_pence: car.price,
    extra_mins: car.extra_mins,
  });
  if (inserted.error) throw inserted.error;
  await bookingChanged(tenantId, bookingId);
  return {};
}

export async function removeExtraCar(tenantId: string, bookingId: string, carId: string): Promise<{ error?: string }> {
  const db = createAdminClient();
  const [booking, carResult] = await Promise.all([
    loadForCars(tenantId, bookingId),
    db.from("booking_vehicles").select("make, model, registration, price_pence, extra_mins").eq("tenant_id", tenantId).eq("booking_id", bookingId).eq("id", carId).maybeSingle(),
  ]);
  if (carResult.error) throw carResult.error;
  const car = carResult.data;
  if (!booking || !car) return { error: "That car is no longer on this booking." };
  if (!canEditBooking(booking.status)) return { error: "Only confirmed jobs and requests can be changed." };

  const snapshot = booking.quote_snapshot as Snapshot;
  const label = extraCarLabel(car);
  const lines = [...(snapshot?.lines ?? [])];
  const at = lines.findIndex((l) => l.label === label && l.amount_pence === car.price_pence);
  if (at >= 0) lines.splice(at, 1);
  const total = Math.max(booking.price_pence - car.price_pence, 0);

  const removed = await db.from("booking_vehicles").delete().eq("tenant_id", tenantId).eq("id", carId);
  if (removed.error) throw removed.error;
  const { error } = await db
    .from("bookings")
    .update({
      price_pence: total,
      ends_at: new Date(new Date(booking.ends_at).getTime() - car.extra_mins * 60_000).toISOString(),
      quote_snapshot: { ...snapshot, lines, total_pence: total, duration_mins: Math.max((snapshot?.duration_mins ?? 0) - car.extra_mins, 0) },
    })
    .eq("tenant_id", tenantId)
    .eq("id", bookingId);
  if (error) throw error;
  await bookingChanged(tenantId, bookingId);
  return {};
}

// ---------------------------------------------------------------- repeats

// Cancels this booking's repeats that are still to come, this one included if
// it hasn't happened. One email per cancelled visit would be a lot of email,
// so the customer isn't sent any: the screen says to let them know.
export async function cancelFutureRepeats(tenantId: string, seriesId: string, reason: string | null) {
  const db = createAdminClient();
  const { data, error } = await db
    .from("bookings")
    .update({ status: "cancelled", cancelled_by: "business", cancel_reason: reason })
    .eq("tenant_id", tenantId)
    .eq("series_id", seriesId)
    .eq("status", "confirmed")
    .gt("starts_at", new Date().toISOString())
    .select("id");
  if (error) throw error;
  for (const row of data) await bookingChanged(tenantId, row.id);
  return data.length;
}
