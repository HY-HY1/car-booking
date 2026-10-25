import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { bookingSettingsSchema, type Territory } from "@leadgen/core/booking/config";
import { coordsFor, lookupPostcodes } from "@leadgen/core/booking/geo";
import { ComingSoon, PageHeader } from "@/components/dashboard/page-header";
import { CoverageMap } from "@/components/dashboard/coverage-map";
import { requireAccess } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { saveCoverage } from "./actions";
import { appUrl } from "@/lib/urls";

export const metadata: Metadata = { title: "Coverage area" };

export default async function CoveragePage({ params }: PageProps<"/app/[tenant]/coverage">) {
  await connection();
  const { tenant: slug } = await params;
  const { tenant, can } = await requireAccess(slug, "settings.view");

  // RLS limits the read to this business.
  const supabase = await createClient();
  const { data, error } = await supabase.from("booking_settings").select("*").eq("tenant_id", tenant.id).maybeSingle();
  if (error) throw error;

  const header = (
    <PageHeader
      title="Coverage area"
      description="Drag a circle to move it and its edge to resize it. Customers outside every territory can't book a mobile job."
    />
  );

  if (!data) {
    return (
      <>
        {header}
        <ComingSoon>Booking isn&apos;t set up for this business yet.</ComingSoon>
      </>
    );
  }
  const settings = bookingSettingsSchema.parse(data);

  // Centred on the postcode from setup: where the vans start, or the shop for a shop-only business.
  const postcode = settings.base_postcode ?? settings.unit_postcode;
  const coords = coordsFor(await lookupPostcodes(postcode ? [postcode] : []), postcode);
  if (!postcode || !coords) {
    return (
      <>
        {header}
        <ComingSoon>
          {postcode ? `We couldn't find ${postcode} on the map. Check it in ` : "Add where your vans start from in "}
          <Link href={appUrl(`/${slug}/settings/booking`)} className="underline">
            Settings → Booking
          </Link>
          .
        </ComingSoon>
      </>
    );
  }

  const area = settings.service_area;
  // Until territories are saved, the default one is the radius from setup.
  const territories: Territory[] =
    "territories" in area
      ? area.territories
      : [
          {
            id: "default",
            name: "Default territory",
            lat: coords.lat,
            lng: coords.lng,
            radius_miles: "radius_miles" in area ? area.radius_miles : 15,
          },
        ];
  const note =
    "territories" in area || "radius_miles" in area
      ? null
      : "districts" in area
        ? `You currently cover ${area.districts.join(", ")} by postcode district. Saving here switches you to the territories below.`
        : "You currently cover anywhere. Saving here limits you to the territories below.";

  return (
    <div className="grid max-w-4xl gap-4">
      {header}
      {!can("settings.edit") && (
        <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">Only the business owner can change this.</p>
      )}
      {note && <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">{note}</p>}
      <CoverageMap
        initial={territories}
        postcode={postcode}
        readOnly={!can("settings.edit")}
        action={saveCoverage.bind(null, slug)}
      />
    </div>
  );
}
