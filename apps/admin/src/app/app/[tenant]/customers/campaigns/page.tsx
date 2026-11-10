import type { Metadata } from "next";
import { formatDateTime } from "@leadgen/core/dates";
import { CampaignActions, CampaignForm } from "@/components/dashboard/campaigns";
import { BackLink, PageHeader } from "@/components/dashboard/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { requireAccess } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { appUrl } from "@/lib/urls";
import { deleteCampaignAction, saveCampaignAction, startCampaignAction, testCampaignAction } from "./actions";

export const metadata: Metadata = { title: "Campaigns" };

const STATUS = {
  draft: { label: "Draft", tone: "neutral" },
  sending: { label: "Sending", tone: "info" },
  sent: { label: "Sent", tone: "success" },
} as const;

export default async function CampaignsPage({ params }: PageProps<"/app/[tenant]/customers/campaigns">) {
  const { tenant: slug } = await params;
  const { tenant } = await requireAccess(slug, "settings.edit");

  const supabase = await createClient();
  const [campaigns, audience] = await Promise.all([
    supabase.from("campaigns").select("id, subject, status, created_at, finished_at, sent_count").eq("tenant_id", tenant.id).order("created_at", { ascending: false }).limit(50),
    supabase
      .from("customers")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenant.id)
      .eq("email_marketing", true)
      .is("anonymised_at", null)
      .not("email", "is", null),
  ]);
  if (campaigns.error) throw campaigns.error;
  if (audience.error) throw audience.error;
  const count = audience.count ?? 0;

  return (
    <>
      <BackLink href={appUrl(`/${slug}/customers`)}>Customers</BackLink>
      <PageHeader title="Campaigns" description={`Email customers who agreed to hear from you. That's ${count} ${count === 1 ? "person" : "people"} right now.`} />
      <div className="grid max-w-3xl gap-4">
        <Card>
          <CardHeader>
            <CardTitle>New campaign</CardTitle>
            <CardDescription>
              Saved as a draft: nothing goes out until you press Send. You can use {"{customer_name}"}, {"{business_name}"} and {"{booking_link}"}. An unsubscribe link is added for you.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CampaignForm action={saveCampaignAction.bind(null, slug)} />
          </CardContent>
        </Card>

        {campaigns.data.length === 0 ? (
          <EmptyState compact>No campaigns yet.</EmptyState>
        ) : (
          <ul className="divide-y rounded-xl border">
            {campaigns.data.map((c) => {
              const status = STATUS[c.status as keyof typeof STATUS];
              return (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
                  <span className="min-w-0">
                    <span className="block font-medium">{c.subject}</span>
                    <span className="block text-xs text-muted-foreground">
                      {c.status === "draft" ? `Drafted ${formatDateTime(c.created_at)}` : `${c.sent_count} sent${c.finished_at ? `, finished ${formatDateTime(c.finished_at)}` : " so far"}`}
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    <Badge tone={status.tone}>{status.label}</Badge>
                    {c.status === "draft" && (
                      <CampaignActions
                        audience={count}
                        test={testCampaignAction.bind(null, slug, c.id)}
                        start={startCampaignAction.bind(null, slug, c.id)}
                        remove={deleteCampaignAction.bind(null, slug, c.id)}
                      />
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}
