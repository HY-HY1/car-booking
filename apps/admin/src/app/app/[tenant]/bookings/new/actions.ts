"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createManualBooking } from "@leadgen/core/booking/manual";
import { manualBookingFormSchema } from "@leadgen/core/booking/manual-rules";
import { requireTenant } from "@/lib/auth";
import { appUrl } from "@/lib/urls";

export type NewBookingState = {
  errors?: Record<string, string | undefined>;
  message?: string;
};

// "Add booking": a phone booking, a regular or a walk-in, straight into the
// diary as confirmed. For whoever manages bookings; the business is the one
// from the URL's membership check, never the form.
export async function createBookingAction(slug: string, _prev: NewBookingState, formData: FormData): Promise<NewBookingState> {
  const { tenant, can } = await requireTenant(slug);
  if (!can("bookings.manage")) return { message: "Your access level doesn't include adding bookings." };

  const input = Object.fromEntries([...formData.entries()].filter((e): e is [string, string] => typeof e[1] === "string"));
  const parsed = manualBookingFormSchema.safeParse(input);
  if (!parsed.success) {
    const errors: Record<string, string | undefined> = {};
    for (const [field, messages] of Object.entries(z.flattenError(parsed.error).fieldErrors)) {
      errors[field] = (messages as string[] | undefined)?.[0];
    }
    return { errors, message: "Check the highlighted fields." };
  }

  let result;
  try {
    result = await createManualBooking(tenant.id, parsed.data);
  } catch (error) {
    console.error("Adding a booking failed", error);
    return { message: "Couldn't add the booking. Try again." };
  }
  if (!result.ok) {
    const field = result.code === "slot_taken" || result.code === "no_resource" ? "time" : undefined;
    return field ? { errors: { [field]: result.message }, message: result.message } : { message: result.message };
  }

  // Back to the diary on that day, with the new job open.
  const deposit = result.depositEmailed === false ? "&deposit=failed" : "";
  redirect(appUrl(`/${slug}/diary?view=day&date=${parsed.data.date}&job=${result.bookingId}${deposit}`));
}
