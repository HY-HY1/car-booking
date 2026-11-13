import type { Metadata } from "next";
import { emailBrandOf } from "@leadgen/core/branding/email-brand";
import { senderRecords, type SenderStatus } from "@leadgen/core/email/senders";
import { notificationsOf } from "@leadgen/core/settings/notifications";
import { NotificationsForm } from "@/components/dashboard/settings/notification-form";
import { SenderCard } from "@/components/dashboard/settings/sender-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAccess } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { saveNotificationsAction, saveSenderAction } from "./actions";

export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationsPage({ params }: PageProps<"/app/[tenant]/settings/notifications">) {
  const { tenant: slug } = await params;
  const { tenant, can, user } = await requireAccess(slug, "settings.view");
  const readOnly = !can("settings.edit");
  const supabase = await createClient();
  const [business, sender, google] = await Promise.all([
    supabase.from("tenants").select("name, notification_settings, contact_email, contact_phone, branding").eq("id", tenant.id).single(),
    supabase.from("email_senders").select("address, domain, status, check_error, records").eq("tenant_id", tenant.id).maybeSingle(),
    // The review link from a connected Google Business Profile, to offer.
    supabase.from("google_business_connections").select("review_url").eq("tenant_id", tenant.id).maybeSingle(),
  ]);
  if (business.error) throw business.error;
  if (sender.error) throw sender.error;
  const s = sender.data;

  return (
    <div className="grid max-w-3xl gap-4">
      {readOnly && (
        <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">Your access level lets you see these but not change them.</p>
      )}
      <Card>
        <CardHeader>
          <CardTitle>Your email address</CardTitle>
          <CardDescription>
            Customers get their confirmations and reminders from this address, with replies going to you. Use one on your
            own domain, like hello@yourbusiness.co.uk.{" "}
            {s?.status !== "verified" && "Until it's verified, customers aren't sent any emails."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SenderCard
            slug={slug}
            sender={
              s
                ? {
                    address: s.address,
                    domain: s.domain,
                    status: s.status as SenderStatus,
                    checkError: s.check_error,
                    records: senderRecords(s.domain, s.records),
                  }
                : null
            }
            action={saveSenderAction.bind(null, slug)}
            readOnly={readOnly}
          />
        </CardContent>
      </Card>
      <NotificationsForm
        settings={notificationsOf(business.data.notification_settings)}
        business={emailBrandOf({
          name: business.data.name,
          contactEmail: business.data.contact_email,
          contactPhone: business.data.contact_phone,
          branding: business.data.branding,
        })}
        ownerEmail={user.email}
        googleReviewUrl={google.data?.review_url ?? null}
        action={saveNotificationsAction.bind(null, slug)}
        readOnly={readOnly}
      />
    </div>
  );
}
