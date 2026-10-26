import "server-only";
import { cache } from "react";
import { brandingSchema } from "@leadgen/core/tenants";
import { createClient } from "@/lib/supabase/server";

// A business's brand (Settings → Booking page), for its dashboard. Through the
// signed-in session, so RLS keeps it to businesses the user belongs to.
// Cached per request: the layout's style and sidebar both read it.
export const getBranding = cache(async (tenantId: string) => {
  const supabase = await createClient();
  const { data, error } = await supabase.from("tenants").select("branding").eq("id", tenantId).single();
  if (error) throw error;
  return brandingSchema.parse(data.branding ?? {});
});
