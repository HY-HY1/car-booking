import type { Metadata } from "next";
import { assistantOf } from "@leadgen/core/settings/assistant";
import { AssistantForm } from "@/components/dashboard/settings/assistant-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAccess } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { saveAssistantAction } from "./actions";

export const metadata: Metadata = { title: "AI assistant" };

export default async function AssistantPage({ params }: PageProps<"/app/[tenant]/settings/assistant">) {
  const { tenant: slug } = await params;
  const { tenant, can } = await requireAccess(slug, "settings.view");
  const supabase = await createClient();
  const { data, error } = await supabase.from("tenants").select("name, agent_rules").eq("id", tenant.id).single();
  if (error) throw error;

  return (
    <div className="grid max-w-3xl gap-4">
      <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
        The AI assistant is on its way. Set it up now and it will work this way from the day it launches. Until then,
        nothing here changes what customers see.
      </p>
      {!can("settings.edit") && (
        <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">Your access level lets you see these but not change them.</p>
      )}
      <Card>
        <CardHeader>
          <CardTitle>AI booking assistant</CardTitle>
          <CardDescription>
            It answers enquiries for you, any time of day, using your prices, hours and booking rules.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AssistantForm
            settings={assistantOf(data.agent_rules)}
            businessName={data.name}
            action={saveAssistantAction.bind(null, slug)}
            readOnly={!can("settings.edit")}
          />
        </CardContent>
      </Card>
    </div>
  );
}
