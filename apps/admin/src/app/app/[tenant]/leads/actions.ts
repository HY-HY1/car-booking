"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { isLostReason, LOST_REASONS } from "@leadgen/core/leads/rules";
import { logActivity } from "@/lib/activity";
import { requireAccess } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

// Working a lead. For the office and up; the business is the one from the
// URL's membership check, and RLS enforces the same.

const COULD_NOT = "Couldn't save that. Try again.";

async function update(slug: string, id: string, patch: Record<string, unknown>, onlyOpen = false) {
  const { tenant } = await requireAccess(slug, "leads.view");
  if (!z.uuid().safeParse(id).success) return { tenant, error: "That lead no longer exists." };
  const supabase = await createClient();
  let query = supabase.from("leads").update(patch).eq("tenant_id", tenant.id).eq("id", id);
  if (onlyOpen) query = query.in("status", ["new", "quoted"]);
  const { data, error } = await query.select("id");
  if (error) {
    console.error("Updating a lead failed", error);
    return { tenant, error: COULD_NOT };
  }
  return { tenant, error: data.length ? undefined : "That lead has changed. Reload the page." };
}

export async function saveLeadNotesAction(slug: string, id: string, notes: string): Promise<{ error?: string }> {
  const { tenant, error } = await update(slug, id, { notes: notes.trim().slice(0, 4000) || null });
  if (error) return { error };
  await logActivity(tenant.id, "customer.lead_notes", "Edited notes on a lead");
  refresh();
  return {};
}

// One more go at reaching them.
export async function recordContactAction(slug: string, id: string, attempts: number): Promise<{ error?: string }> {
  const { tenant, error } = await update(slug, id, { last_contacted_at: new Date().toISOString(), attempts: attempts + 1 });
  if (error) return { error };
  await logActivity(tenant.id, "customer.lead_contacted", "Recorded contact with a lead");
  refresh();
  return {};
}

export async function markLeadLostAction(slug: string, id: string, reason: string): Promise<{ error?: string }> {
  if (!isLostReason(reason)) return { error: "Pick a reason." };
  const { tenant, error } = await update(slug, id, { status: "lost", lost_reason: reason }, true);
  if (error) return { error };
  await logActivity(tenant.id, "customer.lead_lost", `Marked a lead as lost: ${LOST_REASONS[reason]}`);
  refresh();
  return {};
}

export async function reopenLeadAction(slug: string, id: string): Promise<{ error?: string }> {
  const { tenant, error } = await update(slug, id, { status: "quoted", lost_reason: null });
  if (error) return { error };
  await logActivity(tenant.id, "customer.lead_reopened", "Reopened a lead");
  refresh();
  return {};
}
