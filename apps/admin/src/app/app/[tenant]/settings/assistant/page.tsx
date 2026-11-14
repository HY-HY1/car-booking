import type { Metadata } from "next";
import { assistantOf } from "@leadgen/core/settings/assistant";
import { AssistantForm } from "@/components/dashboard/settings/assistant-form";
import { SettingsSection, SettingsStack } from "@/components/dashboard/settings/section";
import { Badge } from "@/components/ui/badge";
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
    <SettingsStack>
      <div className="grid gap-1 rounded-xl bg-sky-50 px-4 py-3 text-sm text-sky-950 sm:px-6 dark:bg-sky-950/40 dark:text-sky-100">
        <p className="font-medium">Coming soon</p>
        <p>
          The assistant isn&apos;t live yet, and customers won&apos;t get any replies from it. When it launches it will answer
          enquiries for you using your prices, hours and booking rules. Below are the choices you&apos;ll have; they can&apos;t
          be changed until then.
        </p>
      </div>
      <SettingsSection
        id="assistant"
        title="AI booking assistant"
        badge={<Badge tone="info">Coming soon</Badge>}
        description="What it handles, how it sounds, when it chases enquiries up and when it hands over to you."
      >
        <AssistantForm
          settings={assistantOf(data.agent_rules)}
          businessName={data.name}
          action={saveAssistantAction.bind(null, slug)}
          // Nothing can act on these yet, so nothing can be changed.
          readOnly
        />
      </SettingsSection>
    </SettingsStack>
  );
}
