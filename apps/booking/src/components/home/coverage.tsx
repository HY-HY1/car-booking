import { coverageCircles, type CoverageCircle } from "@leadgen/core/booking/engine";
import type { BookingSettings } from "@leadgen/core/booking/config";
import { MapPin } from "lucide-react";
import { cn } from "@/lib/cn";
import { container } from "@/components/site";
import { CoverageMap } from "./coverage-map";
import { PostcodeCheck } from "./postcode-check";

// Where a business that travels goes: its area on a map (circles from the
// Coverage Area page), the places it names, and a postcode checker. Postcode
// districts have no map; the districts are listed instead.

export async function Coverage({
  businessName,
  settings,
  places,
  quoteUrl,
  contactHref,
}: {
  businessName: string;
  settings: BookingSettings;
  places: string[];
  quoteUrl: string;
  contactHref: string | null;
}) {
  const area = settings.service_area;
  const districts = "districts" in area ? area.districts : [];
  let circles: CoverageCircle[] = [];
  try {
    circles = await coverageCircles(settings);
  } catch (error) {
    console.error("Couldn't draw the coverage map", error);
  }
  const miles = circles.length === 1 ? circles[0].miles : null;
  const listed = places.length > 0 ? places : districts;

  const note = (
    <p className="text-sm text-neutral-500">
      Just outside? We can sometimes fit in nearby places depending on the day&apos;s route.
      {contactHref && (
        <>
          {" "}
          <a href={contactHref} className="font-medium text-neutral-900 underline underline-offset-4">
            Ask us
          </a>
          .
        </>
      )}
    </p>
  );

  return (
    <section id="area" aria-labelledby="area-title" className="scroll-mt-4 border-t py-14 sm:py-20">
      <div className={cn(container, "grid gap-10 lg:grid-cols-2 lg:items-center lg:gap-14")}>
        <div className="grid content-start gap-5">
          <div className="grid gap-3">
            <h2 id="area-title" className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              Do we cover your postcode?
            </h2>
            <p className="max-w-lg text-pretty text-neutral-600">
              {miles
                ? `We come to your home or workplace, anywhere within about ${miles} ${miles === 1 ? "mile" : "miles"} of our base.`
                : districts.length > 0 && places.length === 0
                  ? "We come to your home or workplace in these postcode areas."
                  : `${businessName} comes to your home or workplace. Check your postcode to see if you're in our area.`}
            </p>
          </div>

          {listed.length > 0 && (
            <ul className="flex flex-wrap gap-2 text-sm" aria-label={places.length > 0 ? "Places we cover" : "Postcode areas we cover"}>
              {listed.map((p) => (
                <li key={p} className="inline-flex items-center gap-1.5 rounded-full border bg-surface px-3 py-1 font-medium text-neutral-700">
                  <MapPin className="size-3.5 text-brand" aria-hidden />
                  {p}
                </li>
              ))}
            </ul>
          )}

          {/* With a map, the checker sits under the words; without one it
              has the other column to itself. */}
          {circles.length > 0 && (
            <>
              <PostcodeCheck quoteUrl={quoteUrl} contactHref={contactHref} />
              {note}
            </>
          )}
        </div>

        {circles.length > 0 ? (
          <CoverageMap circles={circles} label={`Map of the area ${businessName} covers`} />
        ) : (
          <div className="grid gap-4 rounded-2xl border bg-surface p-6 sm:p-8">
            <div className="flex items-center gap-3">
              <MapPin aria-hidden className="size-5 text-neutral-400" />
              <p className="font-semibold text-neutral-900">Check your postcode</p>
            </div>
            <PostcodeCheck quoteUrl={quoteUrl} contactHref={contactHref} />
            {note}
          </div>
        )}
      </div>
    </section>
  );
}
