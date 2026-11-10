"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { addExtraCar, editBooking, removeExtraCar } from "@leadgen/core/booking/edit";
import { editBookingFormSchema, extraCarFormSchema, extraCarLabel } from "@leadgen/core/booking/edit-rules";
import type { SaveState } from "@/app/app/[tenant]/pricing/actions";
import { logActivity } from "@/lib/activity";
import { requireTenant } from "@/lib/auth";

// Changing a booking after it's made: for whoever manages bookings. The
// business is the one from the URL's membership check, never the form.

function plain(formData: FormData) {
  const values: Record<string, string> = {};
  for (const [key, value] of formData) if (typeof value === "string") values[key] = value;
  return values;
}

function fieldErrors(error: z.ZodError): SaveState {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) errors[String(issue.path[0] ?? "form")] ??= issue.message;
  return { errors, message: errors.form };
}

const DENIED = { message: "Your access level doesn't include changing bookings." };

export async function editBookingAction(slug: string, bookingId: string, formData: FormData): Promise<SaveState> {
  const { tenant, can } = await requireTenant(slug);
  if (!can("bookings.manage")) return DENIED;
  if (!z.uuid().safeParse(bookingId).success) return { message: "That booking no longer exists." };

  // Disabled inputs aren't sent, and these are replaced by the price list then.
  const input = plain(formData);
  const parsed = editBookingFormSchema.safeParse({ price: "0", duration_mins: "15", ...input });
  if (!parsed.success) return fieldErrors(parsed.error);

  try {
    const result = await editBooking(tenant.id, bookingId, parsed.data);
    if (result.error) return result.field ? { errors: { [result.field]: result.error }, message: result.error } : { message: result.error };
  } catch (error) {
    console.error("Changing a booking failed", error);
    return { message: "Couldn't save the changes. Try again." };
  }
  await logActivity(tenant.id, "booking.edited", "Changed a booking", { type: "booking", id: bookingId });
  refresh();
  return { saved: true };
}

export async function addExtraCarAction(slug: string, bookingId: string, formData: FormData): Promise<SaveState> {
  const { tenant, can } = await requireTenant(slug);
  if (!can("bookings.manage")) return DENIED;
  if (!z.uuid().safeParse(bookingId).success) return { message: "That booking no longer exists." };
  const parsed = extraCarFormSchema.safeParse(plain(formData));
  if (!parsed.success) return fieldErrors(parsed.error);

  try {
    const result = await addExtraCar(tenant.id, bookingId, parsed.data);
    if (result.error) return { message: result.error };
  } catch (error) {
    console.error("Adding a car failed", error);
    return { message: "Couldn't add the car. Try again." };
  }
  await logActivity(tenant.id, "booking.car_added", `Added a car to a booking: ${extraCarLabel(parsed.data).replace("Extra car: ", "")}`, { type: "booking", id: bookingId });
  refresh();
  return { saved: true };
}

export async function removeExtraCarAction(slug: string, bookingId: string, carId: string): Promise<{ error?: string }> {
  const { tenant, can } = await requireTenant(slug);
  if (!can("bookings.manage")) return { error: DENIED.message };
  if (!z.uuid().safeParse(bookingId).success || !z.uuid().safeParse(carId).success) return { error: "That car is no longer on this booking." };
  try {
    const result = await removeExtraCar(tenant.id, bookingId, carId);
    if (result.error) return result;
  } catch (error) {
    console.error("Removing a car failed", error);
    return { error: "Couldn't remove the car. Try again." };
  }
  await logActivity(tenant.id, "booking.car_removed", "Removed a car from a booking", { type: "booking", id: bookingId });
  refresh();
  return {};
}
