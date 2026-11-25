import { redirect } from "next/navigation";
import { appUrl } from "@/lib/urls";

// The booking page used to be a Settings tab; it's its own page now. Old
// links and bookmarks land there.
export default async function OldBookingPageSettings({ params }: PageProps<"/app/[tenant]/settings/booking-page">) {
  const { tenant: slug } = await params;
  redirect(appUrl(`/${slug}/booking-page`));
}
