import { NextResponse } from "next/server";
import { refuseUnlessCron } from "@leadgen/core/cron-auth";
import { createAdminClient } from "@leadgen/core/supabase/admin";

// GET /api/health/supabase: checks the app can reach the database. Behind
// CRON_SECRET (send "Authorization: Bearer $CRON_SECRET", as an uptime
// monitor can), and it says only yes or no: no project address or error text.
export async function GET(request: Request) {
  const refused = refuseUnlessCron(request);
  if (refused) return refused;
  const { error } = await createAdminClient().from("tenants").select("id", { head: true, count: "exact" }).limit(1);
  if (error) {
    console.error("[health] Supabase check failed", error);
    return NextResponse.json({ ok: false }, { status: 503 });
  }
  return NextResponse.json({ ok: true });
}
