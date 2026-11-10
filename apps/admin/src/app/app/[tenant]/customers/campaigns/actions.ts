"use server";

import { refresh } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { sendCampaignBatch, sendCampaignTest } from "@leadgen/core/email/notify";
import { verifiedSender } from "@leadgen/core/email/senders-server";
import { createAdminClient } from "@leadgen/core/supabase/admin";
import type { SaveState } from "@/app/app/[tenant]/pricing/actions";
import { logActivity } from "@/lib/activity";
import { requireTenant } from "@/lib/auth";

// Marketing emails to customers who opted in. Owners and managers. Written
// with the secret key, so these checks are what stop anyone else.

const DENIED = "Your access level doesn't include sending campaigns.";

const schema = z.object({
  subject: z.string().trim().min(1, "Give it a subject.").max(150, "Keep the subject under 150 characters."),
  body: z.string().trim().min(1, "Write your message.").max(5000, "Keep the message under 5,000 characters."),
});

export async function saveCampaignAction(slug: string, formData: FormData): Promise<SaveState> {
  const { tenant, user, can } = await requireTenant(slug);
  if (!can("settings.edit")) return { message: DENIED };
  const parsed = schema.safeParse({ subject: formData.get("subject") ?? "", body: formData.get("body") ?? "" });
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) errors[String(issue.path[0])] ??= issue.message;
    return { errors };
  }
  const { error } = await createAdminClient().from("campaigns").insert({ tenant_id: tenant.id, created_by: user.id, ...parsed.data });
  if (error) {
    console.error("Saving a campaign failed", error);
    return { message: "Couldn't save it. Try again." };
  }
  await logActivity(tenant.id, "customer.campaign_saved", `Drafted the campaign ${parsed.data.subject}`);
  refresh();
  return { saved: true };
}

async function draft(tenantId: string, id: string) {
  if (!z.uuid().safeParse(id).success) return null;
  const { data, error } = await createAdminClient().from("campaigns").select("id, subject, body, status").eq("tenant_id", tenantId).eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

// To the person pressing the button, so they can see how it looks.
export async function testCampaignAction(slug: string, id: string): Promise<{ error?: string; sentTo?: string }> {
  const { tenant, user, can } = await requireTenant(slug);
  if (!can("settings.edit")) return { error: DENIED };
  const campaign = await draft(tenant.id, id);
  if (!campaign) return { error: "That campaign no longer exists." };
  if (!user.email) return { error: "Your login has no email address." };
  const result = await sendCampaignTest(tenant.id, campaign, user.email);
  return result.ok ? { sentTo: user.email } : { error: result.message };
}

export async function startCampaignAction(slug: string, id: string): Promise<{ error?: string }> {
  const { tenant, can } = await requireTenant(slug);
  if (!can("settings.edit")) return { error: DENIED };
  const campaign = await draft(tenant.id, id);
  if (!campaign) return { error: "That campaign no longer exists." };

  // Without a verified address every send would fail and the campaign would
  // finish having reached nobody, so it doesn't start.
  if (process.env.RESEND_API_KEY && !(await verifiedSender(tenant.id))) {
    return { error: "Set up your sending address under Settings → Notifications first." };
  }

  // Only a draft can start, so a double click doesn't start it twice.
  const { data, error } = await createAdminClient()
    .from("campaigns")
    .update({ status: "sending", started_at: new Date().toISOString() })
    .eq("tenant_id", tenant.id)
    .eq("id", id)
    .eq("status", "draft")
    .select("id");
  if (error) {
    console.error("Starting a campaign failed", error);
    return { error: "Couldn't start it. Try again." };
  }
  if (!data.length) return { error: "This campaign has already been sent." };

  // The first batch goes now; the scheduled job sends the rest.
  after(() => sendCampaignBatch(id));
  await logActivity(tenant.id, "customer.campaign_sent", `Sent the campaign ${campaign.subject}`);
  refresh();
  return {};
}

export async function deleteCampaignAction(slug: string, id: string): Promise<{ error?: string }> {
  const { tenant, can } = await requireTenant(slug);
  if (!can("settings.edit")) return { error: DENIED };
  if (!z.uuid().safeParse(id).success) return {};
  const { error } = await createAdminClient().from("campaigns").delete().eq("tenant_id", tenant.id).eq("id", id).eq("status", "draft");
  if (error) {
    console.error("Deleting a campaign failed", error);
    return { error: "Couldn't delete it. Try again." };
  }
  refresh();
  return {};
}
