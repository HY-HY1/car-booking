import "server-only";
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { bookingChanged } from "./changed";
import { emailDepositRequest, notifyBookingSecured } from "../email/notify";
import { createAdminClient } from "../supabase/admin";
import { resourcesFor } from "./config";
import { getBookingConfig, type EngineResult } from "./engine";
import { repeatDates } from "./edit-rules";
import type { ManualBooking } from "./manual-rules";
import { settleManualPrice } from "./manual-rules";
import { getQuote, QuoteError } from "./pricing";
import { zonedTimeToUtc } from "./time";

// A booking the business adds itself: a phone booking, a regular, a walk-in.
// Called by the dashboard after its permission check, so it writes with the
// secret key. The owner is trusted with the time: it can be outside opening
// hours or in time off, but never on top of another job on the same van or
// bay (the database's no-overlap constraint).

function fail(code: string, message: string) {
  return { ok: false as const, code, message };
}

// The customer it's for: the one picked, else a match on email then phone,
// else a new one. Gaps are filled; nothing the business recorded is changed.
async function customerFor(db: SupabaseClient, tenantId: string, m: ManualBooking): Promise<string | null> {
  const columns = "id, email, phone, address_line, postcode";
  let existing: { id: string; email: string | null; phone: string | null; address_line: string | null; postcode: string | null } | null = null;
  if (m.customerId) {
    const { data, error } = await db.from("customers").select(columns).eq("tenant_id", tenantId).eq("id", m.customerId).maybeSingle();
    if (error) throw error;
    if (!data) return null;
    existing = data;
  }
  for (const [column, value] of [
    ["email", m.contact.email],
    ["phone", m.contact.phone],
  ] as const) {
    if (existing || !value) continue;
    const { data, error } = await db.from("customers").select(columns).eq("tenant_id", tenantId).eq(column, value).maybeSingle();
    if (error) throw error;
    existing = data;
  }

  if (existing) {
    const patch: Record<string, string> = {};
    if (!existing.email && m.contact.email) patch.email = m.contact.email;
    if (!existing.phone && m.contact.phone) patch.phone = m.contact.phone;
    if (!existing.address_line && m.addressLine) patch.address_line = m.addressLine;
    if (!existing.postcode && m.postcode) patch.postcode = m.postcode;
    if (Object.keys(patch).length) {
      const { error } = await db.from("customers").update(patch).eq("tenant_id", tenantId).eq("id", existing.id);
      // 23505: that email or phone is another customer's; keep both.
      if (error && error.code !== "23505") throw error;
    }
    return existing.id;
  }

  const { data, error } = await db
    .from("customers")
    .insert({
      tenant_id: tenantId,
      name: m.contact.name,
      email: m.contact.email,
      phone: m.contact.phone,
      address_line: m.addressLine,
      postcode: m.postcode,
      source: "manual",
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

// The first booking, then each repeat. A repeat that clashes is skipped and
// listed, rather than losing the rest; only the first emails the customer
// or asks for a deposit, and the repeats are for the customer the first found.
export async function createManualBooking(
  tenantId: string,
  m: ManualBooking,
): Promise<EngineResult<{ bookingId: string; depositEmailed: boolean | null; repeatsMade: number; repeatsSkipped: string[] }>> {
  const seriesId = m.repeat ? randomUUID() : null;
  const first = await createOne(tenantId, m, seriesId);
  if (!first.ok) return first;

  let repeatsMade = 0;
  const repeatsSkipped: string[] = [];
  if (m.repeat) {
    for (const date of repeatDates(m.date, m.repeat.everyWeeks, m.repeat.times)) {
      const repeat = await createOne(
        tenantId,
        { ...m, date, customerId: first.customerId, leadId: null, depositPence: 0, sendConfirmation: false, requestDeposit: false },
        seriesId,
      );
      if (repeat.ok) repeatsMade += 1;
      else repeatsSkipped.push(date);
    }
  }
  if (m.leadId) {
    const { error } = await createAdminClient().from("leads").update({ status: "booked" }).eq("tenant_id", tenantId).eq("id", m.leadId);
    if (error) console.error("Marking the lead booked failed", error);
  }
  return { ok: true, bookingId: first.bookingId, depositEmailed: first.depositEmailed, repeatsMade, repeatsSkipped };
}

async function createOne(
  tenantId: string,
  m: ManualBooking,
  seriesId: string | null,
): Promise<EngineResult<{ bookingId: string; customerId: string; depositEmailed: boolean | null }>> {
  const config = await getBookingConfig(tenantId);
  if (!config) return fail("not_set_up", "Set up booking under Settings → Hours & rules first.");
  const { settings } = config;

  const service = config.services.find((s) => s.id === m.serviceId);
  if (!service) return fail("unknown_service", "That service isn't available any more. Pick another.");
  let quote;
  try {
    quote = getQuote({
      service,
      addOns: config.addOns,
      addOnIds: m.addOnIds,
      sizeClass: m.sizeClass,
      conditionKey: m.conditionKey,
      locationType: m.locationType,
      // The business can take a job at its shop or at an address even if
      // customers can't currently book that themselves.
      settings: { ...settings, offers_mobile: true, offers_unit: true },
    });
  } catch (error) {
    if (error instanceof QuoteError) return fail(error.code, error.message);
    throw error;
  }
  const price = settleManualPrice(quote, settings.deposit, m);

  const postcode = m.locationType === "unit" ? settings.unit_postcode : m.postcode;
  if (!postcode) return fail("postcode_required", "Add your shop's postcode under Settings → Hours & rules to book jobs there.");

  // The van or bay picked, or each that does this kind of job in turn.
  const suitable = resourcesFor(config.resources, m.locationType);
  const candidates = m.resourceId ? suitable.filter((r) => r.id === m.resourceId) : suitable;
  if (candidates.length === 0) {
    return fail(
      "no_resource",
      m.resourceId ? "That van or bay doesn't take this kind of job." : "None of your vans or bays take this kind of job.",
    );
  }

  const startsAt = zonedTimeToUtc(m.date, m.time, settings.timezone);
  const db = createAdminClient();
  const customerId = await customerFor(db, tenantId, m);
  if (!customerId) return fail("unknown_customer", "That customer wasn't found. Enter their details again.");

  const vehicle = await db
    .from("vehicles")
    .insert({
      tenant_id: tenantId,
      customer_id: customerId,
      size_class: m.sizeClass,
      make: m.vehicle.make,
      model: m.vehicle.model,
      registration: m.vehicle.registration,
    })
    .select("id")
    .single();
  if (vehicle.error) throw vehicle.error;

  const row = {
    tenant_id: tenantId,
    customer_id: customerId,
    vehicle_id: vehicle.data.id,
    service_id: service.id,
    starts_at: startsAt.toISOString(),
    ends_at: new Date(startsAt.getTime() + price.durationMins * 60_000).toISOString(),
    status: "confirmed",
    location_type: m.locationType,
    address_line: m.locationType === "mobile" ? m.addressLine : settings.unit_address,
    postcode,
    customer_notes: m.notes,
    quote_snapshot: {
      ...quote,
      lines: price.lines,
      total_pence: price.totalPence,
      deposit_pence: price.depositPence,
      duration_mins: price.durationMins,
      // Priced by the business, so nothing is left to inspect.
      needs_inspection: false,
      postcode,
      answers: { vehicle: m.vehicle, notes: m.notes ?? undefined },
    },
    price_pence: price.totalPence,
    deposit_pence: price.depositPence,
    deposit_status: price.depositPence > 0 ? "pending" : "none",
    source: "manual",
    // Only sent when used.
    ...(m.staffId && { staff_id: m.staffId }),
    ...(m.leadId && { lead_id: m.leadId }),
    ...(seriesId && { series_id: seriesId }),
  };

  // 23P01: that van or bay already has a job then; try the next.
  let bookingId: string | null = null;
  for (const resource of candidates) {
    const inserted = await db
      .from("bookings")
      .insert({ ...row, resource_id: resource.id })
      .select("id")
      .single();
    if (inserted.error?.code === "23P01") continue;
    if (inserted.error) throw inserted.error;
    bookingId = inserted.data.id;
    break;
  }
  if (!bookingId) {
    const cleanup = await db.from("vehicles").delete().eq("tenant_id", tenantId).eq("id", vehicle.data.id);
    if (cleanup.error) console.error("Removing the vehicle of a booking that wasn't made failed", cleanup.error);
    return fail(
      "slot_taken",
      candidates.length === 1
        ? "There's already a job then on that van or bay. Pick another time, or another van."
        : "Every van and bay that takes this kind of job is busy then. Pick another time.",
    );
  }

  await bookingChanged(tenantId, bookingId);
  if (m.sendConfirmation) await notifyBookingSecured(tenantId, bookingId, { alertOwner: false });
  const depositEmailed = m.requestDeposit && price.depositPence > 0 ? (await emailDepositRequest(tenantId, bookingId)).ok : null;
  return { ok: true, bookingId, customerId, depositEmailed };
}
