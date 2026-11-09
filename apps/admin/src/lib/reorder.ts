import "server-only";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

// The drag-to-reorder lists. The caller has already checked this person may
// edit the list; every write is filtered on the business, so an id from
// another one changes nothing.

type OrderedTable = "services" | "add_ons" | "resources";

const idsSchema = z.array(z.uuid()).min(1).max(200);

export async function writeOrder(table: OrderedTable, tenantId: string, ids: string[]): Promise<{ message?: string }> {
  const parsed = idsSchema.safeParse(ids);
  if (!parsed.success) return { message: "That list has changed. Reload the page and try again." };

  const supabase = await createClient();
  const results = await Promise.all(
    parsed.data.map((id, sort_order) => supabase.from(table).update({ sort_order }).eq("tenant_id", tenantId).eq("id", id)),
  );
  const failed = results.find((r) => r.error);
  if (failed) {
    console.error(`Saving the ${table} order failed`, failed.error);
    return { message: "Couldn't save the new order. Try again." };
  }
  return {};
}

// A new item goes at the end of its list.
export async function nextOrder(table: OrderedTable, tenantId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from(table)
    .select("sort_order")
    .eq("tenant_id", tenantId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.sort_order ?? -1) + 1;
}
