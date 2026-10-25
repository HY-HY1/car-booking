import type { Metadata } from "next";
import Link from "next/link";
import { GeneralForm } from "@/components/dashboard/settings/general-forms";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAccess } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { saveGeneralAction } from "./actions";
import { appUrl } from "@/lib/urls";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage({ params }: PageProps<"/app/[tenant]/settings">) {
  const { tenant: slug } = await params;
  const { tenant, can } = await requireAccess(slug, "settings.view");

  // RLS limits every read to this user's businesses; the filters pick this one.
  const supabase = await createClient();
  const [business, settings, members] = await Promise.all([
    supabase
      .from("tenants")
      .select("name, trade, contact_email, contact_phone, vat_number")
      .eq("id", tenant.id)
      .single(),
    supabase.from("booking_settings").select("timezone, base_postcode, offers_mobile, offers_unit").eq("tenant_id", tenant.id).maybeSingle(),
    supabase.from("tenant_members").select("user_id", { count: "exact", head: true }).eq("tenant_id", tenant.id),
  ]);
  if (business.error) throw business.error;
  if (settings.error) throw settings.error;
  if (members.error) throw members.error;

  const where = settings.data
    ? [settings.data.offers_mobile && "mobile", settings.data.offers_unit && "at your unit"].filter(Boolean).join(" and ")
    : "";

  return (
    <div className="grid max-w-3xl gap-4">
      {!can("settings.edit") && (
        <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">Your access level lets you see these but not change them.</p>
      )}
      <Card>
        <CardHeader>
          <CardTitle>Your business</CardTitle>
          <CardDescription>
            The name customers see everywhere, and how they reach you.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <GeneralForm
            values={{ ...business.data, timezone: settings.data?.timezone ?? "Europe/London" }}
            action={saveGeneralAction.bind(null, slug)}
            readOnly={!can("settings.edit")}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>At a glance</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-muted-foreground">Dashboard ID</dt>
            <dd className="font-mono">{tenant.slug}</dd>
            <dt className="text-muted-foreground">Where you work</dt>
            <dd>
              {where ? `Jobs ${where}` : "Not set"}
              {settings.data?.base_postcode && <span className="text-muted-foreground">, vans start from {settings.data.base_postcode}</span>}
              {" · "}
              <Link href={appUrl(`/${slug}/settings/booking`)} className="underline underline-offset-4">
                Change
              </Link>
            </dd>
            <dt className="text-muted-foreground">Team</dt>
            <dd>
              {members.count ?? 1} {members.count === 1 ? "person" : "people"} ·{" "}
              <Link href={appUrl(`/${slug}/staff`)} className="underline underline-offset-4">
                Manage staff
              </Link>
            </dd>
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
