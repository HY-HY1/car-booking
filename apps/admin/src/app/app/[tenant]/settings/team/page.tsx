import { redirect } from "next/navigation";
import { appUrl } from "@/lib/urls";

// Moved to Team → Logins & access. Kept so saved links still work.
export default async function TeamAccessMoved({ params }: PageProps<"/app/[tenant]/settings/team">) {
  const { tenant: slug } = await params;
  redirect(appUrl(`/${slug}/team/access`));
}
