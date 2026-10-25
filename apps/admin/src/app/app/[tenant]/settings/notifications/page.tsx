import type { Metadata } from "next";
import { notificationsOf } from "@leadgen/core/settings/notifications";
import { NotificationsForm } from "@/components/dashboard/settings/notification-form";
import { requireAccess } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { saveNotificationsAction } from "./actions";

export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationsPage({ params }: PageProps<"/app/[tenant]/settings/notifications">) {
  const { tenant: slug } = await params;
  const { tenant, can, user } = await requireAccess(slug, "settings.view");
  const supabase = await createClient();
  const { data, error } = await supabase.from("tenants").select("name, notification_settings").eq("id", tenant.id).single();
  if (error) throw error;

  return (
    <div className="grid max-w-3xl gap-4">
      <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
        Automatic emails and texts are on their way. Set them up now and they&apos;ll go out like this from the day they
        launch. Until then, nothing is sent.
      </p>
      {!can("settings.edit") && (
        <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">Your access level lets you see these but not change them.</p>
      )}
      <NotificationsForm
        settings={notificationsOf(data.notification_settings)}
        businessName={data.name}
        ownerEmail={user.email}
        action={saveNotificationsAction.bind(null, slug)}
        readOnly={!can("settings.edit")}
      />
    </div>
  );
}
