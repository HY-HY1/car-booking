"use client";

import { useState, useTransition } from "react";
import { Home, Navigation, Route, TriangleAlert } from "lucide-react";
import { googleMapsDayUrl, googleMapsUrl, wazeUrl } from "@leadgen/core/booking/route-plan";
import { planRouteAction, type RouteView } from "@/app/app/[tenant]/diary/actions";
import { selectClass } from "@/components/platform/field";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Diary → Day → Route planner: one van's day from its start point and back,
// with when to leave each place. Nothing is worked out until it's asked for,
// since each drive is a call to Google.

export function RoutePlanner({
  slug,
  date,
  timeZone,
  vans,
}: {
  slug: string;
  date: string;
  timeZone: string;
  // The vans with jobs on this day; the first is picked to start with.
  vans: { id: string; name: string }[];
}) {
  const [van, setVan] = useState(vans[0]?.id ?? "");
  const [route, setRoute] = useState<RouteView>();
  const [message, setMessage] = useState<string>();
  const [pending, startTransition] = useTransition();

  if (vans.length === 0) return <p className="text-sm text-muted-foreground">No jobs on this day to plan a route for.</p>;

  const clock = (iso: string) =>
    new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone }).format(new Date(iso));
  const plan = () =>
    startTransition(async () => {
      const result = await planRouteAction(slug, date, van);
      setRoute(result.route);
      setMessage(result.message);
    });

  const stopOf = (id: string | null) => route?.stops.find((s) => s.id === id);
  const placeName = (id: string | null) => {
    const stop = stopOf(id);
    if (stop) return stop.customer ?? stop.address;
    return route?.home ? `home (${route.home})` : "home";
  };
  const homeLeg = route?.legs.find((l) => l.toId === null);
  const dayUrl = route && googleMapsDayUrl(route.home, route.stops.map((s) => s.address));

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {vans.length > 1 && (
          <select
            aria-label="Van"
            value={van}
            onChange={(e) => {
              setVan(e.target.value);
              setRoute(undefined);
            }}
            className={cn(selectClass, "w-auto")}
          >
            {vans.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        )}
        <Button type="button" onClick={plan} disabled={pending}>
          <Route />
          {pending ? "Working it out…" : route ? "Plan again" : "Plan the route"}
        </Button>
        {dayUrl && (
          <a href={dayUrl} target="_blank" rel="noreferrer" className={buttonVariants({ variant: "outline" })}>
            <Navigation /> Whole day in Google Maps
          </a>
        )}
      </div>

      {message && <p className="text-sm text-muted-foreground">{message}</p>}

      {route && (
        <>
          {!route.home && (
            <p className="text-sm text-amber-800 dark:text-amber-300">
              Add the postcode your van starts from (Settings → Booking) to plan the drive there and back.
            </p>
          )}
          {route.late && (
            <p className="flex items-center gap-1.5 text-sm font-medium text-destructive">
              <TriangleAlert className="size-4" /> At least one job can&apos;t be reached on time. See the red lines below.
            </p>
          )}

          <ol className="grid gap-2">
            {route.stops.map((stop) => {
              const leg = route.legs.find((l) => l.toId === stop.id);
              return (
                <li key={stop.id} className="grid gap-2">
                  {leg && <LegLine leg={leg} from={placeName(leg.fromId)} clock={clock} />}
                  <div className="grid gap-2 rounded-xl border bg-card p-3 text-sm sm:grid-cols-[1fr_auto] sm:items-center">
                    <div className="min-w-0">
                      <p className="font-medium">
                        {clock(stop.start)}–{clock(stop.end)} · {stop.customer ?? "Customer"}
                        {stop.service && <span className="font-normal text-muted-foreground"> · {stop.service}</span>}
                      </p>
                      <p className="truncate text-muted-foreground">{stop.address}</p>
                    </div>
                    <NavLinks address={stop.address} />
                  </div>
                </li>
              );
            })}
            {homeLeg && route.home && (
              <li className="grid gap-2">
                <LegLine leg={homeLeg} from="" clock={clock} />
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-dashed p-3 text-sm">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <Home className="size-4" /> {route.home}
                  </span>
                  <NavLinks address={route.home} />
                </div>
              </li>
            )}
          </ol>

          <p className="text-xs text-muted-foreground">
            Times aim to get you there {route.marginMins} minutes before each job.{" "}
            {route.source === "google"
              ? "Drive times are from Google Maps, with the traffic expected when you leave."
              : "Drive times are estimates from the postcodes; Google Maps traffic isn't switched on yet."}
          </p>
        </>
      )}
    </div>
  );
}

// The drive to the next place: when to leave, how long, and how much slack.
function LegLine({ leg, from, clock }: { leg: RouteView["legs"][number]; from: string; clock: (iso: string) => string }) {
  const late = leg.spareMins !== null && leg.spareMins < 0;
  return (
    <div
      className={cn(
        "flex flex-wrap items-baseline gap-x-2 gap-y-1 border-l-2 py-1 pl-3 text-sm",
        late ? "border-destructive text-destructive" : "border-muted-foreground/30 text-muted-foreground",
      )}
    >
      <span className="font-medium text-foreground">
        {leg.toId ? `Leave ${from} by ${clock(leg.leaveBy)}` : `Head home at ${clock(leg.leaveBy)}, back about ${clock(leg.arriveBy)}`}
      </span>
      <span>
        {leg.driveMins === null ? "drive time unknown" : leg.driveMins === 0 ? "same postcode, no drive" : `~${leg.driveMins} min drive`}
      </span>
      {leg.spareMins !== null && leg.driveMins !== 0 && (
        <span className={cn(late && "font-medium")}>
          {late ? `· ${-leg.spareMins} min late even leaving as the job before ends` : `· ${leg.spareMins} min spare after the job before`}
        </span>
      )}
    </div>
  );
}

function NavLinks({ address }: { address: string }) {
  const link = buttonVariants({ variant: "outline", size: "sm" });
  return (
    <div className="flex gap-2">
      <a href={wazeUrl(address)} target="_blank" rel="noreferrer" className={link}>
        Waze
      </a>
      <a href={googleMapsUrl(address)} target="_blank" rel="noreferrer" className={link}>
        Google Maps
      </a>
    </div>
  );
}
