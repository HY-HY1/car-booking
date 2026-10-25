import { redirect } from "next/navigation";
import { appUrl } from "@/lib/urls";

// Now under Integrations → Developer; old links and bookmarks still work.
export default async function ApiSettingsPage({ params }: PageProps<"/app/[tenant]/settings/api">) {
  const { tenant } = await params;
  redirect(appUrl(`/${encodeURIComponent(tenant)}/settings/integrations#developer`));
}
