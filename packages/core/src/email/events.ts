import "server-only";
import { unsubscribeCustomer } from "../privacy/data";
import { createAdminClient } from "../supabase/admin";
import type { ResendEvent } from "./webhook-rules";

// What happened to an email after Resend accepted it, from its webhook
// (/api/webhooks/resend). The email is found in email_log by Resend's id;
// emails we don't log (password resets, platform alerts) are ignored.
//
// - A permanent bounce marks the log row and the customer's address
//   (email_bounced_at), so notify.ts stops sending to it until it's changed.
// - A transient bounce is noted on the row; the email still counts as sent.
// - A spam complaint marks the row and opts the customer out of marketing,
//   which is what they've told their mail app they want.
export async function handleResendEvent(event: ResendEvent) {
  const db = createAdminClient();
  const { data: row, error } = await db
    .from("email_log")
    .select("id, tenant_id, customer_id, audience")
    .eq("provider_id", event.emailId)
    .maybeSingle();
  if (error) throw error;
  if (!row) return;

  if (event.kind === "bounced" && !event.permanent) {
    const noted = await db.from("email_log").update({ error: `Delayed: ${event.reason}`.slice(0, 500) }).eq("id", row.id);
    if (noted.error) throw noted.error;
    return;
  }

  const update =
    event.kind === "bounced"
      ? { status: "bounced", error: `Bounced: ${event.reason}`.slice(0, 500) }
      : { status: "complained", error: "The reader marked this email as spam." };
  const marked = await db.from("email_log").update(update).eq("id", row.id);
  if (marked.error) throw marked.error;
  if (row.audience !== "customer" || !row.customer_id) return;

  if (event.kind === "bounced") {
    // Only while the customer still has the address that bounced.
    let query = db
      .from("customers")
      .update({ email_bounced_at: new Date().toISOString() })
      .eq("tenant_id", row.tenant_id)
      .eq("id", row.customer_id);
    if (event.to) query = query.ilike("email", event.to.replace(/[%_\\]/g, (c) => `\\${c}`));
    const flagged = await query;
    if (flagged.error) throw flagged.error;
  } else {
    await unsubscribeCustomer(row.tenant_id, row.customer_id, "email");
  }
}
