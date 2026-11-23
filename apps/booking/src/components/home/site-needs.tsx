import { Droplet, Plug } from "lucide-react";
import { requiredSiteNeeds, SITE_NEED_LABELS, siteNeedsText, type SiteNeeds } from "@leadgen/core/booking/site-needs";
import { cn } from "@/lib/cn";
import { container } from "@/components/site";
import { Eyebrow } from "./eyebrow";

const ICONS = { water: Droplet, power: Plug } as const;

// Straight under the heading on the home page: what the business can't do a
// job at the customer's address without (Settings → Hours & rules → At the
// customer's address), so nobody finds out halfway through booking. The
// booking form asks for each and won't book a mobile job without them.
export function SiteNeedsNotice({ needs, unitAddress }: { needs: SiteNeeds; unitAddress: string }) {
  const required = requiredSiteNeeds(needs);
  if (!required.length) return null;
  return (
    <section aria-labelledby="needs-title" className="pt-10 sm:pt-14">
      <div className={container}>
        <div className="grid gap-8 rounded-3xl border bg-surface p-6 shadow-sm sm:p-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-center lg:gap-14">
          <div className="grid gap-3">
            <Eyebrow>Before you book</Eyebrow>
            <h2 id="needs-title" className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
              What we need at your address
            </h2>
            <p className="max-w-md text-pretty text-neutral-600">
              We bring everything else. For jobs at your home or workplace we just need {siteNeedsText(needs)}, and
              can&apos;t take the booking without {required.length > 1 ? "them" : "one"}.
            </p>
            {unitAddress && (
              <p className="max-w-md text-sm text-pretty text-neutral-500">
                Don&apos;t have {required.length > 1 ? "them" : "one"}? Drop your car off at{" "}
                <span className="font-medium text-neutral-900">{unitAddress}</span> instead.
              </p>
            )}
          </div>
          <ul className={cn("grid gap-3", required.length > 1 && "sm:grid-cols-2 lg:grid-cols-1")}>
            {required.map((k) => {
              const Icon = ICONS[k];
              return (
                <li key={k} className="flex items-center gap-4 rounded-2xl bg-neutral-50 p-4 ring-1 ring-neutral-200/70 sm:p-5">
                  <span aria-hidden className="grid size-12 shrink-0 place-items-center rounded-2xl bg-brand/10 text-brand">
                    <Icon className="size-6" strokeWidth={1.75} />
                  </span>
                  <span className="grid min-w-0 gap-0.5">
                    <span className="font-semibold text-neutral-900">{SITE_NEED_LABELS[k].short}</span>
                    <span className="text-sm text-neutral-600">{SITE_NEED_LABELS[k].detail}</span>
                  </span>
                  <span className="ml-auto shrink-0 rounded-full bg-brand px-2.5 py-1 text-xs font-medium text-brand-fg">
                    Required
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}
