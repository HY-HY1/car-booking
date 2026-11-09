import type { Metadata } from "next";
import { assistantOf } from "@leadgen/core/settings/assistant";
import { AssistantForm } from "@/components/dashboard/settings/assistant-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAccess } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { saveAssistantAction } from "./actions";

export const metadata: Metadata = { title: "AI assistant" };

export default async function AssistantPage({ params }: PageProps<"/app/[tenant]/settings/assistant">) {
  const { tenant: slug } = await params;
  const { tenant } = await requireAccess(slug, "settings.view");
  const supabase = await createClient();
  const { data, error } = await supabase.from("tenants").select("name, agent_rules").eq("id", tenant.id).single();
  if (error) throw error;

  return (
    <div className="grid max-w-3xl gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            AI booking assistant <Badge tone="info">Coming soon</Badge>
          </CardTitle>
          <CardDescription>
            This isn&apos;t live yet, and customers won&apos;t get any replies from it. When it launches it will answer
            enquiries for you using your prices, hours and booking rules. These are the choices you&apos;ll have.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AssistantForm
            settings={assistantOf(data.agent_rules)}
            businessName={data.name}
            action={saveAssistantAction.bind(null, slug)}
            // Nothing can act on these yet, so nothing can be changed.
            readOnly
          />
        </CardContent>
      </Card>
    </div>
  );
}
