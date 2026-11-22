import { permanentRedirect } from "next/navigation";
import { adminUrl } from "@/lib/urls";

// Business pages moved under /businesses; old links and bookmarks follow.
export default async function OldBusinessPage({ params }: PageProps<"/admin/[slug]">) {
  const { slug } = await params;
  permanentRedirect(adminUrl(`/businesses/${encodeURIComponent(slug)}`));
}
