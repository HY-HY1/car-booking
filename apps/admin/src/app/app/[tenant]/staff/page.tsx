import { redirect } from "next/navigation";
import { appUrl } from "@/lib/urls";

// Moved to Team. Kept so saved links still work.
export default async function StaffMoved({ params }: PageProps<"/app/[tenant]/staff">) {
  const { tenant: slug } = await params;
  redirect(appUrl(`/${slug}/team`));
}
