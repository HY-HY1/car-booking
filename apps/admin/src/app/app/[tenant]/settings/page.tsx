import type { Metadata } from "next";
import Link from "next/link";
import { GeneralForm } from "@/components/dashboard/settings/general-forms";
import { ReadOnlyNotice, SettingsSection, SettingsStack } from "@/components/dashboard/settings/section";
import { CopyText } from "@/components/platform/copy-text";
import { requireAccess } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { appUrl } from "@/lib/urls";
import { saveGeneralAction } from "./actions";

export const metadata: Metadata = { title: "Business details" };

function whereYouWork(mobile: boolean, unit: boolean) {
  if (mobile && unit) return "Mobile jobs and jobs at your unit";
  if (mobile) return "Mobile jobs only";
  if (unit) return "Jobs at your unit only";
  return "Not set";
}

export default async function SettingsPage({ params }: PageProps<"/app/[tenant]/settings">) {
  const { tenant: slug } = await params;
  const { tenant, can } = await requireAccess(slug, "settings.view");
  const readOnly = !can("settings.edit");

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

  const s = settings.data;
  const people = members.count ?? 1;
  const link = "underline underline-offset-4 hover:text-foreground";

  return (
    <SettingsStack>
      {readOnly && <ReadOnlyNotice />}
      <SettingsSection
        id="business"
        title="Your business"
        description="The name customers see on your booking page and in every email, and how they get in touch with you."
      >
        <GeneralForm
          values={{ ...business.data, timezone: s?.timezone ?? "Europe/London" }}
          action={saveGeneralAction.bind(null, slug)}
          readOnly={readOnly}
        />
      </SettingsSection>

      <SettingsSection id="glance" title="At a glance" description="Set elsewhere, shown here so you can check them.">
        <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-[auto_minmax(0,1fr)]">
          <dt className="text-muted-foreground">Your dashboard</dt>
          <dd className="min-w-0">
            <CopyText value={appUrl(`/${slug}`, { absolute: true })} label="dashboard link" />
          </dd>
          <dt className="text-muted-foreground">Where you work</dt>
          <dd>
            {s ? whereYouWork(s.offers_mobile, s.offers_unit) : "Not set"}
            {s?.offers_mobile && s.base_postcode && (
              <span className="text-muted-foreground">, vans start from {s.base_postcode}</span>
            )}
            <span className="text-muted-foreground"> · </span>
            <Link href={appUrl(`/${slug}/settings/booking`)} className={link}>
              Change
            </Link>
          </dd>
          <dt className="text-muted-foreground">Team</dt>
          <dd>
            {people} {people === 1 ? "person" : "people"}
            <span className="text-muted-foreground"> · </span>
            <Link href={appUrl(`/${slug}/team`)} className={link}>
              Manage staff
            </Link>
          </dd>
        </dl>
      </SettingsSection>
    </SettingsStack>
  );
}
