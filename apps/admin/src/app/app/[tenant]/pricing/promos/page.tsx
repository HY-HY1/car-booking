import type { Metadata } from "next";
import { formatPence } from "@leadgen/core/booking/config";
import { formatDate } from "@leadgen/core/dates";
import { BackLink, PageHeader } from "@/components/dashboard/page-header";
import { PromoForm, PromoToggle } from "@/components/dashboard/promo-forms";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { requireAccess } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { appUrl } from "@/lib/urls";
import { addPromoAction, setPromoActiveAction } from "./actions";

export const metadata: Metadata = { title: "Discount codes" };

export default async function PromosPage({ params }: PageProps<"/app/[tenant]/pricing/promos">) {
  const { tenant: slug } = await params;
  const { tenant, can } = await requireAccess(slug, "pricing.view");
  const canEdit = can("pricing.edit");

  const supabase = await createClient();
  const [codes, used] = await Promise.all([
    supabase.from("promo_codes").select("id, code, kind, value, max_uses, expires_at, active").eq("tenant_id", tenant.id).order("created_at", { ascending: false }),
    supabase.from("bookings").select("promo_code_id").eq("tenant_id", tenant.id).not("promo_code_id", "is", null).not("status", "in", "(cancelled,expired)").limit(5000),
  ]);
  if (codes.error) throw codes.error;
  if (used.error) throw used.error;
  const uses = new Map<string, number>();
  for (const b of used.data) uses.set(b.promo_code_id, (uses.get(b.promo_code_id) ?? 0) + 1);

  return (
    <>
      <BackLink href={appUrl(`/${slug}/pricing`)}>Pricing</BackLink>
      <PageHeader title="Discount codes" description="Codes customers enter on the booking page. Vouchers work the same way: a fixed amount off, usable once." />
      <div className="grid max-w-3xl gap-4">
        {canEdit && (
          <Card>
            <CardHeader>
              <CardTitle>New code</CardTitle>
              <CardDescription>A cancelled booking gives its use back.</CardDescription>
            </CardHeader>
            <CardContent>
              <PromoForm action={addPromoAction.bind(null, slug)} />
            </CardContent>
          </Card>
        )}
        {codes.data.length === 0 ? (
          <EmptyState compact>No codes yet.</EmptyState>
        ) : (
          <ul className="divide-y rounded-xl border">
            {codes.data.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
                <span>
                  <span className="font-mono font-medium">{c.code}</span>
                  <span className="block text-xs text-muted-foreground">
                    {[
                      c.kind === "percent" ? `${c.value}% off` : `${formatPence(c.value)} off`,
                      `used ${uses.get(c.id) ?? 0}${c.max_uses ? ` of ${c.max_uses}` : ""}`,
                      c.expires_at && `ends ${formatDate(c.expires_at)}`,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  <Badge tone={c.active ? "success" : "neutral"}>{c.active ? "On" : "Off"}</Badge>
                  {canEdit && <PromoToggle active={c.active} action={setPromoActiveAction.bind(null, slug, c.id, !c.active)} />}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
