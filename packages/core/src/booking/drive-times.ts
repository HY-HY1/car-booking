import "server-only";
import { coordsFor, estimateDriveMins, haversineMiles, lookupPostcodes } from "./geo";
import type { DriveTime } from "./route-plan";

// Drive times for the route planner. With GOOGLE_MAPS_API_KEY they come from
// Google's Routes API, with the traffic expected when you leave; without it,
// or when Google can't answer, from the straight-line estimate the diary
// already uses (geo.ts). Addresses go to Google, so it's a subprocessor.

const ROUTES = "https://routes.googleapis.com/directions/v2:computeRoutes";

export type DriveSource = "google" | "estimate";

export function driveSource(): DriveSource {
  return process.env.GOOGLE_MAPS_API_KEY ? "google" : "estimate";
}

// One drive, leaving at `departAt`. Google only predicts traffic for times
// still to come, so a time already gone is asked without one (typical roads).
async function googleDriveMins(key: string, from: string, to: string, departAt: Date): Promise<number | null> {
  const future = departAt.getTime() > Date.now() + 60_000;
  const response = await fetch(ROUTES, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask": "routes.duration",
    },
    body: JSON.stringify({
      origin: { address: from },
      destination: { address: to },
      travelMode: "DRIVE",
      routingPreference: future ? "TRAFFIC_AWARE" : "TRAFFIC_UNAWARE",
      ...(future && { departureTime: departAt.toISOString() }),
      regionCode: "GB",
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    console.error(`[routes] Google ${response.status}: ${(await response.text()).slice(0, 300)}`);
    return null;
  }
  const json = (await response.json()) as { routes?: { duration?: string }[] };
  const seconds = Number.parseInt(json.routes?.[0]?.duration ?? "", 10);
  return Number.isFinite(seconds) ? Math.ceil(seconds / 60) : null;
}

// A DriveTime for planRoute. `postcodes` maps each address to its postcode,
// for the estimate. Answers are kept for the length of one plan, since the
// same drive is asked about twice.
export async function driveTimes(postcodes: Map<string, string>): Promise<DriveTime> {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  const coords = await lookupPostcodes([...postcodes.values()]);
  const estimate = (from: string, to: string) => {
    const a = coordsFor(coords, postcodes.get(from) ?? from);
    const b = coordsFor(coords, postcodes.get(to) ?? to);
    return a && b ? estimateDriveMins(haversineMiles(a, b)) : null;
  };

  const asked = new Map<string, Promise<number | null>>();
  return (from, to, departAt) => {
    // Traffic changes by the quarter hour, not the minute.
    const slot = Math.round(departAt.getTime() / (15 * 60_000));
    const id = `${from}|${to}|${slot}`;
    let answer = asked.get(id);
    if (!answer) {
      answer = key
        ? googleDriveMins(key, from, to, departAt)
            .catch((error) => {
              console.error("[routes] Google unreachable", error);
              return null;
            })
            .then((mins) => mins ?? estimate(from, to))
        : Promise.resolve(estimate(from, to));
      asked.set(id, answer);
    }
    return answer;
  };
}
