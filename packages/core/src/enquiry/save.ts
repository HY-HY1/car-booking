import "server-only";
import { formatPhone } from "../customer-fields";
import { createAdminClient } from "../supabase/admin";
import { sendLeadWebhook } from "../webhooks/deliver";
import { enquiryAnswers, enquirySchema } from "./rules";

// Saves an enquiry from the booking site: the customer (the same one if
// their email is known) and a new lead with their answers, which shows
// under Leads and sends the owner the usual new-lead email. Never opts
// anyone in to marketing: the form doesn't ask.

export type EnquiryResult = { ok: true; leadId: string } | { ok: false; errors?: Record<string, string>; message?: string };

export async function saveEnquiry(tenantId: string, input: unknown): Promise<EnquiryResult> {
  const parsed = enquirySchema.safeParse(input);
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      errors[key] ??= issue.message;
    }
    return { ok: false, errors };
  }
  const e = parsed.data;
  const db = createAdminClient();

  // The customer: known by email, with any gaps filled; otherwise new. A
  // phone number typed into a public form proves nothing, so one already on
  // another customer's record isn't copied over (one customer per number),
  // and the owner gets a note to merge them if they're the same person.
  let customerId: string;
  const known = await db.from("customers").select("id, phone, postcode").eq("tenant_id", tenantId).eq("email", e.email).maybeSingle();
  if (known.error) throw known.error;
  if (known.data) {
    customerId = known.data.id;
    const patch: Record<string, string> = {};
    if (!known.data.phone && e.phone) patch.phone = e.phone;
    if (!known.data.postcode && e.postcode) patch.postcode = e.postcode;
    if (Object.keys(patch).length) {
      const { error } = await db.from("customers").update(patch).eq("tenant_id", tenantId).eq("id", customerId);
      // 23505: the phone belongs to another customer; keep both.
      if (error && error.code !== "23505") throw error;
    }
  } else {
    const taken = e.phone
      ? await db.from("customers").select("name").eq("tenant_id", tenantId).eq("phone", e.phone).maybeSingle()
      : { data: null, error: null };
    if (taken.error) throw taken.error;
    const insert = async () =>
      db
        .from("customers")
        .insert({
          tenant_id: tenantId,
          name: e.name,
          email: e.email,
          phone: taken.data ? null : e.phone,
          postcode: e.postcode,
          notes: taken.data
            ? `Sent an enquiry with phone ${formatPhone(e.phone!)}, which is already on ${taken.data.name}'s record. If they're the same person, merge them.`
            : null,
          source: "booking_page",
        })
        .select("id")
        .single();
    const created = await insert();
    if (!created.error) customerId = created.data.id;
    // Added by a parallel request between the lookup and the insert.
    else if (created.error.code === "23505") {
      const again = await db.from("customers").select("id").eq("tenant_id", tenantId).eq("email", e.email).maybeSingle();
      if (again.error) throw again.error;
      if (!again.data) throw created.error;
      customerId = again.data.id;
    } else throw created.error;
  }

  const { data, error } = await db
    .from("leads")
    .insert({
      tenant_id: tenantId,
      customer_id: customerId,
      status: "new",
      source: "enquiry_form",
      form_answers: { form: "Enquiry form", answers: enquiryAnswers(e) },
    })
    .select("id")
    .single();
  if (error) throw error;
  await sendLeadWebhook(tenantId, data.id);
  return { ok: true, leadId: data.id };
}
