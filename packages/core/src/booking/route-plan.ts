// A van's day as a route (Diary → Day → Route planner): from the start point
// to each job in turn and back, with when to leave each place to arrive a
// little before the next job starts. Drive times come from the caller
// (booking/drive-times.ts: Google Maps with traffic, or an estimate), so this
// file stays free of network access and can be tested.

export type RouteStop = {
  id: string;
  // Where to drive to: "12 High Street, BS1 4DJ".
  address: string;
  postcode: string;
  start: Date;
  end: Date;
  customer: string | null;
  service: string | null;
};

// How long it takes to drive between two places, leaving at `departAt`.
// Null when it can't be worked out (an address Google can't find).
export type DriveTime = (from: string, to: string, departAt: Date) => Promise<number | null>;

export type RouteLeg = {
  // null = the start point.
  fromId: string | null;
  // null = back to the start point.
  toId: string | null;
  driveMins: number | null;
  // When to set off: arrive `marginMins` before the next job. For the trip
  // home, when the last job ends.
  leaveBy: Date;
  // When you'd get there leaving at leaveBy (home: the expected time back).
  arriveBy: Date;
  // Time between finishing the job before and having to leave. Negative =
  // you'd be late even leaving the moment it ends. Null for the first leg
  // (from the start point) and the trip home.
  spareMins: number | null;
};

export type RoutePlan = {
  stops: RouteStop[];
  legs: RouteLeg[];
  // Any leg where you can't make the next job on time.
  late: boolean;
};

const MINUTE = 60_000;
const addMins = (d: Date, mins: number) => new Date(d.getTime() + mins * MINUTE);

// Works backwards from each job's start: arrive `marginMins` early, so leave
// that much plus the drive before. Traffic depends on when you leave, so
// each drive is asked twice: once leaving roughly then, then again leaving at
// the time the first answer gave.
export async function planRoute({
  home,
  stops,
  marginMins,
  driveMins,
}: {
  home: string | null;
  stops: RouteStop[];
  marginMins: number;
  driveMins: DriveTime;
}): Promise<RoutePlan> {
  const sorted = [...stops].sort((a, b) => a.start.getTime() - b.start.getTime());
  const legs: RouteLeg[] = [];

  async function legTo(from: string, to: RouteStop, roughDeparture: Date) {
    const arriveAt = addMins(to.start, -marginMins);
    const first = await driveMins(from, to.address, roughDeparture);
    if (first === null) return { driveMins: null, leaveBy: arriveAt };
    const refined = (await driveMins(from, to.address, addMins(arriveAt, -first))) ?? first;
    return { driveMins: refined, leaveBy: addMins(arriveAt, -refined) };
  }

  for (let i = 0; i < sorted.length; i++) {
    const to = sorted[i];
    const prev = sorted[i - 1];
    // A job at the same postcode as the one before needs no drive.
    if (prev && samePostcode(prev.postcode, to.postcode)) {
      legs.push({
        fromId: prev.id,
        toId: to.id,
        driveMins: 0,
        leaveBy: prev.end,
        arriveBy: prev.end,
        spareMins: Math.round((to.start.getTime() - prev.end.getTime()) / MINUTE),
      });
      continue;
    }
    const from = prev ? prev.address : home;
    if (!from) continue;
    const leg = await legTo(from, to, prev ? prev.end : addMins(to.start, -60));
    legs.push({
      fromId: prev?.id ?? null,
      toId: to.id,
      driveMins: leg.driveMins,
      leaveBy: leg.leaveBy,
      arriveBy: leg.driveMins === null ? addMins(to.start, -marginMins) : addMins(leg.leaveBy, leg.driveMins),
      spareMins: prev ? Math.round((leg.leaveBy.getTime() - prev.end.getTime()) / MINUTE) : null,
    });
  }

  const last = sorted.at(-1);
  if (home && last) {
    const drive = await driveMins(last.address, home, last.end);
    legs.push({
      fromId: last.id,
      toId: null,
      driveMins: drive,
      leaveBy: last.end,
      arriveBy: addMins(last.end, drive ?? 0),
      spareMins: null,
    });
  }

  return { stops: sorted, legs, late: legs.some((l) => l.spareMins !== null && l.spareMins < 0) };
}

function samePostcode(a: string, b: string) {
  return a.replace(/\s/g, "").toUpperCase() === b.replace(/\s/g, "").toUpperCase();
}

// ---------------------------------------------------------------- opening a map app

// Turn-by-turn to one place, in Waze or Google Maps. Plain links, so they open
// the app on a phone and need no key.
export function wazeUrl(address: string) {
  return `https://waze.com/ul?q=${encodeURIComponent(address)}&navigate=yes`;
}

export function googleMapsUrl(address: string) {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}&travelmode=driving`;
}

// The whole day as one Google Maps route. Google's links take up to 9 stops
// in between, so a longer day gets null (open the legs one at a time).
export function googleMapsDayUrl(home: string | null, addresses: string[]) {
  if (addresses.length === 0) return null;
  const origin = home ?? addresses[0];
  const rest = home ? addresses : addresses.slice(1);
  const destination = home ?? rest.at(-1);
  const waypoints = home ? rest : rest.slice(0, -1);
  if (!destination || waypoints.length > 9) return null;
  const params = new URLSearchParams({ api: "1", origin, destination, travelmode: "driving" });
  if (waypoints.length) params.set("waypoints", waypoints.join("|"));
  return `https://www.google.com/maps/dir/?${params}`;
}
