import { redirect } from "next/navigation";
import { appUrl } from "@/lib/urls";

// Renamed to Billing; old links and bookmarks still work.
export default async function SubscriptionPage({ params }: PageProps<"/app/[tenant]/settings/subscription">) {
  const { tenant } = await params;
  redirect(appUrl(`/${encodeURIComponent(tenant)}/settings/billing`));
}
