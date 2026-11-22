import { coverageCircles, type CoverageCircle } from "@leadgen/core/booking/engine";
import type { BookingSettings } from "@leadgen/core/booking/config";
import { cn } from "@/lib/cn";
import { container } from "@/components/site";
import { CoverageMap } from "./coverage-map";
import { Eyebrow } from "./eyebrow";
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

  return (
    <section id="area" aria-labelledby="area-title" className="scroll-mt-4 border-t py-14 sm:py-20">
      <div className={cn(container, "grid gap-10", circles.length > 0 && "lg:grid-cols-2 lg:items-center lg:gap-14")}>
        <div className="grid content-start gap-5">
          <Eyebrow>Areas covered</Eyebrow>
          <div className="grid gap-3">
            <h2 id="area-title" className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
              Do we cover your postcode?
            </h2>
            <p className="max-w-lg text-neutral-600">
              {miles
                ? `We come to your home or workplace, anywhere within about ${miles} ${miles === 1 ? "mile" : "miles"} of our base.`
                : districts.length > 0 && places.length === 0
                  ? "We come to your home or workplace in these postcode areas."
                  : `${businessName} comes to your home or workplace. Check your postcode to see if you're in our area.`}
            </p>
          </div>

          {listed.length > 0 && (
            <ul className="flex flex-wrap gap-x-1 gap-y-1.5 text-sm text-neutral-700" aria-label={places.length > 0 ? "Places we cover" : "Postcode areas we cover"}>
              {listed.map((p, i) => (
                <li key={p} className="inline-flex items-center gap-1">
                  {p}
                  {i < listed.length - 1 && (
                    <span aria-hidden className="text-neutral-400">
                      ·
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}

          <PostcodeCheck quoteUrl={quoteUrl} contactHref={contactHref} />

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
        </div>

        {circles.length > 0 && <CoverageMap circles={circles} label={`Map of the area ${businessName} covers`} />}
      </div>
    </section>
  );
}
