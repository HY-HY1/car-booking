"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { appUrl } from "@/lib/urls";

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect(appUrl("/login"));
}
